const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function helper() {
  let network = 0, credentialReads = 0;
  const sent = [], timers = [];
  const context = { module: { exports: {} }, console, setTimeout: (f, ms) => { timers.push(ms); return 1; }, clearTimeout() {}, require(name) {
    if (name === 'node_helper') return { create: obj => obj };
    if (name === 'logger') return { warn() {}, error() {} };
    if (name === 'fs') return { readFileSync() { credentialReads++; const e = new Error(); e.code = 'ENOENT'; throw e; } };
    if (name === './lib/opensky') return Object.assign({}, require('../lib/opensky'), {
      OpenSky: class { async states() { network++; return { aircraft: [] }; } },
      describe: async () => { network++; return {}; }
    });
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../node_helper'), 'utf8'), context);
  const h = context.module.exports;
  h.sendSocketNotification = (name, value) => sent.push({ name, value });
  h.start();
  return { h, sent, timers, counts: () => ({ network, credentialReads }) };
}
test('offline demo never reads credentials or contacts either provider, even for metadata', async () => {
  const { h, sent, counts } = helper();
  h.socketNotificationReceived('PLANEHORIZON_START', { center: { lat: 51.5, lon: 0 }, radiusKm: 60, pollSeconds: 30, geoidM: 0, demo: true });
  assert.equal(sent[0].value.aircraft.length, 5);
  await h.lookup('d00001', 'DEMO');
  await h.lookup('abcdef', 'UNKNOWN');
  assert.deepEqual(counts(), { network: 0, credentialReads: 0 });
  assert.ok(sent.some(x => x.name === 'PLANEHORIZON_INFO'));
});
test('anonymous mode cannot accidentally consume its daily quota in minutes', async () => {
  const { h, timers } = helper();
  h.socketNotificationReceived('PLANEHORIZON_START', { center: { lat: 51.5, lon: 0 }, radiusKm: 60, pollSeconds: 1, geoidM: 0 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.config.pollSeconds, 240);
  assert.ok(timers.includes(240000));
});
