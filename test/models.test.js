const test = require("node:test");
const assert = require("node:assert/strict");
const M = require("../lib/models");

const engines = m => m.tris.filter(t => t.part === "engine").length;

test("families differ where it shows: engines, tails, props", () => {
  const a320 = M.modelFor("A320", "narrow", "SWR18A"), a388 = M.modelFor("A388", "quad", "UAE1"), crj = M.modelFor("CRJ9", "tailjet", "CLH1");
  assert.equal(engines(a388), 2 * engines(a320)); // four nacelles vs two
  assert.ok(M.modelFor("DH8D", "prop", "AUA1").tris.some(t => t.part === "prop"));
  assert.ok(!a320.tris.some(t => t.part === "prop"));
  const finTop = m => Math.max(...m.tris.filter(t => t.part === "wing").flatMap(t => t.v.map(v => v[2])));
  assert.ok(finTop(crj) > finTop(a320)); // T-tail: tailplane on top of the fin
});

test("real dimensions: lengths per type, fallback by shape", () => {
  assert.equal(M.modelFor("A321", "narrow", "").L, 44.5);
  assert.equal(M.modelFor("B77W", "wide", "").L, 73.9);
  assert.ok(M.modelFor("C172", "light", "").L < 10);
  assert.equal(M.modelFor("ZZZZ", "heli", "").tris.some(t => t.part === "rotor"), true); // unknown type: by shape
});

test("airline tail colours, grey when unknown", () => {
  assert.equal(M.modelFor("A320", "narrow", "SWR18A").colors.tail, "#d0212d");
  assert.equal(M.modelFor("A320", "narrow", "EZY12").colors.tail, "#f06a1c");
  assert.equal(M.modelFor("A320", "narrow", "HBJXA").colors.tail, "#dcdcdc");
});

test("models are cached per type and airline", () => {
  assert.equal(M.modelFor("B738", "narrow", "RYR1"), M.modelFor("B738", "narrow", "RYR2"));
});
