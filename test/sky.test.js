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

// References from PyEphem (topocentric, no refraction). limb: bright limb from straight up, turning east.
test("moon position, phase and lit-side orientation match an ephemeris", () => {
  const cases = [
    [47.3769, 8.5417, "2026-10-13T17:00:00Z", 227.329, 2.86, 0.0957, 257.9, true], // low crescent, sun just set to the right
    [47.3769, 8.5417, "2026-09-26T20:00:00Z", 118.788, 29.218, 0.9991, 41.9, false], // full moon rising
    [51.5, 0, "2026-06-20T14:00:00Z", 124.474, 30.041, 0.3645, 323.8, true], // daytime waxing moon
    [47.3769, 8.5417, "2026-10-03T06:00:00Z", 213.279, 66.946, 0.5363, 67.7, false] // morning last quarter
  ];
  for (const [lat, lon, iso, az, el, illum, limb, waxing] of cases) {
    const m = Sky.moonPosition(new Date(iso), lat, lon);
    assert.ok(Math.abs(m.az - az) < 0.25, `${iso} az ${m.az}`);
    assert.ok(Math.abs(m.el - el) < 0.25, `${iso} el ${m.el}`);
    assert.ok(Math.abs(m.illumination - illum) < 0.01, `${iso} illumination ${m.illumination}`);
    assert.ok(Math.abs(((m.limb - limb + 540) % 360) - 180) < 3, `${iso} limb ${m.limb}`);
    assert.equal(m.waxing, waxing);
  }
});
