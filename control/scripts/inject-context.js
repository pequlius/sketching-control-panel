#!/usr/bin/env node
/**
 * UserPromptSubmit hook.
 * Reads `mode` and `current_case` from agent-config.json and injects the
 * appropriate context at the start of every prompt:
 *
 *   - admin mode: a short banner noting that control-system work is
 *     unrestricted and the behaviour parameters do not apply.
 *   - case mode:  the compiled [KONTROLLPANEL] instructions plus an
 *     [ACTIVE CASE] restriction naming the folder the agent may edit.
 *
 * Run from the project root: `node control/scripts/inject-context.js`.
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT   = path.join(__dirname, "..", "..");
const CONFIG = path.join(ROOT, "control", "config", "agent-config.json");
const PROMPT = path.join(ROOT, "control", "config", "agent-prompt.txt");
const BUILD  = path.join(ROOT, "control", "scripts", "build-prompt.js");

function emit(ctx) {
  if (!ctx) { console.log("{}"); return; }
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ctx,
    },
  }));
}

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { /* defaults below */ }

const mode        = cfg.mode === "case" ? "case" : "admin";
const currentCase = cfg.current_case || "case-01";

if (mode === "admin") {
  emit(
    "[ADMIN MODE]\n" +
    "You are working on the control system itself (control panel, server, " +
    "scripts, root-level files). The kontrollpanel behaviour parameters do " +
    "NOT apply to this work — proceed as a normal engineering assistant. " +
    "File edits are unrestricted."
  );
} else {
  if (!fs.existsSync(PROMPT)) {
    try { cp.execFileSync("node", [BUILD], { stdio: "ignore" }); } catch { /* fall through */ }
  }
  let prompt = "";
  try { prompt = fs.readFileSync(PROMPT, "utf8"); } catch { /* empty */ }

  const restriction =
    `\n\n[ACTIVE CASE: ${currentCase}]\n` +
    `Work only inside cases/${currentCase}/. Treat the control panel, server, ` +
    `scripts, and root-level files as read-only — do not modify them. If a ` +
    `request requires changing them, stop and tell the user to switch to ` +
    `Admin mode in the control panel.`;

  emit("[KONTROLLPANEL]\n" + prompt + restriction);
}
