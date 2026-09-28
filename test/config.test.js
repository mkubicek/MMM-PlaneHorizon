const test = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../lib/config');
const example = require('../examples/site.example.json');
test('portable setup creates independent observers and wraps the skyline at north', () => {
  const site = Object.assign({}, example, { geoidUndulationM: 20, views: [{ direction: 0, skyline: [[350, 10], [10, 30]] }] });
  const h = build(site);
  assert.equal(h.observers[0].eyeEllipsoidal, 50);
  assert.equal(h.observers[0].landscape[0], 20);
  assert.equal(h.observers[0].landscape.length, 360);
});
test('bad coordinates and ambiguous skyline samples produce useful setup errors', () => {
  for (const latitude of [null, '51', NaN, 90]) assert.throws(() => build(Object.assign({}, example, { latitude })), /latitude/);
  assert.throws(() => build(Object.assign({}, example, { views: [] })), /views/);
  assert.throws(() => build(Object.assign({}, example, { views: [{ direction: 90, skyline: [[1, 0], [1, 2]] }] })), /Duplicate/);
});
