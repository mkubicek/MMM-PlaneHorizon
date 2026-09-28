/* MagicMirror² module: which aircraft can I see from my windows right now, and which is which.
 * Each window's view with its measured landscape horizon (tools/ builds horizon.json), the real sun,
 * and the aircraft you can see as lit 3D models in their true attitude, each with a label. */
Module.register("MMM-PlaneHorizon", {
  defaults: {
    horizonFile: "horizon.local.json",
    width: 365,                 // px; the widget's drawing width, match the column it sits in
    facingDeg: null,            // compass direction you face when looking at the mirror; null: first opening on the left
    height: 150,                // px of sky above the horizon line
    planeScale: 1,              // aircraft size (they also shrink with distance and grow with their real length)
    fps: 4,                     // frames per second; aircraft pictures are cached, so this stays cheap
    lineSmoothingDeg: 3,        // calm the drawn line (edge-preserving); 0 draws the exact horizon
    radiusKm: 60,               // aircraft considered around home
    pollSeconds: 30,            // local queries: ~2880 credits/day; check your provider quota
    quietHours: null,           // e.g. { from: "23:00", to: "06:00" } while the screen is off
    visibleRangeKm: 40,         // farther than this counts as too small to see
    lookAheadSeconds: 240,      // how far ahead "in 1:20" predictions look
    maxUpcoming: 2,
    demo: false,                // offline sample traffic; no API calls
  },

  getScripts() {
    return [this.file("lib/sky.js"), this.file("lib/aircraft.js"), this.file("lib/models.js"), this.file("lib/view.js")];
  },

  getStyles() {
    return [this.file("MMM-PlaneHorizon.css")];
  },

  start() {
    this.aircraft = [];
    this.info = {};
    this.feed = { fetchedAt: 0, error: null, quiet: false };
    this.requested = new Set();
    this.wrapper = document.createElement("div");
    this.wrapper.className = "plane-horizon";
    this.wrapper.style.width = `${this.config.width}px`; // side regions shrink-wrap; the drawing is 1:1 in px
    this.boot().catch(error => {
      Log.error(`MMM-PlaneHorizon: ${error.message}`);
      this.wrapper.textContent = `PlaneHorizon setup: ${error.message}. See the README.`;
    });
  },

  async boot() {
    const file = this.config.demo ? "examples/horizon.demo.json" : this.config.horizonFile;
    const r = await fetch(this.file(file));
    if (!r.ok) throw new Error(`cannot load ${this.config.horizonFile}: HTTP ${r.status}`);
    this.horizon = await r.json();
    await document.fonts.ready; // label widths are measured with the real font
    this.view = new PlaneHorizonView.View(this.wrapper, this.horizon, this.config);
    const home = this.horizon.observers[0];
    this.sendSocketNotification("PLANEHORIZON_START", {
      center: { lat: home.lat, lon: home.lon }, radiusKm: this.config.radiusKm,
      pollSeconds: this.config.pollSeconds, quietHours: this.config.quietHours,
      geoidM: this.horizon.geoidUndulationM || 0, demo: this.config.demo,
    });
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), 1000);
  },

  suspend() {
    clearInterval(this.tickTimer);
    if (this.view) clearInterval(this.view.timer);
  },

  resume() {
    if (!this.view) return;
    clearInterval(this.tickTimer);
    clearInterval(this.view.timer);
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.view.timer = setInterval(() => this.view.frame(Date.now() / 1000), 1000 / this.config.fps);
  },

  // Built once; afterwards the view animates inside it, so never call updateDom.
  getDom() {
    return this.wrapper;
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "PLANEHORIZON_AIRCRAFT") {
      this.aircraft = payload.aircraft;
      this.feed = payload;
    }
    if (notification === "PLANEHORIZON_INFO") this.info[payload.icao24] = payload.info;
  },

  tick() {
    const shown = this.view.update(this.aircraft, this.info, this.feed, Date.now() / 1000);
    for (const ac of shown) {
      const key = `${ac.icao24}/${ac.callsign}`;
      if (this.requested.has(key)) continue;
      this.requested.add(key);
      this.sendSocketNotification("PLANEHORIZON_DESCRIBE", { icao24: ac.icao24, callsign: ac.callsign });
    }
    if (this.requested.size > 2000) this.requested.clear();
  },
});
