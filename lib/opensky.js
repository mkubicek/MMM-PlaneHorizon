/* OpenSky Network client (OAuth client credentials), state parsing, and type/route lookup
 * from adsbdb.com. Node only. Plain `https` and ES2018, so it runs on the Pi's Node 10 as
 * well as inside MagicMirror's Electron. */
const https = require("https");
const { URL, URLSearchParams } = require("url");

const TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const STATES_URL = "https://opensky-network.org/api/states/all";
const ADSBDB_URL = "https://api.adsbdb.com/v0/";

function request(url, options) {
  const o = options || {};
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: o.method || "GET", headers: o.headers || {} }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.setTimeout(o.timeoutMs || 20000, () => req.destroy(new Error(`timeout ${u.hostname}`)));
    req.on("error", reject);
    if (o.body) req.write(o.body);
    req.end();
  });
}

/** Lat/lon box around a point; OpenSky charges 1 credit for any box under 25 square degrees. */
function boundingBox(lat, lon, radiusKm) {
  const dLat = radiusKm / 111.2, dLon = radiusKm / (111.2 * Math.cos(lat * Math.PI / 180));
  const r = n => Math.round(n * 1e4) / 1e4;
  return { lamin: r(Math.max(-90, lat - dLat)), lomin: r(Math.max(-180, lon - dLon)), lamax: r(Math.min(90, lat + dLat)), lomax: r(Math.min(180, lon + dLon)) };
}

/**
 * OpenSky `states/all` rows -> aircraft. Heights are made ellipsoidal: geo_altitude is GNSS height,
 * barometric altitude is roughly above sea level and gets the local geoid undulation added.
 */
function parseStates(body, geoidM) {
  return (body.states || [])
    .filter(s => s[5] != null && s[6] != null)
    .map(s => ({
      icao24: s[0], callsign: (s[1] || "").trim(), country: s[2], t: s[3] != null ? s[3] : s[4],
      lon: s[5], lat: s[6], onGround: Boolean(s[8]), v: s[9], track: s[10], vr: s[11],
      alt: s[13] != null ? s[13] : s[7] != null ? s[7] + geoidM : null, category: s[17],
    }))
    .filter(a => a.alt != null || a.onGround);
}

class OpenSky {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.token = null;
  }

  async bearer() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    const r = await request(TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: this.clientId, client_secret: this.clientSecret }).toString(),
    });
    if (r.status !== 200) throw new Error(`OpenSky login failed (HTTP ${r.status})`);
    const body = JSON.parse(r.body);
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
    return this.token.value;
  }

  /** One snapshot of all aircraft in the box. Throws with `retryAfterSeconds` when rate limited. */
  async states(box, geoidM) {
    const headers = this.clientId ? { Authorization: `Bearer ${await this.bearer()}` } : {};
    const r = await request(`${STATES_URL}?${new URLSearchParams(Object.assign({}, box, { extended: 1 }))}`, { headers });
    if (r.status === 401) this.token = null;
    if (r.status === 429) {
      const error = new Error("OpenSky daily credits used up");
      error.retryAfterSeconds = Math.max(10, Math.min(86400, Number(r.headers["x-rate-limit-retry-after-seconds"]) || 600));
      throw error;
    }
    if (r.status !== 200) throw new Error(`OpenSky HTTP ${r.status}`);
    const body = JSON.parse(r.body);
    return { time: body.time, aircraft: parseStates(body, geoidM), remaining: r.headers["x-rate-limit-remaining"] };
  }
}

/** Type, registration and scheduled route from adsbdb.com (free, no key). Routes can be wrong. */
async function describe(icao24, callsign) {
  const get = async path => {
    try {
      const r = await request(ADSBDB_URL + path, { headers: { "User-Agent": "MMM-PlaneHorizon" }, timeoutMs: 8000 });
      return r.status === 200 ? JSON.parse(r.body).response : null;
    } catch (e) { return null; }
  };
  const [aircraft, route] = await Promise.all([get(`aircraft/${icao24}`), callsign ? get(`callsign/${encodeURIComponent(callsign)}`) : null]);
  const ac = aircraft && aircraft.aircraft, fr = route && route.flightroute;
  const airport = a => a ? { iata: a.iata_code, icao: a.icao_code, city: a.municipality } : null;
  return {
    found: Boolean(ac || fr),
    icaoType: ac ? ac.icao_type : null, type: ac ? ac.type : null, manufacturer: ac ? ac.manufacturer : null,
    registration: ac ? ac.registration : null,
    operator: (fr && fr.airline && fr.airline.name) || (ac && ac.registered_owner) || null,
    flight: fr ? fr.callsign_iata : null,
    origin: airport(fr && fr.origin), destination: airport(fr && fr.destination),
  };
}

/** Clearly fake aircraft around a point, so every state can be checked on the mirror. */
function demoAircraft(lat, lon, startSec, geoidM) {
  const at = (az, d) => ({ lat: lat + d * Math.cos(az * Math.PI / 180) / 111195, lon: lon + d * Math.sin(az * Math.PI / 180) / (111195 * Math.cos(lat * Math.PI / 180)) });
  const plane = (n, type, airline, az, d, altM, track, v, vr, from, to) => ({
    aircraft: Object.assign({ icao24: `d0000${n}`, callsign: "DEMO", t: startSec, alt: altM + geoidM, v, track, vr, onGround: false }, at(az, d)),
    info: { found: true, icaoType: type, operator: `${airline} (demo)`, origin: { iata: from }, destination: { iata: to } },
  });
  return [
    plane(1, "A21N", "SWISS", 250, 21000, 10600, 20, 230, 0, "GVA", "VIE"),
    plane(2, "DH8D", "Austrian", 60, 9000, 2800, 205, 110, -4, "GRZ", "ZRH"),
    plane(3, "CRJ9", "Lufthansa", 285, 32000, 3200, 105, 140, 0, "BSL", "MUC"),
    plane(4, "B789", "Edelweiss", 330, 14000, 1400, 150, 95, 0, "DEN", "ZRH"),
    plane(5, "A388", "Emirates", 150, 6000, 11200, 60, 240, 0, "DXB", "CPH"),
  ];
}

module.exports = { OpenSky, boundingBox, parseStates, describe, demoAircraft };
