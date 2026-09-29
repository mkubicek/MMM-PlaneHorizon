/* The widget: each opening's view (balcony, bedroom) side by side as you face the mirror, its
 * measured landscape horizon as a hairline that fades out where the walls begin, the real sun,
 * and the aircraft you can see as lit 3D models in their true attitude and size, with contrails by
 * day and navigation lights by night. Labels follow their aircraft and switch sides only when they
 * have to. Canvas 2D at a few frames per second; each aircraft is a cached sprite, re-rendered only
 * when its view has visibly changed. Browser global PlaneHorizonView; pure helpers are exported
 * for the tests. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./sky"), require("./aircraft"), require("./models"));
  else root.PlaneHorizonView = factory(root.PlaneHorizonSky, root.PlaneHorizonAircraft, root.PlaneHorizonModels);
})(this, function (Sky, Craft, Models) {
  const L1 = 15, L2 = 12, LS = 12, LABEL_H = 31, SHORT_H = 14, SKY_CLEARANCE = 7, FULL_PER_VIEW = 2;

  // ---------- pure geometry ----------

  /**
   * azimuth/elevation -> x/y on a 360° panorama centred on the direction you face when looking
   * at the mirror: what is on your left in the flat is on the left of the strip, and what is
   * behind you wraps around both edges.
   */
  function stripGeometry(W, H, centerAz, elMax, pad) {
    const rel = az => ((((az - centerAz) % 360) + 540) % 360) - 180; // -180..180, 0 = straight ahead
    const x = az => (rel(az) + 180) / 360 * W;
    // Slightly stretched near the horizon, where aircraft crowd just above the ridge.
    const y = el => pad + (H - pad) * (1 - Math.pow(Math.max(0, Math.min(el, elMax)) / elMax, 0.65));
    return { W, H, centerAz, rel, x, y };
  }

  /** Split a line where it crosses the strip's edge (straight behind you), so it never streaks across. */
  function runs(points, W) {
    const out = [];
    let run = [];
    for (const p of points) {
      if (run.length && Math.abs(p[0] - run[run.length - 1][0]) > W / 2) { out.push(run); run = []; }
      run.push(p);
    }
    out.push(run);
    return out.filter(r => r.length > 1);
  }

  /** The mirror's default viewing direction: the first opening ends up on the left. */
  const defaultFacing = observers => (observers[0].facingDeg + 90) % 360;

  /**
   * The line as drawn: the measured horizon (terrain or trees), calmed for the eye, every 0.5°.
   * A median over `smoothDeg` removes tree-top jitter and pixel noise but keeps real steps
   * (building walls, the ridge meeting a valley) sharp; a light average over half that width
   * takes the remaining edge off. smoothDeg 0 draws the exact horizon. Visibility is always
   * decided on the exact horizon, never on this line.
   */
  function skyline(obs, step, smoothDeg) {
    const at = φ => Sky.horizonAt(obs, step, (obs.facingDeg + Math.max(-89.75, Math.min(89.75, φ)) + 360) % 360).trees;
    const fine = 0.25, pad = 3, raw = [];
    for (let φ = -90 - pad; φ <= 90 + pad + 1e-9; φ += fine) raw.push(at(φ));
    const med = Math.round((smoothDeg || 0) / fine / 2), avg = Math.round(med / 2);
    const window = (arr, i, r) => arr.slice(Math.max(0, i - r), Math.min(arr.length, i + r + 1)).filter(v => v != null);
    const median = raw.map((v, i) => {
      const w = window(raw, i, med).sort((x, y) => x - y);
      return w.length ? w[w.length >> 1] : v;
    });
    const smooth = median.map((v, i) => {
      const w = window(median, i, avg);
      return w.length ? w.reduce((s, x) => s + x, 0) / w.length : v;
    });
    const pts = [];
    for (let φ = -90; φ <= 90 + 1e-9; φ += 0.5) pts.push({ φ, el: smooth[Math.round((φ + 90 + pad) / fine)] });
    return pts;
  }

  /** Straight segments through the points: no curve overshoot between samples. */
  function linePath(pts) {
    return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
  }

  /** Height of the drawn skyline at x, from its sorted [x, y] points. */
  function skyAt(sky, x) {
    const k = sky.findIndex(p => p[0] >= x);
    if (k === 0) return sky[0][1];
    if (k < 0) return sky[sky.length - 1][1];
    const [x0, y0] = sky[k - 1], [x1, y1] = sky[k];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0 || 1);
  }

  const inside = (pt, b, pad) => pt[0] > b.x - pad && pt[0] < b.x + b.w + pad && pt[1] > b.y - pad && pt[1] < b.y + b.h + pad;
  const overlaps = (a, b) => a.x < b.x + b.w + 4 && b.x < a.x + a.w + 4 && a.y < b.y + b.h + 4 && b.y < a.y + a.h + 4;
  /**
   * Pixel-fixed band around the drawn horizon: for each 1 px column, the highest and lowest point
   * of the line within ±3 px. Labels are tested against this band, so a label drifting past a
   * jagged tree line can't flicker between "touches the line" and "doesn't".
   */
  function skyBand(sky, W) {
    const min = new Array(W + 1).fill(Infinity), max = new Array(W + 1).fill(-Infinity);
    const mark = (x, y) => {
      for (let c = Math.max(0, Math.floor(x) - 3); c <= Math.min(W, Math.ceil(x) + 3); c++) {
        min[c] = Math.min(min[c], y);
        max[c] = Math.max(max[c], y);
      }
    };
    for (let i = 0; i < sky.length; i++) {
      mark(sky[i][0], sky[i][1]);
      const next = sky[i + 1];
      if (!next) continue; // points are sorted by x across the whole strip, so neighbours are adjacent
      for (let x = Math.ceil(sky[i][0]); x < next[0]; x++) { // fill between sparse points
        mark(x, sky[i][1] + (next[1] - sky[i][1]) * (x - sky[i][0]) / (next[0] - sky[i][0]));
      }
    }
    return { min, max };
  }

  function hitsBand(band, b) {
    const from = Math.max(0, Math.floor(b.x - 4)), to = Math.min(band.min.length - 1, Math.ceil(b.x + b.w + 4));
    for (let c = from; c <= to; c++) {
      if (band.max[c] > b.y - SKY_CLEARANCE && band.min[c] < b.y + b.h + SKY_CLEARANCE) return true;
    }
    return false;
  }

  /**
   * Every place a label can go around its aircraft: right, left, above-right, above-left, above,
   * below-right, below-left, then the same a little farther out, in that order of preference.
   * `blocked`: leaves the strip or overlaps another label now, never allowed. `onPlane`: covers
   * another aircraft now. `cost`: preference, crossing the horizon line, and trouble ahead: the same
   * side is also checked where the aircraft will be in 15, 30 and 45 s, so a label starts on the
   * side it can keep instead of being forced across later. `placed` entries are earlier labels,
   * `{ box, future }` (or plain boxes).
   */
  function scoreSides(plane, w, h, others, placed, band, W, H) {
    const r = plane.size / 2 + 6;
    const offsets = [
      [r, -h / 2 - 2], [-r - w, -h / 2 - 2], [r - 4, -h - 4], [-r - w + 4, -h - 4], [-w / 2, -h - r], [r - 4, 6], [-r - w + 4, 6],
      [r + 2, -h - 16], [-r - w - 2, -h - 16], [-w / 2, -h - r - 18], [r + 2, 20], [-r - w - 2, 20],
    ];
    const outside = b => b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H + 4;
    const labels = placed.map(q => (q.box ? q : { box: q, future: [] }));
    return offsets.map(([dx, dy], side) => {
      const box = { x: plane.x + dx, y: plane.y + dy, w, h };
      const future = (plane.path || []).map(([px, py]) => ({ x: px + dx, y: py + dy, w, h }));
      const blocked = outside(box) || labels.some(q => overlaps(box, q.box));
      const onPlane = others.some(q => q !== plane && inside([q.x, q.y], box, q.size / 2 + 3));
      let cost = side * 4;
      if (hitsBand(band, box)) cost += 120; // acceptable: the label's black halo breaks the line behind the text
      future.forEach((fb, i) => {
        if (outside(fb)) cost += 50;                            // it would have to leave the strip
        if (hitsBand(band, fb)) cost += 20;
        if (labels.some(q => q.future[i] && overlaps(fb, q.future[i]))) cost += 60;
        if (others.some(q => q !== plane && q.path && q.path[i] && inside(q.path[i], fb, q.size / 2 + 3))) cost += 40;
      });
      return { side, box, future, offset: [dx, dy], blocked, onPlane, cost };
    });
  }

  // Tuned by replaying identical traffic (see README): 1.0 side changes per label-minute instead of 3.3.
  const SETTLE_SECONDS = 15; // a label stays on its side at least this long...
  const WORSE_SECONDS = 8;   // ...and moves for a better spot only after its own stayed worse this long
  const WORSE_MARGIN = 150;  // ...and only when the other spot is clearly better

  /**
   * Where the label goes this second, given where it was (`memo`). Hard conflicts move it at once;
   * a merely worse side is tolerated for a while, so labels don't twitch. `optional` labels (all but
   * the longest-standing one) give up rather than cover another aircraft. Returns null for no label.
   */
  function decideSide(options, memo, now, optional, tuning) {
    const t = tuning || {};
    const settle = t.settle != null ? t.settle : SETTLE_SECONDS, worseFor = t.worse != null ? t.worse : WORSE_SECONDS;
    const margin = t.margin != null ? t.margin : WORSE_MARGIN;
    const usable = options.filter(o => !o.blocked && !(optional && o.onPlane)).map(o => Object.assign({}, o, { total: o.cost + (o.onPlane ? 300 : 0) }));
    if (!usable.length) return null;
    const best = usable.reduce((a, b) => (b.total < a.total ? b : a));
    const current = memo && usable.find(o => o.side === memo.side);
    if (current) {
      if (current.total <= best.total + margin) return Object.assign({}, current, { reason: "keep", memo: { side: current.side, since: memo.since, worseSince: null } });
      const worseSince = memo.worseSince == null ? now : memo.worseSince;
      if (now - worseSince < worseFor || now - memo.since < settle) {
        return Object.assign({}, current, { reason: "wait", memo: { side: current.side, since: memo.since, worseSince } });
      }
    }
    const reason = !memo ? "new" : current ? "better" : "forced"; // forced: the old side is blocked or now covers a plane
    return Object.assign({}, best, { reason, memo: { side: best.side, since: now, worseSince: null } });
  }

  /** A fresh choice without history (first placement). */
  function chooseSide(plane, w, h, others, placed, sky, W, H, optional) {
    return decideSide(scoreSides(plane, w, h, others, placed, skyBand(sky, W), W, H), null, 0, optional);
  }

  /** Visible aircraft plus the soonest arrivals, most worth looking at first. */
  function planesToShow(candidates, maxUpcoming) {
    const upcoming = new Set(candidates.filter(p => !p.visible).sort((a, b) => a.soon - b.soon).slice(0, maxUpcoming).map(p => p.key));
    const score = p => p.c.el - p.c.ground / 2000; // high and close first
    return candidates.filter(p => p.visible || upcoming.has(p.key))
      .sort((a, b) => (b.visible - a.visible) || (a.visible ? score(b) - score(a) : a.soon - b.soon));
  }

  /**
   * Which aircraft get a full two-line label: the most prominent (visible, then largest on screen)
   * per view, at most `perView`. Sticky: a plane that had one keeps it while it is still among the
   * top perView + 1 of its view, so labels don't hop between planes of similar size. Everyone else
   * gets a short one-line label.
   */
  function fullLabelSet(planes, previous, perView) {
    const byView = new Map();
    for (const p of planes) { if (!byView.has(p.view)) byView.set(p.view, []); byView.get(p.view).push(p); }
    const out = new Set();
    for (const list of byView.values()) {
      const ranked = list.slice().sort((a, b) => (b.visible - a.visible) || b.size - a.size);
      const chosen = ranked.slice(0, perView + 1).filter(p => previous.has(p.key)).slice(0, perView);
      for (const p of ranked) { if (chosen.length >= perView) break; if (chosen.indexOf(p) < 0) chosen.push(p); }
      for (const p of chosen) out.add(p.key);
    }
    return out;
  }

  // ---------- text ----------
  const countdown = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const city = a => {
    const c = ((a && a.city) || "").split("/")[0].trim();
    return c && c.length <= 14 ? c : (a && (a.iata || a.icao)) || c;
  };
  /** Line 1: type and airline. Line 2: route by city, altitude when there is no route, or the countdown. */
  function labelText(ac, info, visible, soon, geoidM) {
    const id = Craft.identify(ac, info);
    const title = Craft.shortType(id.typeName) || id.airline || id.flight;
    const airline = id.typeName && id.airline && id.airline !== title ? id.airline : "";
    const route = info && (info.origin || info.destination) ? `${city(info.origin) || "?"} → ${city(info.destination) || "?"}` : "";
    const second = visible ? route || `${((ac.alt - geoidM) / 1000).toFixed(1)} km` : `in ${countdown(soon)}`;
    return { title, airline, second, shape: id.shape };
  }

  // ---------- sizes and light ----------

  /** On-screen size: falls with distance like perspective (softened) and grows with the aircraft's real length. */
  function apparentSize(rangeM, lengthM, scale) {
    const s = 34 * Math.pow(6000 / Math.max(rangeM, 1), 0.6) * Math.pow(lengthM / 38, 0.6) * (scale || 1);
    return Math.max(7, Math.min(44, s));
  }
  /** Far air is paler: 1 up close, down to 0.45 at 60 km. */
  const haze = rangeM => Math.max(0.45, Math.min(1, 1 - (rangeM - 5000) / 60000 * 0.6));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;

  // ---------- the view ----------
  class View {
    constructor(container, horizon, options) {
      this.horizon = horizon;
      this.o = options;
      this.step = horizon.azimuthStepDeg;
      this.home = horizon.observers[0];
      this.geoid = horizon.geoidUndulationM || 0;
      this.W = options.width;
      this.TOP = 12;
      this.BOTTOM = options.height;
      this.H = options.height + 26;
      this.dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
      const facing = options.facingDeg == null ? defaultFacing(horizon.observers) : options.facingDeg;
      this.geo = stripGeometry(this.W, this.BOTTOM, facing, 70, this.TOP);
      this.aircraft = []; this.info = {}; this.feed = {};
      this.memo = new Map(); this.firstSeen = new Map(); this.sprites = new Map(); this.soon = new Map(); this.soonAt = 0;
      this.stats = { frames: 0, frameMs: 0, spriteRenders: 0 };
      this.switches = 0;
      container.innerHTML = '<canvas class="ph-canvas"></canvas><div class="ph-status xsmall dimmed"></div>';
      this.canvas = container.querySelector("canvas");
      this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
      this.canvas.style.width = `${this.W}px`; this.canvas.style.height = `${this.H}px`;
      this.ctx = this.canvas.getContext("2d");
      this.status = container.querySelector(".ph-status");
      this.mount();
      const fps = options.fps || 4;
      this.timer = setInterval(() => this.frame(Date.now() / 1000), 1000 / fps);
    }

    /** Which opening sees this azimuth, if any: in front of its facade, inside its sides, not behind a wall. */
    openingAt(az) {
      for (const o of this.horizon.observers) {
        const φ = Sky.relative(o, az);
        if (Math.abs(φ) < 90) return !Sky.blockedAt(o, az) && Math.abs(φ) <= Sky.apertureHalfWidth(o) && Sky.apertureTop(o, φ) != null ? o : null;
      }
      return null;
    }

    /** The static background: each view's horizon line and ground, the labels under them. Drawn once. */
    mount() {
      const g0 = this.geo, W = this.W, H = this.H, smooth = this.o.lineSmoothingDeg == null ? 3 : this.o.lineSmoothingDeg;
      const panels = [];
      for (let a = g0.centerAz - 180; a <= g0.centerAz + 180.001; a += 0.25) {
        const az = ((a % 360) + 360) % 360, o = this.openingAt(az), x = ((a - (g0.centerAz - 180)) / 360) * W;
        const last = panels[panels.length - 1];
        if (o && last && last.obs === o && x - last.x1 < 1.5) last.x1 = x;
        else if (o) panels.push({ obs: o, x0: x, x1: x });
      }
      this.panels = panels.filter(p => p.x1 - p.x0 > 20);
      if (!this.panels.length) this.panels = [{ obs: this.home, x0: 0, x1: W }]; // no opening data: one plain view
      const bg = document.createElement("canvas");
      bg.width = W * this.dpr; bg.height = H * this.dpr;
      const g = bg.getContext("2d"); g.scale(this.dpr, this.dpr);
      const allPts = [];
      for (const p of this.panels) {
        const pts = skyline(p.obs, this.step, smooth).map(q => [g0.x(p.obs.facingDeg + q.φ), g0.y(q.el)]).filter(([x]) => x >= p.x0 && x <= p.x1).sort((a, b) => a[0] - b[0]);
        allPts.push(...pts);
        const ground = g.createLinearGradient(0, this.TOP + 40, 0, this.BOTTOM);
        ground.addColorStop(0, "#101010"); ground.addColorStop(1, "#000");
        g.beginPath(); g.moveTo(p.x0, this.BOTTOM + 2); pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(p.x1, this.BOTTOM + 2); g.closePath();
        g.fillStyle = ground; g.fill();
        // no frames: the line just ends where the walls begin, fading out
        const e = Math.min(0.12, 14 / (p.x1 - p.x0)), line = g.createLinearGradient(p.x0, 0, p.x1, 0);
        line.addColorStop(0, "rgba(255,255,255,0)"); line.addColorStop(e, "rgba(255,255,255,.7)"); line.addColorStop(1 - e, "rgba(255,255,255,.7)"); line.addColorStop(1, "rgba(255,255,255,0)");
        g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = line; g.lineWidth = 1; g.lineJoin = "round"; g.stroke();
        text(g, `${p.obs.name.toUpperCase()} · ${Sky.compass(p.obs.facingDeg)}`, (p.x0 + p.x1) / 2, H - 6, 10.5, "#555", "center");
      }
      this.background = bg;
      this.band = skyBand(allPts.sort((a, b) => a[0] - b[0]), W);
      // walls between and beside the views: labels stay inside their own view
      const xs = this.panels.map(p => [p.x0, p.x1]).sort((a, b) => a[0] - b[0]);
      this.keepOut = [{ x: -40, y: 0, w: xs[0][0] + 36, h: H }];
      for (let i = 0; i + 1 < xs.length; i++) this.keepOut.push({ x: xs[i][1] - 1, y: 0, w: xs[i + 1][0] - xs[i][1] + 2, h: H });
      this.keepOut.push({ x: xs[xs.length - 1][1] + 4, y: 0, w: 40, h: H });
    }

    /** New data (once a second): aircraft, type/route info, feed state. Returns the aircraft worth describing. */
    update(aircraft, info, feed, nowSec) {
      // turn rate from the previous position report, so turning aircraft bank in the picture
      const before = new Map(this.aircraft.map(a => [a.icao24, a]));
      this.aircraft = aircraft.filter(a => !a.onGround && a.alt != null).map(a => {
        const b = before.get(a.icao24);
        if (!b || a.t === b.t || a.track == null || b.track == null) return Object.assign({}, a, { turn: b ? b.turn || 0 : 0 });
        return Object.assign({}, a, { turn: (((a.track - b.track + 540) % 360) - 180) / (a.t - b.t) });
      });
      this.info = info; this.feed = feed;
      if (nowSec - this.soonAt >= 5) { // "in 1:20": predicted every 5 s, it only changes slowly
        this.soonAt = nowSec; this.soon.clear();
        const range = this.o.visibleRangeKm * 1000;
        for (const ac of this.aircraft) {
          const l = Sky.look(this.home, ac.lat, ac.lon, ac.alt);
          if (l.ground > 60000) continue;
          if (this.horizon.observers.some(o => Sky.classify(o, this.step, Sky.extrapolate(ac, nowSec), range).status === "visible")) continue;
          for (const o of this.horizon.observers) {
            const s = Sky.nextVisible(o, this.step, ac, nowSec, this.o.lookAheadSeconds, 5, range);
            if (s != null) { this.soon.set(ac.icao24, s); break; }
          }
        }
      }
      const shown = this.shown || [];
      return shown.map(p => p.ac);
    }

    /** Draw one frame: background, sun, aircraft (cached 3D sprites), trails, lights, labels. */
    frame(nowSec) {
      const t0 = (typeof performance !== "undefined" ? performance : Date).now();
      const g = this.ctx, o = this.o, W = this.W, H = this.H, geo = this.geo, range = o.visibleRangeKm * 1000;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      const sun = Sky.sunPosition(new Date(nowSec * 1000), this.home.lat, this.home.lon);
      const night = sun.el < -4, sunV = [Math.cos(rad(sun.el)) * Math.sin(rad(sun.az)), Math.cos(rad(sun.el)) * Math.cos(rad(sun.az)), Math.sin(rad(sun.el))];
      // The Moon moves ~0.5° a minute: recompute every 30 s, not every frame.
      if (!this.moon || nowSec - this.moon.at >= 30) this.moon = Object.assign({ at: nowSec }, Sky.moonPosition(new Date(nowSec * 1000), this.home.lat, this.home.lon));
      this.moonBox = null;
      g.save(); this.clip(g); this.sunGlow(g, sun); this.moonDisk(g, this.moon, sun.el); g.restore();
      g.drawImage(this.background, 0, 0, W, H);

      // which aircraft: visible now, or coming into view soon
      const candidates = [];
      for (const ac of this.aircraft) {
        const p = Sky.extrapolate(ac, nowSec);
        let c = null, obs = null;
        for (const ob of this.horizon.observers) {
          const cc = Sky.classify(ob, this.step, p, range);
          if (cc.status === "visible") { c = cc; obs = ob; break; }
          if (Math.abs(cc.φ) < 90 && !c) { c = cc; obs = ob; }
        }
        if (!c || c.ground > 80000) continue;
        const visible = c.status === "visible", soon = this.soon.get(ac.icao24);
        if (!visible && soon == null) continue;
        const model = Models.modelFor((this.info[ac.icao24] || {}).icaoType, Craft.identify(ac, this.info[ac.icao24]).shape, ac.callsign);
        const x = geo.x(c.az), y = geo.y(c.el), path = [];
        for (let dt = 15; dt <= 45; dt += 15) { const f = Sky.look(obs, ...latLonAlt(Sky.extrapolate(ac, nowSec + dt))); path.push([geo.x(f.az), geo.y(f.el)]); }
        candidates.push({ key: ac.icao24, ac, c, obs, view: obs.id, model, visible, soon: soon || 0, x, y, sx: x, sy: y, path,
          size: apparentSize(c.range, model.L, o.planeScale), haze: haze(c.range) });
      }
      const planes = planesToShow(candidates, o.maxUpcoming);
      this.shown = planes;

      // trails (a contrail up high by day), then the aircraft, far first
      g.save(); this.clip(g);
      for (const m of planes) {
        const pts = [30, 20, 10, 0].map(dt => { const l = Sky.look(m.obs, ...latLonAlt(Sky.extrapolate(m.ac, nowSec - dt))); return [geo.x(l.az), geo.y(l.el)]; });
        const contrail = m.visible && !night && m.ac.alt - this.geoid > 8000, a = (contrail ? 0.55 : 0.2) * m.haze;
        const gr = g.createLinearGradient(pts[0][0], pts[0][1], m.x, m.y);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(1, `rgba(255,255,255,${a})`);
        g.strokeStyle = gr; g.lineWidth = (contrail ? 2 : 1) * (0.5 + 0.5 * m.haze); g.lineCap = "round";
        g.beginPath(); pts.forEach(([x, y], i) => (i && Math.abs(x - pts[i - 1][0]) < W / 2 ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      }
      for (const m of planes.slice().sort((a, b) => b.c.range - a.c.range)) {
        const sp = this.sprite(m, sunV, sun.el, night);
        g.drawImage(sp.canvas, m.x - sp.half, m.y - sp.half, sp.half * 2, sp.half * 2);
        this.lights(g, m, sp.lights, night, nowSec);
      }
      g.restore();
      this.labels(g, planes, nowSec);
      for (const map of [this.memo, this.firstSeen, this.sprites]) for (const key of [...map.keys()]) if (!planes.some(p => p.key === key.split("#")[0])) map.delete(key);
      const status = this.statusText(planes, this.feed, nowSec);
      if (this.status.textContent !== status) this.status.textContent = status;
      this.stats.frames++;
      this.stats.frameMs = 0.9 * this.stats.frameMs + 0.1 * ((typeof performance !== "undefined" ? performance : Date).now() - t0);
    }

    clip(g) { g.beginPath(); for (const p of this.panels) g.rect(p.x0, 0, p.x1 - p.x0, this.BOTTOM + 4); g.clip(); }

    sunGlow(g, sun) { // the real sun, behind the landscape, so ridges cover it as it sets
      if (sun.el < -3 || sun.el > 70) return;
      const x = this.geo.x(sun.az), y = this.geo.y(Math.max(sun.el, 0)) + (sun.el < 0 ? -sun.el * 3 : 0);
      const gr = g.createRadialGradient(x, y, 0, x, y, 26);
      gr.addColorStop(0, "rgba(255,244,220,.55)"); gr.addColorStop(0.25, "rgba(255,236,200,.18)"); gr.addColorStop(1, "rgba(255,230,190,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,248,235,.9)"; g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
    }

    /**
     * The real Moon in its current phase, the lit side facing where it really does from here
     * (a crescent tilts with the hour). Behind the landscape like the sun; paler by day.
     * Drawn larger than life (0.5° would be half a pixel), like the sun.
     */
    moonDisk(g, moon, sunEl) {
      if (moon.el < -3 || moon.el > 80) return;
      const x = this.geo.x(moon.az), y = this.geo.y(Math.max(moon.el, 0)) + (moon.el < 0 ? -moon.el * 3 : 0);
      const r = 6, k = moon.illumination;
      if (moon.el > 0) this.moonBox = { x: x - r - 3, y: y - r - 3, w: 2 * r + 6, h: 2 * r + 6 }; // labels keep clear of it
      const day = clamp((sunEl + 4) / 10, 0, 1), alpha = 0.95 - 0.45 * day;
      const a = rad(moon.limb); // from straight up, turning east = to the left on this strip
      g.save();
      g.translate(x, y); g.rotate(Math.atan2(-Math.cos(a), -Math.sin(a)));
      if (!day) { // a faint halo at night, stronger when full
        const gr = g.createRadialGradient(0, 0, r, 0, 0, r * 3.2);
        gr.addColorStop(0, `rgba(230,232,240,${0.16 * k})`); gr.addColorStop(1, "rgba(230,232,240,0)");
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 3.2, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = `rgba(210,215,225,${0.1 * alpha})`; // the unlit disc, just visible
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
      if (k > 0.01) { // lit limb along +x: half disc plus (gibbous) or minus (crescent) the terminator ellipse
        g.fillStyle = `rgba(238,238,230,${alpha})`;
        g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
        g.ellipse(0, 0, Math.max(0.01, r * Math.abs(2 * k - 1)), r, 0, Math.PI / 2, -Math.PI / 2, k < 0.5);
        g.closePath(); g.fill();
      }
      g.restore();
    }

    /** The aircraft's picture, re-rendered only when it turned >2.5°, resized >6% or its light changed. */
    sprite(m, sunV, sunEl, night) {
      const ac = m.ac, att = { track: ac.track || 0, pitch: Math.atan2(ac.vr || 0, Math.max(ac.v || 1, 1)), bank: clamp(Math.atan((ac.v || 0) * rad(ac.turn || 0) / 9.81), -0.6, 0.6) };
      const key = [att.track, deg(att.pitch), deg(att.bank), m.c.az, m.c.el];
      const light = `${m.visible}|${night}|${Math.round(sunEl / 3)}|${Math.round(deg(Math.atan2(sunV[0], sunV[1])) / 10)}`;
      const old = this.sprites.get(m.key);
      if (old && old.model === m.model && old.light === light && Math.abs(old.size / m.size - 1) < 0.06 &&
          key.every((v, i) => Math.abs(((v - old.key[i] + 540) % 360) - 180) < 2.5)) return old;
      this.stats.spriteRenders++;
      const half = Math.ceil(m.size * 0.9) + 4, canvas = old && old.half === half ? old.canvas : document.createElement("canvas");
      canvas.width = canvas.height = half * 2 * this.dpr;
      const g = canvas.getContext("2d"); g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, half * 2, half * 2);
      const e = Math.cos(rad(m.c.el)), view = [e * Math.sin(rad(m.c.az)), e * Math.cos(rad(m.c.az)), Math.sin(rad(m.c.el))];
      const rs = [Math.cos(rad(m.c.az)), -Math.sin(rad(m.c.az)), 0];
      const us = [rs[1] * view[2] - rs[2] * view[1], rs[2] * view[0] - rs[0] * view[2], rs[0] * view[1] - rs[1] * view[0]];
      const base = (m.visible ? 1 : 0.55) * m.haze;
      const ls = Models.drawModel(g, m.model, att, view, rs, us, half, half, m.size / m.model.L, { sunV, day: clamp((sunEl + 4) / 10, 0, 1), night, base });
      const out = { canvas, half, size: m.size, key, light, model: m.model, lights: {} };
      for (const n of Object.keys(ls)) out.lights[n] = [ls[n][0] - half, ls[n][1] - half];
      this.sprites.set(m.key, out);
      return out;
    }

    /** Navigation lights: red left wing, green right, white tail; strobes and the red beacon blink. */
    lights(g, m, at, night, t) {
      const glow = (p, color, r) => { const x = m.x + p[0], y = m.y + p[1], gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
      const strength = (night ? 1 : 0.35) * (m.visible ? 1 : 0.5), ls = clamp(m.size / 28, 0.45, 1.3);
      glow(at.red, `rgba(255,60,50,${0.95 * strength})`, (night ? 3.2 : 1.8) * ls);
      glow(at.green, `rgba(60,255,120,${0.95 * strength})`, (night ? 3.2 : 1.8) * ls);
      if (night) glow(at.tail, `rgba(255,255,255,${0.8 * strength})`, 2.4 * ls);
      if ((t + (parseInt(m.key, 16) % 1000) / 1000) % 1.3 < 0.3) { glow(at.red, `rgba(255,255,255,${strength})`, (night ? 6 : 3) * ls); glow(at.green, `rgba(255,255,255,${strength})`, (night ? 6 : 3) * ls); }
      if ((t * 1.1) % 1 < 0.35) glow(at.beacon, `rgba(255,40,30,${0.9 * strength})`, (night ? 4 : 2) * ls);
    }

    /**
     * Every aircraft gets a label. The most prominent per view get the full one (type and airline,
     * route); the rest a short one (type). Following, calm (see decideSide), never across a wall.
     */
    labels(g, planes, nowSec) {
      for (const p of planes) if (!this.firstSeen.has(p.key)) this.firstSeen.set(p.key, nowSec);
      this.full = fullLabelSet(planes, this.full || new Set(), FULL_PER_VIEW);
      const placed = this.keepOut.concat(this.moonBox ? [this.moonBox] : []).map(box => ({ box, future: [] })), fixed = placed.length;
      const place = (p, key, w, h, optional) => {
        const memo = this.memo.get(key);
        const pick = decideSide(scoreSides(p, w, h, planes, placed, this.band, this.W, this.BOTTOM), memo, nowSec, optional);
        if (!pick) { this.memo.delete(key); return null; }
        if (memo && memo.side !== pick.side) this.switches++;
        this.memo.set(key, pick.memo); placed.push({ box: pick.box, future: pick.future });
        return pick.box;
      };
      // full labels first, in the order the aircraft appeared (a newcomer never pushes one away)
      const full = planes.filter(p => this.full.has(p.key)).sort((a, b) => this.firstSeen.get(a.key) - this.firstSeen.get(b.key));
      const noRoom = [];
      full.forEach((p, n) => {
        const t = labelText(p.ac, this.info[p.ac.icao24], p.visible, p.soon, this.geoid);
        const w = Math.ceil(Math.max(this.measure(t.title + (t.airline ? ` ${t.airline}` : ""), L1), this.measure(t.second, L2))) + 2;
        const box = place(p, p.key, w, LABEL_H, n > 0);
        if (!box) { noRoom.push(p); return; } // no room for two lines: it gets a short label below
        text(g, t.title, box.x, box.y + 12, L1, p.visible ? "#fff" : "#999");
        if (t.airline) { g.font = `400 ${L1}px "Roboto Condensed", sans-serif`; text(g, ` ${t.airline}`, box.x + g.measureText(t.title).width, box.y + 12, L1, p.visible ? "#999" : "#666"); }
        text(g, t.second, box.x, box.y + 27, L2, p.visible ? "#777" : "#555");
      });
      // short labels for everyone else, larger aircraft first
      const rest = planes.filter(p => !this.full.has(p.key)).concat(noRoom).sort((a, b) => (b.visible - a.visible) || b.size - a.size);
      for (const p of rest) {
        const t = labelText(p.ac, this.info[p.ac.icao24], p.visible, p.soon, this.geoid);
        const str = p.visible ? t.title : `${t.title} · ${t.second}`;
        const box = place(p, `${p.key}#short`, Math.ceil(this.measure(str, LS)) + 2, SHORT_H, true);
        if (box) text(g, str, box.x, box.y + 11, LS, p.visible ? "#bbb" : "#666");
      }
      this.stats.labels = placed.length - fixed;
    }

    statusText(planes, feed, nowSec) {
      if (feed.quiet) return this.o.quietHours ? `Paused until ${this.o.quietHours.to}` : "Paused";
      const stale = !feed.fetchedAt || nowSec - feed.fetchedAt / 1000 > 3 * this.o.pollSeconds + 30;
      if (feed.error && stale) return "Flight data unavailable";
      return planes.length ? "" : "Clear sky";
    }

    measure(str, px) {
      this.ctx.font = `400 ${px}px "Roboto Condensed", sans-serif`;
      return this.ctx.measureText(str).width;
    }

    destroy() { clearInterval(this.timer); }
  }

  const latLonAlt = p => [p.lat, p.lon, p.alt];
  function text(g, str, x, y, px, color, align) {
    g.font = `400 ${px}px "Roboto Condensed", sans-serif`; g.textAlign = align || "left";
    g.lineJoin = "round"; g.lineWidth = 4; g.strokeStyle = "#000"; g.strokeText(str, x, y); // halo: lines break behind text
    g.fillStyle = color; g.fillText(str, x, y);
  }

  return { View, fullLabelSet, stripGeometry, runs, defaultFacing, skyline, linePath, skyAt, skyBand, hitsBand, scoreSides, decideSide, chooseSide, planesToShow, labelText, countdown, apparentSize, haze };
});
