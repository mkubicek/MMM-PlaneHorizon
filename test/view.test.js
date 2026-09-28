const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../lib/view");

const flatSky = [[0, 140], [365, 140]]; // horizon line 140 px down
const plane = (x, y, extra) => Object.assign({ key: `k${x}`, x, y, size: 16, path: [] }, extra);

const band = V.skyBand(flatSky, 365);
const decide = (p, w, placed, memo, now, optional, others = []) => V.decideSide(V.scoreSides(p, w, 31, others, placed, band, 365, 150), memo, now, optional);

test("labels go right of the aircraft when there is room", () => {
  assert.equal(decide(plane(100, 60), 90, [], null, 0, false).side, 0);
});

test("labels switch to the left near the right edge", () => {
  assert.equal(decide(plane(330, 60), 90, [], null, 0, false).side, 1);
});

test("labels never overlap each other", () => {
  assert.notEqual(decide(plane(100, 60), 90, [{ x: 110, y: 43, w: 90, h: 31 }], null, 0, false).side, 0);
});

test("farther positions are used before a label crosses the horizon line", () => {
  const b = decide(plane(100, 128), 90, [], null, 0, false).box; // beside the plane it would cut the line at y=140
  assert.ok(b.y + b.h < 140 - 7 || b.y > 140 + 7, JSON.stringify(b));
});

test("no label when nothing fits", () => {
  assert.equal(decide(plane(20, 20), 400, [], null, 0, false), null);
});

test("a label keeps a merely worse side for a while instead of twitching", () => {
  // Flying level just above the line: the right-hand label (side 0) cuts it now and for the next 45 s.
  const p = plane(100, 128, { path: [[110, 128], [120, 128], [130, 128]] });
  const memo = { side: 0, since: -100, worseSince: null };
  const first = decide(p, 90, [], memo, 0, false);
  assert.equal(first.side, 0);                                     // just became worse: stay
  assert.equal(decide(p, 90, [], first.memo, 7, false).side, 0);   // still within the grace period
  assert.notEqual(decide(p, 90, [], first.memo, 9, false).side, 0); // worse for 8 s+: move
});

test("a freshly placed label settles before moving for a better spot", () => {
  const p = plane(100, 128, { path: [[110, 128], [120, 128], [130, 128]] });
  const memo = { side: 0, since: 0, worseSince: -30 }; // worse for long, but only just placed
  assert.equal(decide(p, 90, [], memo, 10, false).side, 0);
  assert.notEqual(decide(p, 90, [], memo, 16, false).side, 0);
});

test("a label starts on the side it can keep: not towards the edge its aircraft is flying to", () => {
  // Heading right towards the edge: the right side fits now but won't in 15-45 s.
  const p = plane(200, 60, { path: [[240, 60], [280, 60], [320, 60]] });
  assert.notEqual(decide(p, 90, [], null, 0, false).side, 0);
});

test("hard conflicts move a label at once", () => {
  const memo = { side: 0, since: 0, worseSince: null };
  const taken = [{ x: 110, y: 43, w: 90, h: 31 }]; // another label now sits on the right side
  assert.notEqual(decide(plane(100, 60), 90, taken, memo, 1, false).side, 0);
});

test("secondary labels give up rather than sit on another aircraft", () => {
  const me = plane(180, 60);
  const crowd = [[205, 60], [150, 60], [200, 30], [150, 30], [180, 20], [200, 80], [150, 80], [205, 25], [140, 25], [180, 5], [205, 95], [140, 95]].map(([x, y]) => plane(x, y, { key: `c${x},${y}` }));
  assert.equal(decide(me, 60, [], null, 0, true, [me, ...crowd]), null);
  assert.notEqual(decide(me, 60, [], null, 0, false, [me, ...crowd]), null); // the first label settles
});

test("the collision band ignores sub-pixel wiggles of a jagged line", () => {
  const jagged = Array.from({ length: 731 }, (_, k) => [k * 0.5, 140 + (k % 2 ? 3 : -3)]);
  const b = V.skyBand(jagged, 365);
  const box = { x: 100, y: 100, w: 90, h: 31 };
  // Moving the box by fractions of a pixel never changes the verdict.
  const verdicts = new Set([0, 0.2, 0.4, 0.6, 0.8].map(dx => V.hitsBand(b, Object.assign({}, box, { x: box.x + dx }))));
  assert.equal(verdicts.size, 1);
});

test("visible aircraft first, then at most two arrivals, soonest first", () => {
  const c = (key, visible, el, soon) => ({ key, visible, soon, c: { el, ground: 10000 } });
  const shown = V.planesToShow([c("a", false, 5, 90), c("b", true, 20), c("c", false, 5, 30), c("d", true, 40), c("e", false, 5, 60)], 2);
  assert.deepEqual(shown.map(p => p.key), ["d", "b", "c", "e"]);
});

