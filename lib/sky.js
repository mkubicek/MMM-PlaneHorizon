/* Where is an aircraft in the sky of an observer, and can it be seen through that observer's
 * opening (balcony or window) above the measured horizon? Pure geometry, no DOM.
 * Loaded as a browser script by MagicMirror (global PlaneHorizonSky) and required by the tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlaneHorizonSky = factory();
})(this, function () {
  const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

  function ecef(lat, lon, h) {
    const φ = rad(lat), λ = rad(lon), n = A / Math.sqrt(1 - E2 * Math.sin(φ) ** 2);
    return [(n + h) * Math.cos(φ) * Math.cos(λ), (n + h) * Math.cos(φ) * Math.sin(λ), (n * (1 - E2) + h) * Math.sin(φ)];
  }

  /** Azimuth/elevation/range from the observer's eye to a point; heights above the WGS84 ellipsoid. */
  function look(obs, lat, lon, h) {
    const [ox, oy, oz] = ecef(obs.lat, obs.lon, obs.eyeEllipsoidal);
    const [px, py, pz] = ecef(lat, lon, h);
    const dx = px - ox, dy = py - oy, dz = pz - oz, φ = rad(obs.lat), λ = rad(obs.lon);
    const e = -Math.sin(λ) * dx + Math.cos(λ) * dy;
    const n = -Math.sin(φ) * Math.cos(λ) * dx - Math.sin(φ) * Math.sin(λ) * dy + Math.cos(φ) * dz;
    const u = Math.cos(φ) * Math.cos(λ) * dx + Math.cos(φ) * Math.sin(λ) * dy + Math.sin(φ) * dz;
    return { az: (deg(Math.atan2(e, n)) + 360) % 360, el: deg(Math.atan2(u, Math.hypot(e, n))), range: Math.hypot(e, n, u), ground: Math.hypot(e, n) };
  }

  /** Signed angle from the facade normal, -180..180; negative is left when looking out. */
  const relative = (obs, az) => ((az - obs.facingDeg + 540) % 360) - 180;

  function interp(arr, step, az) {
    const i = az / step, i0 = Math.floor(i) % arr.length, i1 = (i0 + 1) % arr.length, t = i - Math.floor(i);
    if (arr[i0] == null) return arr[i1];
    if (arr[i1] == null) return arr[i0];
    return arr[i0] * (1 - t) + arr[i1] * t;
  }

  /**
   * Horizon at an azimuth. With a `landscape` layer (terrain, buildings, forest as a mass; no
   * single trees) that is the horizon, full stop; otherwise terrain/buildings plus near trees.
   */
  function horizonAt(obs, step, az) {
    const k = Math.round(az / step) % obs.terrainDistM.length;
    if (obs.landscape) {
      const land = interp(obs.landscape, step, az);
      return { terrain: land, trees: land, terrainDist: obs.terrainDistM[k], treesDist: obs.terrainDistM[k] };
    }
    return { terrain: interp(obs.terrain, step, az), trees: interp(obs.trees, step, az), terrainDist: obs.terrainDistM[k], treesDist: obs.treesDistM[k] };
  }

  /** Highest elevation visible through the opening at relative angle φ, or null where its side blocks. */
  function apertureTop(obs, φ) {
    const a = obs.aperture, c = Math.cos(rad(φ));
    if (Math.abs(φ) >= 90) return null;
    if (a.type === "open") return Math.abs(φ) <= a.halfWidthDeg ? a.maxElevation : null;
    if (a.type === "balcony") {
      const toEdge = Math.max(a.slabDepthM - obs.offsetM, 0.05) / c; // horizontal run to the slab edge above
      return deg(Math.atan2(a.soffitAboveEyeM, toEdge));
    }
    const behind = -obs.offsetM; // eye distance behind the glass
    // Where a panorama showed the real walls (obs.blocked), those set the sides, not this window model.
    if (!obs.blocked && Math.tan(rad(Math.abs(φ))) * behind > a.halfWidthM) return null;
    return deg(Math.atan2(a.lintelAboveEyeM * c, behind));
  }

  /** Directions a panorama showed as wall (balcony wall, window frame, own facade). */
  function blockedAt(obs, az) {
    return (obs.blocked || []).some(([from, to]) => (from <= to ? az >= from && az <= to : az >= from || az <= to));
  }

  function apertureHalfWidth(obs) {
    const a = obs.aperture;
    if (a.type === "open") return a.halfWidthDeg;
    return a.type === "window" && !obs.blocked ? deg(Math.atan2(a.halfWidthM, -obs.offsetM)) : 90;
  }

  /**
   * status: visible | far | trees (only near trees in the way) | terrain (hill or building)
   *         | frame (the opening blocks: slab, lintel, window side) | behind (other side of the house)
   */
  function classify(obs, step, p, visibleRangeM) {
    const l = look(obs, p.lat, p.lon, p.alt);
    const φ = relative(obs, l.az);
    const h = horizonAt(obs, step, l.az);
    const top = apertureTop(obs, φ);
    let status;
    if (Math.abs(φ) >= 90) status = "behind";
    else if (top == null || blockedAt(obs, l.az)) status = "frame";
    else if (l.el <= h.terrain) status = "terrain";
    else if (l.el <= h.trees) status = "trees";
    else if (l.el > top) status = "frame";
    else if (l.range > (visibleRangeM || 40000)) status = "far";
    else status = "visible";
    return Object.assign({}, l, { φ, horizon: h, top, status });
  }

  /** Straight-line dead reckoning from the last position fix. */
  function extrapolate(ac, atSec) {
    const dt = Math.max(-60, Math.min(atSec - ac.t, 600));
    if (ac.onGround || ac.v == null || ac.track == null) return { lat: ac.lat, lon: ac.lon, alt: ac.alt };
    const d = ac.v * dt, tr = rad(ac.track);
    return {
      lat: ac.lat + deg(d * Math.cos(tr) / 6371000),
      lon: ac.lon + deg(d * Math.sin(tr) / (6371000 * Math.cos(rad(ac.lat)))),
      alt: ac.alt + (ac.vr || 0) * Math.min(dt, 180),
    };
  }

  /** Seconds until the aircraft enters the clear view, scanning ahead; null if not within `ahead`. */
  function nextVisible(obs, step, ac, nowSec, ahead, every, visibleRangeM) {
    for (let s = every; s <= ahead; s += every) {
      if (classify(obs, step, extrapolate(ac, nowSec + s), visibleRangeM).status === "visible") return s;
    }
    return null;
  }

  const compass = az => COMPASS[Math.round(az / 22.5) % 16];

  /** Sun azimuth/elevation (NOAA, ~0.01°; elevation without refraction) for a Date at a place. */
  function sunPosition(date, lat, lon) {
    const jd = date.getTime() / 86400000 + 2440587.5, c = (jd - 2451545) / 36525;
    const l0 = (280.46646 + c * (36000.76983 + c * 0.0003032)) % 360, m = 357.52911 + c * (35999.05029 - 0.0001537 * c);
    const e = 0.016708634 - c * (0.000042037 + 0.0000001267 * c), mr = rad(m);
    const eq = Math.sin(mr) * (1.914602 - c * (0.004817 + 0.000014 * c)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * c) + Math.sin(3 * mr) * 0.000289;
    const om = 125.04 - 1934.136 * c, lam = l0 + eq - 0.00569 - 0.00478 * Math.sin(rad(om));
    const eps = 23 + (26 + (21.448 - c * (46.815 + c * (0.00059 - c * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(rad(om));
    const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lam))), y = Math.pow(Math.tan(rad(eps / 2)), 2), l0r = rad(l0);
    const eot = 4 * deg(y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr));
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60, ha = rad((minutes + eot + 4 * lon) / 4 - 180), la = rad(lat);
    const zen = Math.acos(Math.max(-1, Math.min(1, Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha))));
    return { az: (deg(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(decl) * Math.cos(la))) + 180) % 360, el: 90 - deg(zen) };
  }

  /** Sun right ascension/declination (radians), from the same NOAA series as sunPosition. */
  function sunEquatorial(c) {
    const l0 = (280.46646 + c * (36000.76983 + c * 0.0003032)) % 360, mr = rad(357.52911 + c * (35999.05029 - 0.0001537 * c));
    const eq = Math.sin(mr) * (1.914602 - c * (0.004817 + 0.000014 * c)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * c) + Math.sin(3 * mr) * 0.000289;
    const om = rad(125.04 - 1934.136 * c), lam = rad(l0 + eq - 0.00569 - 0.00478 * Math.sin(om));
    const eps = rad(23 + (26 + (21.448 - c * (46.815 + c * (0.00059 - c * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om));
    return { ra: Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)), dec: Math.asin(Math.sin(eps) * Math.sin(lam)), lon: deg(lam) };
  }

  /**
   * Moon as seen from a place: azimuth/elevation (topocentric, no refraction; Meeus ch. 47 main
   * terms, about 0.1°), illuminated fraction, and `limb`, the direction of the bright limb in
   * degrees from straight up, turning towards the east (to the left as you face the Moon).
   */
  function moonPosition(date, lat, lon) {
    const d = date.getTime() / 86400000 + 2440587.5 - 2451545, t = d / 36525;
    const Lp = 218.3164477 + 481267.88123421 * t, D = rad(297.8501921 + 445267.1114034 * t);
    const M = rad(357.5291092 + 35999.0502909 * t), Mp = rad(134.9633964 + 477198.8675055 * t), F = rad(93.272095 + 483202.0175233 * t);
    const s = Math.sin, co = Math.cos;
    const lonE = Lp + 6.288774 * s(Mp) + 1.274027 * s(2 * D - Mp) + 0.658314 * s(2 * D) + 0.213618 * s(2 * Mp) - 0.185116 * s(M) -
      0.114332 * s(2 * F) + 0.058793 * s(2 * D - 2 * Mp) + 0.057066 * s(2 * D - M - Mp) + 0.053322 * s(2 * D + Mp) +
      0.045758 * s(2 * D - M) - 0.040923 * s(M - Mp) - 0.03472 * s(D) - 0.030383 * s(M + Mp);
    const latE = 5.128122 * s(F) + 0.280602 * s(Mp + F) + 0.277693 * s(Mp - F) + 0.173237 * s(2 * D - F) +
      0.055413 * s(2 * D - F + Mp) + 0.046271 * s(2 * D - F - Mp) + 0.032573 * s(2 * D + F) + 0.017198 * s(2 * Mp + F);
    const dist = 385000.56 - 20905.355 * co(Mp) - 3699.111 * co(2 * D - Mp) - 2955.968 * co(2 * D) - 569.925 * co(2 * Mp);
    const eps = rad(23.439291 - 0.0130042 * t), l = rad(lonE), b = rad(latE);
    const ra = Math.atan2(s(l) * co(eps) - Math.tan(b) * s(eps), co(l)), dec = Math.asin(s(b) * co(eps) + co(b) * s(eps) * s(l));
    const lst = rad(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t + lon), H = lst - ra, la = rad(lat);
    const geoEl = Math.asin(Math.max(-1, Math.min(1, s(la) * s(dec) + co(la) * co(dec) * co(H))));
    const el = deg(geoEl) - deg(Math.asin(6378.14 / dist)) * co(geoEl); // parallax: up to ~1° near the horizon
    const az = (deg(Math.atan2(s(H), co(H) * s(la) - Math.tan(dec) * co(la))) + 180) % 360;
    // phase and which way the lit side faces, turned from celestial north to the local vertical
    const sun = sunEquatorial(t), dra = sun.ra - ra;
    const psi = Math.acos(Math.max(-1, Math.min(1, s(sun.dec) * s(dec) + co(sun.dec) * co(dec) * co(dra))));
    const phase = Math.atan2(149598000 * s(psi), dist - 149598000 * co(psi));
    const chi = Math.atan2(co(sun.dec) * s(dra), s(sun.dec) * co(dec) - co(sun.dec) * s(dec) * co(dra));
    const q = Math.atan2(s(H), Math.tan(la) * co(dec) - s(dec) * co(H));
    return { az, el, illumination: (1 + co(phase)) / 2, limb: ((deg(chi - q) % 360) + 360) % 360,
      waxing: ((lonE - sun.lon) % 360 + 360) % 360 < 180 };
  }

  return { sunPosition, moonPosition, look, relative, horizonAt, apertureTop, apertureHalfWidth, blockedAt, classify, extrapolate, nextVisible, compass };
});
