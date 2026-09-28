#!/usr/bin/env node
// Generates an ignored personal horizon; never replaces an existing file.
const fs = require("fs");
const { build } = require("../lib/config");
try {
  const input = process.argv[2];
  const output = process.argv[3] || "horizon.local.json";
  if (!input) throw new Error("Usage: node tools/configure.js site.local.json [horizon.local.json]");
  const horizon = build(JSON.parse(fs.readFileSync(input, "utf8")));
  fs.writeFileSync(output, JSON.stringify(horizon, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log(`Created ${output} (${horizon.observers.length} views). Restart MagicMirror to load it.`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
