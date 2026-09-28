# Measured skylines

The portable tool accepts manual or externally measured true-azimuth/elevation samples. It does not include terrain downloads or private survey/photo processing.

Put your samples in each view's `skyline` array. Elevation is an angle from the observer's eyes, not terrain height in metres. Generate with `node tools/configure.js site.local.json new-horizon.local.json`, set `horizonFile` to the new file and restart.

The generated runtime format:

- `azimuthStepDeg`: 1; uniformly sampled over 360°.
- `geoidUndulationM`: ellipsoid minus mean sea-level height.
- `observers`: objects with unique `id`, `name`, `lat`, `lon`, `eyeEllipsoidal`, `facingDeg`, `aperture`.
- `landscape`: 360 elevation samples, clockwise from true north. Duplicated into `terrain` and `trees` for compatibility.
- `terrainDistM`, `treesDistM`: same-length arrays. Manual profiles use placeholder distances; classification with `landscape` uses its angles.
- `aperture: {type: "open", halfWidthDeg: 60, maxElevation: 70}`: a 120° view capped at 70° elevation.

Existing measured profiles may use `window`/`balcony` physical geometry and `blocked` azimuth intervals; inspect `lib/sky.js` before writing those formats. Arbitrary terrain JSON cannot be used directly.

The renderer spreads a full 360° panorama across its width; narrow openings occupy part of it. Overlapping views use the first match. The constant roof elevation is an approximation. Even a detailed skyline cannot guarantee naked-eye visibility in real weather.
