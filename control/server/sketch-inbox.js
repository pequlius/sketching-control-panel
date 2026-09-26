// Watches a camera app's save folder and copies new photos into the active
// case as sketches. Polls instead of using fs.watch, so a missing folder, a
// folder that appears later, or a changed setting all just work.
const fs   = require("fs");
const os   = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SETTINGS_PATH         = path.join(__dirname, "..", "config", "sketch-inbox.json");
const SETTINGS_DEFAULT_PATH = path.join(__dirname, "..", "config", "sketch-inbox.default.json");
const CASES_DIR             = path.join(__dirname, "..", "..", "cases");
const LOG_DIR               = path.join(__dirname, "..", "logs");
const LOG_PATH              = path.join(LOG_DIR, "panel.jsonl");

const POLL_MS      = 500;
const STABLE_POLLS = 2;  // size and mtime unchanged this many polls = fully written

function loadSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) fs.copyFileSync(SETTINGS_DEFAULT_PATH, SETTINGS_PATH);
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
}

const expandVars = p => p
  .replace(/^~(?=$|[\\/])/, os.homedir())
  .replace(/%([^%]+)%/g, (m, name) => process.env[name] ?? m);

// Asks Windows where a known folder is (User Shell Folders in the registry).
function knownFolder(valueName) {
  try {
    const out = execFileSync("reg", ["query",
      "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders",
      "/v", valueName], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = out.match(/REG_(?:EXPAND_)?SZ\s+(.+)/);
    return m ? expandVars(m[1].trim()) : null;
  } catch {
    return null;
  }
}

// "auto" = the Windows Camera app's Camera Roll: its own known folder if it
// has been redirected, otherwise Camera Roll inside the Pictures known folder.
// Explicit paths may use ~ and %VAR%.
function resolveFolder(setting) {
  if (!setting || setting === "auto") {
    if (process.platform === "win32") {
      const cameraRoll = knownFolder("{AB5FB87B-7CE2-4F83-915D-550846C9B83E}");
      if (cameraRoll) return cameraRoll;
      const pictures = knownFolder("My Pictures");
      if (pictures) return path.join(pictures, "Camera Roll");
    }
    return path.join(os.homedir(), "Pictures", "Camera Roll");
  }
  return path.resolve(expandVars(setting));
}

function sketchName(date, ext, dir) {
  // ISO 8601 with ":" and "." replaced, since Windows forbids ":" in file names
  const base = date.toISOString().replace(/[:.]/g, "-");
  let name = base + ext;
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}_${i}${ext}`;
  return name;
}

function log(entry) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}

function latestSketch(caseId) {
  if (!caseId) return null;
  const dir = path.join(CASES_DIR, caseId, "sketches");
  let names;
  try { names = fs.readdirSync(dir); } catch { return null; }
  const images = names.filter(n => /\.(jpe?g|png)$/i.test(n)).sort();
  if (images.length === 0) return null;
  const name = images[images.length - 1];
  return { case: caseId, name, path: path.join(dir, name) };
}

/**
 * @param {object}   opts
 * @param {function} opts.getTarget  () => { mode, caseId } from the current config
 */
function startSketchInbox({ getTarget }) {
  const status = { folder: null, folderExists: false, lastSkipped: null, lastError: null };

  let folder  = null;
  let setting = undefined;  // folder setting last resolved, so the registry is only read on change
  let since   = Date.now();  // files older than this are ignored
  let seen    = new Set();  // files already handled (or present when watching began)
  let pending = new Map();  // name -> { size, mtimeMs, stable }

  function resetFor(newFolder) {
    folder = newFolder;
    since = Date.now();
    // Everything already in the folder is old, whatever its timestamps say
    try { seen = new Set(fs.readdirSync(folder)); } catch { seen = new Set(); }
    pending = new Map();
    status.folder = folder;
    console.log(`Sketch inbox: watching "${folder}"`);
  }

  function handle(name) {
    const src = path.join(folder, name);
    const { mode, caseId } = getTarget();
    const caseDir = caseId && path.join(CASES_DIR, caseId);

    if (mode !== "case" || !caseDir || !fs.existsSync(caseDir)) {
      const reason = mode !== "case" ? "Admin mode" : "no active case";
      status.lastSkipped = { file: name, reason, ts: new Date().toISOString() };
      log({ event: "sketch_ignored", original: src, reason });
      console.log(`Sketch inbox: ignored "${name}" (${reason})`);
      return;
    }

    const destDir = path.join(caseDir, "sketches");
    fs.mkdirSync(destDir, { recursive: true });
    const dest = path.join(destDir, sketchName(new Date(), path.extname(name).toLowerCase(), destDir));
    fs.copyFileSync(src, dest);  // copy, never move: the camera app's folder stays intact
    status.lastSkipped = null;
    log({ event: "sketch", original: src, path: dest, case: caseId });
    console.log(`Sketch inbox: "${name}" -> ${path.relative(path.join(CASES_DIR, ".."), dest)}`);
  }

  function poll() {
    let settings;
    try {
      settings = loadSettings();
    } catch (err) {
      status.lastError = `sketch-inbox.json: ${err.message}`;
      return;
    }
    if (settings.folder !== setting) {
      setting = settings.folder;
      const wanted = resolveFolder(setting);
      if (wanted !== folder) resetFor(wanted);
    }

    let names;
    try {
      names = fs.readdirSync(folder);
      status.folderExists = true;
    } catch {
      status.folderExists = false;
      return;
    }

    const exts = (settings.extensions || [".jpg", ".jpeg", ".png"]).map(e => e.toLowerCase());
    for (const name of names) {
      if (seen.has(name) || !exts.includes(path.extname(name).toLowerCase())) continue;

      let st;
      try { st = fs.statSync(path.join(folder, name)); } catch { continue; }
      // Only files created after the server started (or the folder changed)
      if (Math.max(st.birthtimeMs, st.mtimeMs) < since) { seen.add(name); continue; }

      // Wait until size and mtime have held still for a few polls
      const p = pending.get(name);
      if (!p || p.size !== st.size || p.mtimeMs !== st.mtimeMs || st.size === 0) {
        pending.set(name, { size: st.size, mtimeMs: st.mtimeMs, stable: 0 });
        continue;
      }
      if (++p.stable < STABLE_POLLS) continue;

      try {
        handle(name);
        seen.add(name);
        pending.delete(name);
        status.lastError = null;
      } catch (err) {
        // Most likely still locked by the camera app; try again next poll
        status.lastError = `${name}: ${err.message}`;
      }
    }
  }

  poll();
  setInterval(poll, POLL_MS).unref();

  return {
    getStatus: () => {
      const { caseId } = getTarget();
      return { ...status, latest: latestSketch(caseId) };
    },
  };
}

module.exports = { startSketchInbox };
