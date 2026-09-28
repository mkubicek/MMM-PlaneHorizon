const test = require('node:test');
const assert = require('node:assert/strict');
const Sky = require('../lib/sky');
const { build } = require('../lib/config');
const horizon = build({ latitude: 0, longitude: 0, eyeAltitudeM: 0, views: [
  { direction: 90, fieldOfView: 120, maxElevation: 60, skyline: [[0, 5], [180, 5]] },
  { direction: 270, fieldOfView: 120 }
] });
const [east, west] = horizon.observers;
test('view, skyline, roof and range constrain visibility', () => {
  assert.equal(Sky.classify(east, 1, { lat: 0, lon: .1, alt: 2000 }).status, 'visible');
  assert.equal(Sky.classify(west, 1, { lat: 0, lon: .1, alt: 2000 }).status, 'behind');
  assert.equal(Sky.classify(east, 1, { lat: 0, lon: .1, alt: 100 }).status, 'terrain');
  assert.equal(Sky.classify(east, 1, { lat: 0, lon: .001, alt: 10000 }).status, 'frame');
  assert.equal(Sky.classify(east, 1, { lat: 0, lon: .5, alt: 10000 }).status, 'far');
  assert.equal(Sky.apertureTop(east, 70), null);
});
test('prediction finds traffic entering range', () => {
  const ac = { lat: 0, lon: .5, alt: 8000, v: 230, track: 270, vr: 0, t: 0 };
  const seconds = Sky.nextVisible(east, 1, ac, 0, 240, 5, 40000);
  assert.ok(seconds > 0 && seconds < 240);
});
test('dead reckoning and wraparound walls', () => {
  const p = Sky.extrapolate({ lat: 0, lon: 0, alt: 1000, v: 100, track: 90, vr: 5, t: 0 }, 60);
  assert.ok(p.lon > .05 && p.lon < .06); assert.equal(p.alt, 1300);
  assert.equal(Sky.blockedAt({ blocked: [[350, 10]] }, 1), true);
  assert.equal(Sky.blockedAt({ blocked: [[350, 10]] }, 20), false);
});
test('solar elevation near zenith at equatorial equinox noon', () => {
  assert.ok(Sky.sunPosition(new Date('2026-03-20T12:07:00Z'), 0, 0).el > 88);
});
