#!/usr/bin/env node
/**
 * Lists MIDI input ports and prints every incoming message, annotated with
 * what it maps to in midi-map.json. Use it to verify the EF44 mapping, or to
 * find the new numbers after changing the device configuration in Grid Editor.
 *
 * If the port cannot be opened, another program may hold it exclusively; stop
 * the control server or close Grid Editor and try again.
 */
const easymidi = require("easymidi");
const { loadMap } = require("../server/midi-panel");

const map = loadMap();
const channel = map.channel;  // 1–16, as in Grid Editor

function describe(msg) {
  if (msg.channel + 1 !== channel) return `(not channel ${channel})`;
  if (msg._type === "cc") {
    const fader = map.faders.findIndex(f => f.cc === msg.controller);
    if (fader >= 0) return `→ fader ${fader + 1} (${map.faders[fader].param})`;
    const enc = map.encoders.findIndex(e => e.turn_cc === msg.controller);
    if (enc >= 0) return `→ encoder ${enc + 1} turn`;
  }
  if (msg._type === "noteon" || msg._type === "noteoff") {
    const enc = map.encoders.findIndex(e => e.push_note === msg.note);
    if (enc >= 0) return `→ encoder ${enc + 1} push`;
  }
  return "(not in midi-map.json)";
}

const ports = easymidi.getInputs();
console.log("MIDI input ports:");
if (ports.length === 0) console.log("  (none)");
ports.forEach((p, i) => console.log(`  ${i}: ${p}${p.includes(map.port) ? "   ← matches midi-map.json" : ""}`));
console.log("");

let opened = 0;
for (const name of ports) {
  let input;
  try {
    input = new easymidi.Input(name);
  } catch (err) {
    console.log(`Could not open "${name}": ${err.message}`);
    console.log("  Another program (the control server, Grid Editor) may have the port open.");
    continue;
  }
  opened++;
  input.on("message", msg => {
    if (!("channel" in msg)) return;  // clock, sysex etc.
    const number = msg.controller ?? msg.note ?? "";
    const value  = msg.value ?? msg.velocity ?? "";
    console.log(
      `${new Date().toISOString().slice(11, 23)}  ${name.padEnd(24)}  ` +
      `${msg._type.padEnd(8)} ch ${String(msg.channel + 1).padStart(2)}  ` +
      `#${String(number).padStart(3)}  val ${String(value).padStart(3)}  ${describe(msg)}`
    );
  });
}

if (opened === 0) {
  console.log("No input ports could be opened.");
  process.exit(1);
}
console.log("Listening — move faders, turn and push encoders. Ctrl+C to stop.\n");
