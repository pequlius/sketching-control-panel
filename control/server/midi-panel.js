// Reads the EF44 over USB MIDI and turns fader movements into parameter values.
// Config writes are delegated to the server (setParam), so the panel uses the
// same writeConfig() path as the GUI.
const fs   = require("fs");
const path = require("path");

const MAP_PATH         = path.join(__dirname, "..", "config", "midi-map.json");
const MAP_DEFAULT_PATH = path.join(__dirname, "..", "config", "midi-map.default.json");
const LOG_DIR          = path.join(__dirname, "..", "logs");
const LOG_PATH         = path.join(LOG_DIR, "panel.jsonl");

const POLL_MS    = 2000;     // how often to look for the device being plugged in / out
const ZONE       = 128 / 5;  // five equal zones over 0–127
const HYSTERESIS = 3;        // MIDI steps past a zone border before the value changes
const TAKEOVER   = 3;        // steps a fader must move to take back a value set elsewhere

let easymidi = null;
try {
  easymidi = require("easymidi");
} catch (err) {
  console.warn("MIDI disabled: could not load easymidi:", err.message);
}

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) fs.copyFileSync(MAP_DEFAULT_PATH, MAP_PATH);
  return JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
}

function zoneOf(raw) {
  return Math.min(5, Math.floor(raw / ZONE) + 1);
}

// Quantize 0–127 to 1–5, holding the previous value until the fader is
// HYSTERESIS steps past the border, so a fader resting on a border is stable.
function quantize(raw, prev) {
  const z = zoneOf(raw);
  if (prev == null || z === prev) return z;
  if (z > prev) return raw < (z - 1) * ZONE + HYSTERESIS ? z - 1 : z;
  return raw >= z * ZONE - HYSTERESIS ? z + 1 : z;
}

let logStream = null;
function log(entry) {
  if (!logStream) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    logStream = fs.createWriteStream(LOG_PATH, { flags: "a" });
  }
  logStream.write(JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}

/**
 * @param {object}   opts
 * @param {function} opts.getParam  (key) => current integer value in the config
 * @param {function} opts.setParam  (key, value) => writes the config via writeConfig()
 */
function startMidiPanel({ getParam, setParam }) {
  const status = { connected: false, port: null, error: null };
  if (!easymidi) {
    status.error = "easymidi not available";
    return { getStatus: () => ({ ...status }) };
  }

  const map     = loadMap();
  const channel = map.channel - 1;  // Grid Editor shows 1–16, easymidi uses 0–15
  const faders  = new Map(map.faders.map((f, i) => [f.cc, {
    index: i + 1, param: f.param, raw: null, zone: null, anchorRaw: null,
  }]));

  let input = null;

  function onCC(msg) {
    if (msg.channel !== channel) return;
    const f = faders.get(msg.controller);
    if (!f) return;  // encoder turns and other CCs are not bound yet

    const prevZone = f.zone;
    f.raw  = msg.value;
    f.zone = quantize(msg.value, prevZone);

    // "Last touched wins": write when the fader crosses into a new zone, or
    // when it is moved noticeably after the value was changed from the GUI.
    let written = false;
    const current = getParam(f.param);
    if (f.zone !== current) {
      const moved = f.anchorRaw == null || Math.abs(f.raw - f.anchorRaw) >= TAKEOVER;
      if (f.zone !== prevZone || moved) {
        setParam(f.param, f.zone);
        written = true;
        f.anchorRaw = f.raw;
      }
    } else {
      f.anchorRaw = f.raw;
    }

    log({ fader: f.index, param: f.param, raw: f.raw, value: f.zone, written });
  }

  function connect(portName) {
    try {
      input = new easymidi.Input(portName);
    } catch (err) {
      input = null;
      if (status.error !== err.message) {
        console.warn(`MIDI: could not open "${portName}": ${err.message}`);
      }
      status.error = err.message;
      return;
    }
    input.on("cc", onCC);
    Object.assign(status, { connected: true, port: portName, error: null });
    console.log(`MIDI: connected to "${portName}"`);
    log({ event: "connected", port: portName });
  }

  function disconnect() {
    try { input.close(); } catch { /* device already gone */ }
    input = null;
    console.log(`MIDI: "${status.port}" disconnected`);
    log({ event: "disconnected", port: status.port });
    Object.assign(status, { connected: false, port: null });
  }

  function poll() {
    let ports;
    try {
      ports = easymidi.getInputs();
    } catch (err) {
      status.error = err.message;
      return;
    }
    const match = ports.find(p => p.includes(map.port));
    if (status.connected && match !== status.port) disconnect();
    if (!status.connected && match) connect(match);
    if (!match) status.error = null;
  }

  poll();
  setInterval(poll, POLL_MS).unref();

  return { getStatus: () => ({ ...status }) };
}

module.exports = { startMidiPanel, quantize, loadMap };
