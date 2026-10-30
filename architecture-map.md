# Current `main` execution map (before modularization)

The committed HTML is the minified output of the readable local `src/main.js` and `src/flight.js`; the checked Git blob SHA is identical. Its embedded GLBs are loaded once each from base64. The minified bundle also contains Three.js, GLTFLoader and BufferGeometryUtils.

Initialization order: create `Flight` and recorder/diagnostic state; create scene, renderer, camera, light, sky and ocean; define terrain/tree caches; start tree loading and build terrain; create aircraft pivot and start model loading; create camera follow state; attach reset, recorder, keyboard, tuning, camera and panel handlers; start RAF. Model-load completion sets aircraft visual state and snaps camera. Tree-load completion builds instancing templates and tree tiles.

Each active RAF: sample render performance and diagnostics; accumulate elapsed time (capped at .1 s); read pressed keys; repeat `Flight.step(1/120)` then `recordTick` for each fixed step; interpolate visual pose; animate propeller/elevator; update terrain and tree tiles; update camera; update HUD at about 12.5 Hz; render. `Flight.step` stores previous pose, advances simulation time, smooths inputs, computes stall/lift/drag/thrust/authority, integrates linear and angular motion, then optionally resets after ground contact. Recorder diagnostics observe each completed step and keep their own simulation-relative clock.

Shared mutable owners: `Flight` owns profile, tune values, pose, velocity, smoothed input and aerodynamic diagnostic values. Input owns the held-key set. Recorder owns samples, events, performance windows, stall classification and summary. World owns tile caches, tree templates and scenery counts. Camera owns chase vectors, preset, distance and elevation. Main owns frame accumulator, RAF timestamp and pause state. UI reads these states and changes profile/tuning/camera through their existing operations.

Refactor rule: preserve the above order and data ownership; pass references explicitly between factory modules. Keep stall classification outside `Flight` and retain the legacy recorder event threshold.
