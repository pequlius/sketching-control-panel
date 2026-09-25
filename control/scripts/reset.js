#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "config", "agent-config.default.json");
const dst = path.join(__dirname, "..", "config", "agent-config.json");

fs.copyFileSync(src, dst);
console.log("Config reset to defaults.");
