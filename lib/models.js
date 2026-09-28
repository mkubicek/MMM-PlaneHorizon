/* What an aircraft looks like in 3D: low-poly models (45-146 triangles) generated from real dimensions
 * per family (engine count and mount, tail type, high/low wing, 747 hump, A380 double deck, wingtips,
 * props, struts, rotors), ~80 ICAO types, airline tail colours, and a flat-shaded, sun-lit renderer.
 * Body frame: x right, y forward, z up, metres. Browser global PlaneHorizonModels; require() in tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlaneHorizonModels = factory();
})(this, function () {
  const P = {
    // family specs: L length, D fuselage diameter, span, sweep°, chord (root), wing: low|high,
    // eng: [count, mount: wing|tail|prop|nose, nacelle diameter], tail: conv|t|cruciform|twin, tip: winglet style
    a320: { L: 37.6, D: 3.95, span: 34.1, sweep: 25, chord: 6.0, eng: [2, "wing", 2.0], tail: "conv", tip: "fence" },
    a320neo: { L: 37.6, D: 3.95, span: 35.8, sweep: 25, chord: 6.0, eng: [2, "wing", 2.4], tail: "conv", tip: "sharklet" },
    a220: { L: 38.7, D: 3.5, span: 35.1, sweep: 25, chord: 5.4, eng: [2, "wing", 2.1], tail: "conv", tip: "small" },
    b737: { L: 39.5, D: 3.76, span: 35.8, sweep: 25, chord: 5.5, eng: [2, "wing", 1.9], tail: "conv", tip: "blended" },
    b737max: { L: 39.5, D: 3.76, span: 35.9, sweep: 25, chord: 5.5, eng: [2, "wing", 2.1], tail: "conv", tip: "scimitar" },
    b757: { L: 47.3, D: 3.76, span: 38.0, sweep: 25, chord: 7.0, eng: [2, "wing", 2.2], tail: "conv", tip: "blended" },
    b767: { L: 54.9, D: 5.03, span: 47.6, sweep: 31, chord: 8.6, eng: [2, "wing", 2.7], tail: "conv", tip: "blended" },
    b777: { L: 73.9, D: 6.2, span: 64.8, sweep: 31, chord: 11, eng: [2, "wing", 3.4], tail: "conv", tip: "raked" },
    b787: { L: 62.8, D: 5.8, span: 60.1, sweep: 32, chord: 9.5, eng: [2, "wing", 3.0], tail: "conv", tip: "raked", flex: true },
    a330: { L: 63.7, D: 5.64, span: 60.3, sweep: 30, chord: 10, eng: [2, "wing", 2.7], tail: "conv", tip: "blended" },
    a340: { L: 63.7, D: 5.64, span: 60.3, sweep: 30, chord: 10, eng: [4, "wing", 2.2], tail: "conv", tip: "blended" },
    a350: { L: 66.8, D: 5.96, span: 64.8, sweep: 31, chord: 10, eng: [2, "wing", 3.0], tail: "conv", tip: "curved", flex: true },
    a380: { L: 72.7, D: 7.1, deck: 1.35, span: 79.8, sweep: 33, chord: 15, eng: [4, "wing", 2.9], tail: "conv", tip: "fence" },
    b747: { L: 70.6, D: 6.5, hump: true, span: 64.4, sweep: 37, chord: 12, eng: [4, "wing", 2.5], tail: "conv", tip: "blended" },
    ejet: { L: 36.2, D: 3.0, span: 28.7, sweep: 25, chord: 5.0, eng: [2, "wing", 1.6], tail: "conv", tip: "blended" },
    crj: { L: 36.2, D: 2.7, span: 24.9, sweep: 26, chord: 4.0, eng: [2, "tail", 1.4], tail: "t", tip: "blended" },
    dash8: { L: 32.8, D: 2.7, span: 28.4, sweep: 0, chord: 2.8, wing: "high", eng: [2, "prop", 1.2], tail: "t", tip: "none" },
    atr: { L: 27.2, D: 2.6, span: 27.1, sweep: 0, chord: 2.6, wing: "high", eng: [2, "prop", 1.1], tail: "t", tip: "none" },
    bizjet: { L: 20.0, D: 2.2, span: 19.0, sweep: 28, chord: 3.0, eng: [2, "tail", 1.1], tail: "t", tip: "blended" },
    trijet: { L: 23.4, D: 2.4, span: 26.2, sweep: 33, chord: 3.8, eng: [3, "tail", 1.1], tail: "cruciform", tip: "blended" },
    pc12: { L: 14.4, D: 1.6, span: 16.3, sweep: 0, chord: 1.9, eng: [1, "nose", 0.9], tail: "t", tip: "small" },
    pc24: { L: 16.9, D: 1.8, span: 17.0, sweep: 10, chord: 2.2, eng: [2, "tail", 1.0], tail: "t", tip: "small" },
    cessna: { L: 8.3, D: 1.1, span: 11.0, sweep: 0, chord: 1.5, wing: "high", strut: true, eng: [1, "nose", 0.8], tail: "conv", tip: "none" },
    lowwing: { L: 8.1, D: 1.1, span: 11.9, sweep: 0, chord: 1.4, eng: [1, "nose", 0.8], tail: "t", tip: "none" },
    heli: { L: 13.0, D: 1.8, heli: true, rotor: 10.4 },
    fighter: { L: 17.1, D: 1.4, span: 12.3, sweep: 40, chord: 5.5, eng: [0], tail: "twin", tip: "none", fighter: true },
    lifter: { L: 29.8, D: 4.2, span: 40.4, sweep: 0, chord: 4.2, wing: "high", eng: [4, "prop", 1.2], tail: "conv", tip: "none" },
  };

  const TYPE = { // ICAO type -> [family, length override]
    A318: ["a320", 31.4], A319: ["a320", 33.8], A320: ["a320"], A321: ["a320", 44.5], A19N: ["a320neo", 33.8], A20N: ["a320neo"], A21N: ["a320neo", 44.5],
    BCS1: ["a220", 35.0], BCS3: ["a220"],
    B733: ["b737", 33.4], B734: ["b737", 36.4], B737: ["b737", 33.6], B738: ["b737"], B739: ["b737", 42.1], B37M: ["b737max", 35.6], B38M: ["b737max"], B39M: ["b737max", 42.2],
    B752: ["b757"], B753: ["b757", 54.4], B762: ["b767", 48.5], B763: ["b767"], B764: ["b767", 61.4],
    B772: ["b777", 63.7], B77L: ["b777", 63.7], B77W: ["b777"], B778: ["b777", 70.9], B779: ["b777", 76.7],
    B788: ["b787", 56.7], B789: ["b787"], B78X: ["b787", 68.3],
    A332: ["a330", 58.8], A333: ["a330"], A338: ["a330", 58.8], A339: ["a330"], A343: ["a340"], A346: ["a340", 75.4], A359: ["a350"], A35K: ["a350", 73.8], A388: ["a380"],
    B744: ["b747"], B748: ["b747", 76.3],
    E170: ["ejet", 29.9], E75L: ["ejet", 31.7], E75S: ["ejet", 31.7], E190: ["ejet"], E195: ["ejet", 38.7], E290: ["ejet"], E295: ["ejet", 41.5],
    CRJ2: ["crj", 26.8], CRJ7: ["crj", 32.5], CRJ9: ["crj"], CRJX: ["crj", 39.1],
    DH8D: ["dash8"], AT43: ["atr", 22.7], AT45: ["atr", 22.7], AT46: ["atr", 22.7], AT72: ["atr"], AT75: ["atr"], AT76: ["atr"], SF34: ["atr", 19.7], D328: ["atr", 21.3],
    PC12: ["pc12"], PC24: ["pc24"], C208: ["cessna", 11.5], C172: ["cessna"], C182: ["cessna", 8.8], C152: ["cessna", 7.3], P28A: ["lowwing"], PA46: ["lowwing", 8.8],
    DA40: ["lowwing"], DA42: ["lowwing", 8.6], DA62: ["lowwing", 9.2], SR22: ["lowwing", 7.9], SR20: ["lowwing", 7.9], TBM9: ["pc12", 10.7], TBM8: ["pc12", 10.7],
    FA7X: ["trijet"], FA8X: ["trijet", 24.5], FA50: ["trijet", 18.5], F2TH: ["bizjet", 20.2],
    C130: ["lifter"], A400: ["lifter", 45.1], F18H: ["fighter"], F18S: ["fighter"], F35: ["fighter", 15.7],
  };
  const SHAPE_FALLBACK = { narrow: "a320", wide: "a330", quad: "a340", tailjet: "bizjet", prop: "atr", light: "cessna", heli: "heli", fighter: "fighter" };

  // Tail colours (slightly muted for a mirror), by airline ICAO prefix.
  const LIVERY = {
    SWR: "#d0212d", EDW: "#6a1f2e", DLH: "#10244a", CLH: "#10244a", EZY: "#f06a1c", EJU: "#f06a1c", EZS: "#f06a1c", RYR: "#123c8f", RUK: "#123c8f",
    KLM: "#1f9bd6", AFR: "#1b2d6b", BAW: "#1c3a70", AUA: "#d0212d", UAE: "#c4262e", QTR: "#5b1a2e", THY: "#c8102e", WZZ: "#b0237e", GWI: "#9b1b3d",
    EWG: "#9b1b3d", VLG: "#f2c200", TAP: "#1f8a50", SAS: "#16305f", PGT: "#f2a900", EXS: "#d4162c", TUI: "#5cb8e6", TOM: "#5cb8e6", CFG: "#f0b800",
    HBN: "#222", IBE: "#c8102e", NOZ: "#c8102e", NAX: "#c8102e", NSZ: "#c8102e", UAL: "#1f3f7a", DAL: "#1d2f5c", ACA: "#222", AEE: "#1a4c8b",
    DLA: "#1f5aa6", LOT: "#16305f", FIN: "#e6e6e6", ICE: "#1f3f7a", ELY: "#1f3f7a", SIA: "#1f3f7a", CPA: "#1f6f5f", ETD: "#8c6d46", BEL: "#b3162f",
    CTN: "#1f3f7a", SXS: "#f2a900", LGL: "#4aa3d9", AZA: "#1f8a50", ITY: "#1f5aa6", SVA: "#1f6f5f", MSR: "#1f3f7a", RAM: "#c8102e", OMA: "#8c6d46",
    FDX: "#4b2a7b", UPS: "#4a3322", DHK: "#f2c200", BCS: "#f2c200", CLX: "#1f3f7a", REGA: "#d0212d", SUI: "#555", SWU: "#d0212d",
  };

  function family(icaoType, shape) {
    const t = TYPE[(icaoType || "").toUpperCase()];
    if (t) return Object.assign({}, P[t[0]], t[1] ? { L: t[1] } : {}, { key: t[0] });
    const k = SHAPE_FALLBACK[shape] || "a320";
    return Object.assign({}, P[k], { key: k });
  }

  const CACHE = new Map();
  function modelFor(icaoType, shape, callsign) {
    const prefix = /^[A-Z]{3}\d/.test(callsign || "") ? callsign.slice(0, 3) : "";
    const id = `${icaoType}|${shape}|${prefix}`;
    if (!CACHE.has(id)) CACHE.set(id, build(family(icaoType, shape), LIVERY[prefix]));
    return CACHE.get(id);
  }

  function build(s, tailColor) {
    const tris = [], add = (part, ...pts) => { for (let i = 1; i + 1 < pts.length; i++) tris.push({ part, v: [pts[0], pts[i], pts[i + 1]] }); };
    const colors = { body: "#e9e9e9", wing: "#cfcfcf", engine: "#b9b9b9", tail: tailColor || "#dcdcdc", prop: "rgba(230,230,230,.16)", rotor: "rgba(230,230,230,.14)", dark: "#555" };
    const r = s.D / 2, L = s.L, deck = s.deck || 1, n = 6;
    if (s.heli) return heli(s, add, colors, tris);
    // fuselage: rings along the body; tail cone rises, nose rounds off; 747 hump, A380 double deck
    const ringDefs = [[-L / 2, 0.18, r * 0.9], [-L / 2 + L * 0.2, 1, r * 0.25], [-L / 2 + L * 0.42, 1, 0], [L / 2 - L * 0.12, 1, 0], [L / 2 - L * 0.04, 0.72, -r * 0.1], [L / 2, 0.12, -r * 0.2]];
    const rings = ringDefs.map(([y, k, dz], ri) => Array.from({ length: n }, (_, j) => {
      const a = (j / n) * Math.PI * 2 + Math.PI / n;
      let z = Math.sin(a) * r * k * deck + dz;
      if (s.hump && ri >= 3 && ri <= 4 && Math.sin(a) > 0.2) z += r * 0.55; // 747 upper deck
      return [Math.cos(a) * r * k, y, z];
    }));
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) add("body", rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]);
    // wings
    const high = s.wing === "high", wz = high ? r * 0.85 : -r * 0.45, wy = s.fighter ? -L * 0.05 : L * 0.06;
    const sweepOff = Math.tan(s.sweep * Math.PI / 180) * (s.span / 2 - r), tipChord = s.chord * (s.fighter ? 0.15 : 0.32), dihedral = high ? 0.01 : 0.05;
    const tips = {};
    for (const sg of [-1, 1]) {
      const tipZ = wz + dihedral * s.span / 2 + (s.flex ? s.span * 0.025 : 0);
      const rootLE = [sg * r, wy, wz], rootTE = [sg * r, wy - s.chord, wz];
      const tipLE = [sg * s.span / 2, wy - sweepOff, tipZ], tipTE = [sg * s.span / 2, wy - sweepOff - tipChord, tipZ];
      add("wing", rootLE, tipLE, tipTE, rootTE);
      tips[sg] = tipLE;
      const tc = [sg * s.span / 2, wy - sweepOff - tipChord * 0.5, tipZ];
      if (s.tip === "sharklet" || s.tip === "blended" || s.tip === "curved") add("tail", tipLE, [tipLE[0] + sg * 0.2, tipLE[1] - tipChord * 0.9, tipZ + s.span * 0.06], tipTE);
      if (s.tip === "scimitar") { add("tail", tipLE, [tipLE[0], tipLE[1] - tipChord, tipZ + s.span * 0.055], tipTE); add("tail", tipLE, [tipLE[0], tipLE[1] - tipChord * 0.6, tipZ - s.span * 0.025], tipTE); }
      if (s.tip === "raked") add("wing", tipLE, [tipLE[0] + sg * s.span * 0.04, tipTE[1] - tipChord * 0.3, tipZ], tipTE);
      if (s.tip === "fence") add("tail", [tc[0], tc[1] + tipChord * 0.6, tipZ + 0.9], [tc[0], tc[1] - tipChord * 0.6, tipZ + 0.9], [tc[0], tc[1] - tipChord * 0.6, tipZ - 0.6], [tc[0], tc[1] + tipChord * 0.6, tipZ - 0.6]);
      if (s.strut) add("dark", [sg * r * 0.8, wy - s.chord * 0.3, -r * 0.7], [sg * s.span * 0.3, wy - s.chord * 0.3, wz], [sg * s.span * 0.3, wy - s.chord * 0.5, wz], [sg * r * 0.8, wy - s.chord * 0.5, -r * 0.7]);
    }
    // engines: nacelles under the wing, on the tail, or propellers
    const [count, mount, nd] = s.eng || [0];
    const nacelle = (cx, cy, cz, len, d, part = "engine") => {
      const ring = (y, k) => Array.from({ length: 5 }, (_, j) => { const a = (j / 5) * Math.PI * 2; return [cx + Math.cos(a) * d / 2 * k, y, cz + Math.sin(a) * d / 2 * k]; });
      const front = ring(cy + len / 2, 1), back = ring(cy - len / 2, 0.7);
      for (let j = 0; j < 5; j++) add(part, front[j], front[(j + 1) % 5], back[(j + 1) % 5], back[j]);
      add("dark", ...front);
    };
    const spanPos = count >= 4 ? [0.34, 0.62] : [0.34];
    if (mount === "wing") for (const sg of [-1, 1]) for (const f of spanPos) {
      // hung under the leading edge: the intake a nacelle-diameter ahead of it, the exhaust under the wing
      const x = sg * (r + (s.span / 2 - r) * f), y = wy - Math.tan(s.sweep * Math.PI / 180) * (s.span / 2 - r) * f + nd * 0.15;
      nacelle(x, y, wz - nd * 0.6, nd * 2.1, nd);
    }
    if (mount === "tail") {
      for (const sg of [-1, 1]) nacelle(sg * (r + nd * 0.55), -L / 2 + L * 0.2, r * 0.35, nd * 2.4, nd);
      if (count === 3) nacelle(0, -L / 2 + L * 0.16, r * 1.05, nd * 2.2, nd);
    }
    if (mount === "prop") for (const sg of [-1, 1]) for (const f of (count >= 4 ? [0.3, 0.58] : [0.33])) {
      const x = sg * (r + (s.span / 2 - r) * f);
      nacelle(x, wy + nd * 1.2, wz - nd * 0.3, nd * 3.2, nd);
      disc(add, [x, wy + nd * 2.9, wz - nd * 0.3], s.span * 0.072, "prop");
    }
    if (mount === "nose") disc(add, [0, L / 2 + 0.2, 0], s.span * 0.085, "prop");
    // tail: fin coloured in the airline's colour; T-tail, cruciform or twin fins
    const finH = s.fighter ? r * 2.2 : r * 2.6 + L * 0.02, finChord = Math.max(L * 0.13, 2), finSweep = finH * 0.8;
    const finRootY = -L / 2 + L * 0.03 + finChord, finBaseZ = r * 0.6 + (s.hump ? 0 : 0);
    const fin = (x, cant) => add("tail", [x, finRootY, finBaseZ], [x + cant, finRootY - finSweep, finBaseZ + finH], [x + cant, finRootY - finSweep - finChord * 0.45, finBaseZ + finH], [x, finRootY - finChord, finBaseZ]);
    if (s.tail === "twin") { fin(-r * 0.9, -finH * 0.35); fin(r * 0.9, finH * 0.35); } else fin(0, 0);
    const hsZ = s.tail === "t" ? finBaseZ + finH : s.tail === "cruciform" ? finBaseZ + finH * 0.45 : r * 0.3;
    const hsY = s.tail === "t" ? finRootY - finSweep - 0.2 : s.tail === "cruciform" ? finRootY - finSweep * 0.45 : -L / 2 + L * 0.11;
    const hsSpan = s.span * (s.fighter ? 0.55 : 0.34), hsChord = finChord * 0.75;
    for (const sg of [-1, 1]) add("wing", [0, hsY, hsZ], [sg * hsSpan / 2, hsY - hsChord * 0.9, hsZ + 0.02 * hsSpan], [sg * hsSpan / 2, hsY - hsChord * 1.3, hsZ + 0.02 * hsSpan], [0, hsY - hsChord, hsZ]);
    return { L, tris, colors, lights: { red: tips[-1], green: tips[1], tail: [0, -L / 2, r * 0.4], beacon: [0, 0, r * deck + (s.hump ? r * 0.5 : 0)] } };
  }

  function disc(add, [cx, cy, cz], radius, part) { // propeller / rotor: a faint disc facing forward
    const pts = Array.from({ length: 8 }, (_, j) => { const a = (j / 8) * Math.PI * 2; return [cx + Math.cos(a) * radius, cy, cz + Math.sin(a) * radius]; });
    add(part, ...pts);
  }

  function heli(s, add, colors, tris) {
    const r = s.D / 2, L = s.L, n = 6;
    const pod = [[L * 0.1, 0.9], [L * 0.28, 1], [L * 0.42, 0.55]].map(([y, k]) => Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2; return [Math.cos(a) * r * k, y, Math.sin(a) * r * k * 1.1]; }));
    const tailRing = Array.from({ length: n }, (_, j) => { const a = (j / n) * Math.PI * 2; return [Math.cos(a) * r * 0.18, -L * 0.5, Math.sin(a) * r * 0.18 + r * 0.4]; });
    const rings = [tailRing, ...pod];
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < n; j++) add("body", rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]);
    add("tail", [0, -L * 0.42, r * 0.4], [0, -L * 0.52, r * 1.6], [0, -L * 0.5, r * 0.3]);
    const pts = Array.from({ length: 10 }, (_, j) => { const a = (j / 10) * Math.PI * 2; return [Math.cos(a) * s.rotor / 2, L * 0.22 + Math.sin(a) * s.rotor / 2, r * 1.35]; });
    add("rotor", ...pts);
    return { L, tris, colors, lights: { red: [-r, L * 0.2, 0], green: [r, L * 0.2, 0], tail: [0, -L * 0.5, r * 0.4], beacon: [0, L * 0.2, r * 1.2] } };
  }

  const FAMILIES = Object.keys(P);
  function modelForFamily(key, tailColor) { return build(Object.assign({}, P[key], { key }), tailColor); }

  // ---------- drawing ----------
  const RGB = new Map();
  function rgba(css) { // "#rgb", "#rrggbb" or "rgba(...)" -> [r, g, b, a], cached
    if (!RGB.has(css)) {
      let m = css.match(/^#(..)(..)(..)$/), v;
      if (css.length === 4) v = [...css.slice(1)].map(c => parseInt(c + c, 16)).concat(1);
      else if (m) v = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16), 1];
      else { const n = css.match(/[\d.]+/g).map(Number); v = [n[0], n[1], n[2], n[3] == null ? 1 : n[3]]; }
      RGB.set(css, v);
    }
    return RGB.get(css);
  }

  /**
   * Draw a model in its attitude, seen along `view` (unit vector viewer -> aircraft), with screen axes
   * `rs` (right) and `us` (up) in world ENU, centred at (cx, cy), k px per metre. Faces are flat-shaded
   * by the sun with a rim light, depth-sorted. Returns the lights' screen positions.
   */
  function drawModel(g, model, att, view, rs, us, cx, cy, k, shade) {
    const h = att.track * Math.PI / 180, pitch = att.pitch, bank = att.bank;
    const fwd = [Math.sin(h) * Math.cos(pitch), Math.cos(h) * Math.cos(pitch), Math.sin(pitch)];
    const r0 = [Math.cos(h), -Math.sin(h), 0], u0 = [r0[1] * fwd[2] - r0[2] * fwd[1], r0[2] * fwd[0] - r0[0] * fwd[2], r0[0] * fwd[1] - r0[1] * fwd[0]];
    const cb = Math.cos(bank), sb = Math.sin(bank);
    const right = [r0[0] * cb - u0[0] * sb, r0[1] * cb - u0[1] * sb, r0[2] * cb - u0[2] * sb], up = [u0[0] * cb + r0[0] * sb, u0[1] * cb + r0[1] * sb, u0[2] * cb + r0[2] * sb];
    const world = p => [p[0] * right[0] + p[1] * fwd[0] + p[2] * up[0], p[0] * right[1] + p[1] * fwd[1] + p[2] * up[1], p[0] * right[2] + p[1] * fwd[2] + p[2] * up[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const screen = w => [cx + k * dot(w, rs), cy - k * dot(w, us), dot(w, view)];
    const faces = new Array(model.tris.length);
    for (let i = 0; i < model.tris.length; i++) {
      const t = model.tris[i], w0 = world(t.v[0]), w1 = world(t.v[1]), w2 = world(t.v[2]);
      const ax = w1[0] - w0[0], ay = w1[1] - w0[1], az = w1[2] - w0[2], bx = w2[0] - w0[0], by = w2[1] - w0[1], bz = w2[2] - w0[2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const facing = nx * view[0] + ny * view[1] + nz * view[2];
      if (facing > 0) { nx = -nx; ny = -ny; nz = -nz; } // light the side we see
      const rim = (1 - Math.abs(facing)) ** 2 * 0.35;
      const sun = Math.max(0, nx * shade.sunV[0] + ny * shade.sunV[1] + nz * shade.sunV[2]);
      const light = shade.night ? 0.1 + rim * 0.5 : 0.48 + 0.52 * sun * shade.day + rim;
      const s0 = screen(w0), s1 = screen(w1), s2 = screen(w2);
      faces[i] = { s0, s1, s2, depth: s0[2] + s1[2] + s2[2], light, part: t.part };
    }
    faces.sort((a, b) => b.depth - a.depth);
    for (const f of faces) {
      const [r, gr, b, a] = rgba(model.colors[f.part]), l = Math.min(1, f.light) * shade.base;
      const col = `rgba(${Math.round(r * l)},${Math.round(gr * l)},${Math.round(b * l)},${a})`;
      g.fillStyle = col;
      g.beginPath(); g.moveTo(f.s0[0], f.s0[1]); g.lineTo(f.s1[0], f.s1[1]); g.lineTo(f.s2[0], f.s2[1]); g.closePath(); g.fill();
      if (a === 1) { g.strokeStyle = col; g.lineWidth = 0.35; g.stroke(); } // close hairline gaps between faces
    }
    const out = {};
    for (const [name, p] of Object.entries(model.lights)) { const s = screen(world(p)); out[name] = [s[0], s[1]]; }
    return out;
  }

  return { FAMILIES, TYPE, LIVERY, modelFor, modelForFamily, drawModel };
});