test("label text: type + airline, then route, altitude or countdown", () => {
  const ac = { icao24: "4b1814", callsign: "SWR18A", alt: 11047.6 };
  const info = { icaoType: "A20N", origin: { city: "Palma De Mallorca", iata: "PMI" }, destination: { city: "Zurich", iata: "ZRH" } };
  assert.deepEqual(V.labelText(ac, info, true, null, 47.6), { title: "A320neo", airline: "SWISS", second: "PMI → Zurich", shape: "narrow" });
  assert.equal(V.labelText(ac, {}, true, null, 47.6).second, "11.0 km");
  assert.equal(V.labelText(ac, info, false, 75, 47.6).second, "in 1:15");
});

test("the panorama is centred on the direction you face at the mirror", () => {
  const g = V.stripGeometry(360, 150, 208, 70, 4); // facing SSW
  assert.equal(g.x(208), 180); // straight ahead: middle
  assert.equal(g.x(298), 270); // balcony (WNW) on the right
  assert.equal(g.x(118), 90); // bedroom (ESE) on the left
  assert.ok(g.x(27) > 355 && g.x(29) < 5); // straight behind you: the edges
});

test("lines are split where they wrap around the strip's edge", () => {
  const pts = [[340, 10], [355, 12], [2, 11], [20, 9]];
  assert.deepEqual(V.runs(pts, 360), [[[340, 10], [355, 12]], [[2, 11], [20, 9]]]);
});

test("without a facing direction, the first opening is on the left", () => {
  const g = V.stripGeometry(360, 150, V.defaultFacing([{ facingDeg: 298.2 }, { facingDeg: 118.2 }]), 70, 4);
  assert.ok(g.x(298.2) < 180 && g.x(118.2) > 180);
});

test("the drawn line drops tree-top spikes but keeps real steps", () => {
  // A 20° wall from φ 0 to 20 on a 5° horizon, plus a one-sample spike at φ -40.
  const trees = new Array(1440).fill(null).map((_, i) => {
    const φ = ((i * 0.25 - 100 + 540) % 360) - 180;
    if (Math.abs(φ) > 92) return null;
    if (Math.abs(φ + 40) < 0.1) return 30;
    return φ >= 0 && φ <= 20 ? 20 : 5;
  });
  const obs = { facingDeg: 100, trees, terrain: trees, terrainDistM: trees.map(() => 0), treesDistM: trees.map(() => 0) };
  const line = V.skyline(obs, 0.25, 3);
  const el = φ => line.find(p => p.φ === φ).el;
  assert.ok(el(-40) < 5.5, `spike removed: ${el(-40)}`);
  assert.ok(el(10) > 19.5 && el(-10) < 5.5 && el(30) < 5.5, "the wall stays a wall");
  assert.ok(el(1) > 15 && el(-1) < 10, `its edges stay sharp: ${el(-1)} → ${el(1)}`);
});

test("aircraft size: perspective with distance, and real length", () => {
  const near = V.apparentSize(6000, 38), far = V.apparentSize(40000, 38), jumbo = V.apparentSize(20000, 72.7), cessna = V.apparentSize(20000, 8.3);
  assert.ok(Math.abs(near - 34) < 0.5 && far < 12, `${near} ${far}`);
  assert.ok(jumbo > 1.4 * V.apparentSize(20000, 38) && cessna === 7, `${jumbo} ${cessna}`); // clamped at 7 px
  assert.equal(V.haze(3000), 1);
  assert.ok(V.haze(60000) < 0.5);
});

test("full labels go to the most prominent aircraft per view, the rest get short ones", () => {
  const p = (key, view, size, visible = true) => ({ key, view, size, visible });
  const planes = [p("a", "balcony", 30), p("b", "balcony", 12), p("c", "balcony", 20), p("d", "balcony", 9), p("e", "bedroom", 14), p("f", "bedroom", 25, false)];
  assert.deepEqual([...V.fullLabelSet(planes, new Set(), 2)].sort(), ["a", "c", "e", "f"]); // visible first, then size
});

test("a full label stays with its aircraft while it is still near the top", () => {
  const p = (key, size) => ({ key, view: "balcony", size, visible: true });
  const planes = [p("a", 30), p("b", 22), p("c", 21)];
  assert.deepEqual([...V.fullLabelSet(planes, new Set(["a", "c"]), 2)].sort(), ["a", "c"]); // c keeps it over b
  assert.deepEqual([...V.fullLabelSet([...planes, p("d", 40)], new Set(["a", "c"]), 2)].sort(), ["a", "d"]); // c dropped to 4th
});
