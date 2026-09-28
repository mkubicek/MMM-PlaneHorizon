/* Polls OpenSky for aircraft around home and answers type/route lookups for the ones the
 * widget shows. ES2018 only: MagicMirror 2.18 on the Pi may run this on Node 10. */
const fs = require("fs");
const os = require("os");
const path = require("path");
const NodeHelper = require("node_helper");
const { OpenSky, boundingBox, describe, demoAircraft } = require("./lib/opensky");

let Log;
try { Log = require("logger"); } catch (e) { Log = console; }

// MagicMirror hands config.js to every browser on the LAN, so the OpenSky client lives here instead.
const CREDENTIALS = path.join(os.homedir(), ".config", "MMM-PlaneHorizon", "opensky.json");

function credentials() {
  try {
    const c = JSON.parse(fs.readFileSync(CREDENTIALS, "utf8"));
    if (c.clientId && c.clientSecret) return c;
    throw new Error("credentials need clientId and clientSecret");
  } catch (e) {
    if (e.code !== "ENOENT") Log.error(`MMM-PlaneHorizon: cannot read ${CREDENTIALS}: ${e.message}`);
  }
  return {};
}

const minutes = hhmm => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };

module.exports = NodeHelper.create({
  start() {
    this.config = null;
    this.latest = { aircraft: [], fetchedAt: 0, error: null, quiet: false, remaining: null };
    this.info = new Map();
    this.pending = new Map();
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "PLANEHORIZON_START") {
      if (!this.config) {
        if (!payload || !payload.center || !Number.isFinite(payload.center.lat) || !Number.isFinite(payload.center.lon)) return;
        this.config = Object.assign({}, payload, { pollSeconds: Math.max(10, Number(payload.pollSeconds) || 30) });
        const auth = payload.demo ? {} : credentials();
        this.client = new OpenSky(auth.clientId, auth.clientSecret);
        this.box = boundingBox(payload.center.lat, payload.center.lon, payload.radiusKm);
        if (!payload.demo && !auth.clientId) Log.warn(`MMM-PlaneHorizon: no OpenSky client in ${CREDENTIALS}, using the much smaller anonymous quota`);
        if (!payload.demo && !auth.clientId) this.config.pollSeconds = Math.max(240, this.config.pollSeconds);
        this.poll();
      } else this.broadcast(); // another screen (re)connected
    }
    if (notification === "PLANEHORIZON_DESCRIBE") this.lookup(payload.icao24, payload.callsign);
  },

  inQuietHours() {
    const q = this.config.quietHours;
    if (!q) return false;
    const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), from = minutes(q.from), to = minutes(q.to);
    return from <= to ? now >= from && now < to : now >= from || now < to;
  },

  async poll() {
    const c = this.config;
    let wait = c.pollSeconds * 1000;
    this.latest.quiet = this.inQuietHours();
    if (c.demo) {
      this.latest = { aircraft: [], fetchedAt: Date.now(), error: null, quiet: false, remaining: null };
      this.broadcast();
      this.timer = setTimeout(() => this.poll(), 1000);
      return;
    }
    if (this.latest.quiet) wait = 60000;
    else {
      try {
        const snap = await this.client.states(this.box, c.geoidM);
        this.latest = { aircraft: snap.aircraft, fetchedAt: Date.now(), error: null, quiet: false, remaining: snap.remaining };
      } catch (error) {
        this.latest.error = error.message;
        if (error.retryAfterSeconds) wait = error.retryAfterSeconds * 1000;
        Log.error(`MMM-PlaneHorizon: ${error.message}`);
      }
    }
    this.broadcast();
    this.timer = setTimeout(() => this.poll(), Math.max(10000, Math.min(wait, 86400000)));
  },

  stop() { clearTimeout(this.timer); },

  broadcast() {
    let aircraft = this.latest.aircraft;
    if (this.config.demo) {
      const period = 300, start = Math.floor(Date.now() / 1000 / period) * period; // fly the demo loop every 5 minutes
      const demo = demoAircraft(this.config.center.lat, this.config.center.lon, start, this.config.geoidM);
      for (const d of demo) this.info.set(`${d.aircraft.icao24}/DEMO`, { at: Date.now(), value: d.info });
      aircraft = aircraft.concat(demo.map(d => d.aircraft));
    }
    this.sendSocketNotification("PLANEHORIZON_AIRCRAFT", Object.assign({}, this.latest, { aircraft }));
  },

  async lookup(icao24, callsign) {
    const key = `${icao24}/${callsign}`;
    const hit = this.info.get(key);
    if (hit && Date.now() - hit.at < (hit.value.found ? 6 * 3600e3 : 1800e3)) {
      this.sendSocketNotification("PLANEHORIZON_INFO", { icao24, info: hit.value });
      return;
    }
    if (this.config && this.config.demo) return;
    if (!/^[a-f0-9]{6}$/i.test(icao24) || this.pending.size >= 8 || this.pending.has(key)) return;
    this.pending.set(key, true);
    try {
      const value = await describe(icao24, callsign);
      this.info.set(key, { at: Date.now(), value });
      if (this.info.size > 1000) this.info.delete(this.info.keys().next().value);
      this.sendSocketNotification("PLANEHORIZON_INFO", { icao24, info: value });
    } finally {
      this.pending.delete(key);
    }
  },
});
