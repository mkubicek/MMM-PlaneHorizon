/* Portable horizon configuration. No terrain service or private location is bundled. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PlaneHorizonConfig = factory();
})(this, function () {
  function number(value, name, min, max) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${name} must be a number from ${min} to ${max}`);
    }
    return value;
  }
  function build(site) {
    number(site.latitude, "latitude", -85, 85);
    number(site.longitude, "longitude", -180, 180);
    number(site.eyeAltitudeM, "eyeAltitudeM", -500, 10000);
    const geoid = site.geoidUndulationM == null ? 0 : number(site.geoidUndulationM, "geoidUndulationM", -150, 150);
    if (!Array.isArray(site.views) || !site.views.length || site.views.length > 8) throw new Error("Provide 1–8 views");
    const observers = site.views.map((view, i) => {
      const facing = number(view.direction, "view direction", 0, 359.999);
      const fov = number(view.fieldOfView == null ? 160 : view.fieldOfView, "fieldOfView", 1, 180);
      const top = number(view.maxElevation == null ? 90 : view.maxElevation, "maxElevation", 1, 90);
      const points = view.skyline || [[0, 0], [180, 0]];
      if (!Array.isArray(points) || points.length < 2) throw new Error("skyline needs at least two [azimuth, elevation] points");
      const sorted = points.map(p => {
        if (!Array.isArray(p) || p.length !== 2) throw new Error("skyline points must be [azimuth, elevation]");
        return [number(p[0], "skyline azimuth", 0, 359.999), number(p[1], "skyline elevation", -20, 89)];
      }).sort((a, b) => a[0] - b[0]);
      if (sorted.some((p, j) => j && p[0] === sorted[j - 1][0])) throw new Error("Duplicate skyline azimuth");
      const landscape = Array.from({ length: 360 }, (_, az) => {
        let j = sorted.findIndex(p => p[0] > az);
        if (j < 0) j = 0;
        const a = sorted[(j + sorted.length - 1) % sorted.length], b = sorted[j];
        const span = (b[0] - a[0] + 360) % 360;
        return a[1] + (b[1] - a[1]) * ((az - a[0] + 360) % 360) / span;
      });
      return { id: `view-${i + 1}`, name: String(view.name || `View ${i + 1}`).slice(0, 60),
        lat: site.latitude, lon: site.longitude, eyeEllipsoidal: site.eyeAltitudeM + geoid,
        facingDeg: facing, offsetM: 0, aperture: { type: "open", halfWidthDeg: fov / 2, maxElevation: top },
        landscape, terrain: landscape.slice(), trees: landscape.slice(),
        terrainDistM: Array(360).fill(1000), treesDistM: Array(360).fill(1000) };
    });
    return { azimuthStepDeg: 1, geoidUndulationM: geoid, observers };
  }
  return { build };
});
