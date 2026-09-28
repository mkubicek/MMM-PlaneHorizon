const test = require("node:test");
const assert = require("node:assert/strict");
const { parseStates, boundingBox } = require("../lib/opensky");

test("state rows become aircraft with ellipsoidal heights", () => {
  const body = { time: 1, states: [
    ["4b1814", "SWR18A  ", "Switzerland", 100, 101, 8.5, 47.4, 3000, false, 120, 90, -3, null, 3050, "1000", false, 0, 3],
    ["3c6444", "DLH4    ", "Germany", null, 101, 8.6, 47.3, 5000, false, 200, 180, 0, null, null, "1000", false, 0, 3],
    ["4b1815", "", "Switzerland", 100, 101, null, null, 1000, false, 0, 0, 0, null, null, null, false, 0, 0],
  ] };
  const [a, b, ...rest] = parseStates(body, 47.6);
  assert.equal(rest.length, 0); // no position, dropped
  assert.equal(a.callsign, "SWR18A");
  assert.equal(a.alt, 3050); // GNSS height as is
  assert.equal(b.alt, 5047.6); // barometric + geoid undulation
  assert.equal(b.t, 101); // last contact when there is no position time
});

test("the box around home stays under 25 square degrees (1 credit)", () => {
  const b = boundingBox(51.5, 0.0, 60);
  assert.ok((b.lamax - b.lamin) * (b.lomax - b.lomin) < 25);
  assert.ok(b.lamin < 51.5 && b.lamax > 51.5 && b.lomin < 0.0 && b.lomax > 0.0);
});
