#!/usr/bin/env node
/**
 * PreToolUse hook for Write / Edit / MultiEdit.
 * In `case` mode, denies any file edit whose target is outside
 * cases/<current_case>/. In `admin` mode (or if config is unreadable),
 * allows everything.
 *
 * The harness pipes the tool-call payload as JSON on stdin; the target
 * path is in tool_input.file_path. Run from the project root:
 *   `node control/scripts/guard-write.js`
 */
const fs = require("fs");
const path = require("path");

const ROOT   = path.join(__dirname, "..", "..");
const CONFIG = path.join(ROOT, "control", "config", "agent-config.json");

function allow() {
  // No output + exit 0 = proceed normally.
  process.exit(0);
}

function deny(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// Read the hook payload from stdin.
let payload = {};
try {
  const raw = fs.readFileSync(0, "utf8");
  if (raw.trim()) payload = JSON.parse(raw);
} catch { allow(); }

// Read mode + current case; on any failure, do not block.
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(CONFIG, "utf8")); } catch { allow(); }
if (cfg.mode !== "case") allow();

const currentCase = cfg.current_case || "case-01";
const filePath = payload.tool_input && payload.tool_input.file_path;
if (!filePath) allow();

const cwd       = payload.cwd || process.cwd();
const targetAbs = path.resolve(cwd, filePath);
const caseAbs   = path.resolve(ROOT, "cases", currentCase);

const rel = path.relative(caseAbs, targetAbs);
const inside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

if (inside) allow();

deny(
  `Case mode is active (${currentCase}). Edits are restricted to ` +
  `cases/${currentCase}/. This path is outside that folder:\n  ${targetAbs}\n` +
  `Switch to Admin mode in the control panel to modify control-system files.`
);
