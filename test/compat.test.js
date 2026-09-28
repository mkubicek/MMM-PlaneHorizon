// MagicMirror 2.18 on the Pi may run node_helper on Node 10: no fetch, no ?. or ??, nothing past ES2018.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

for (const file of ["node_helper.js", "lib/opensky.js", "lib/sky.js", "lib/aircraft.js", "lib/models.js"]) {
  test(`${file} stays Node 10 compatible`, () => {
    const src = fs.readFileSync(path.join(__dirname, "..", file), "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    for (const [pattern, what] of [[/\?\./, "optional chaining"], [/\?\?/, "nullish coalescing"], [/\bfetch\(/, "fetch"], [/\.at\(/, "Array.at"], [/\.flat(Map)?\(/, "flat/flatMap"], [/AbortSignal/, "AbortSignal"], [/\breplaceAll\(/, "replaceAll"]]) {
      assert.ok(!pattern.test(src), `${what} in ${file}`);
    }
  });
}
