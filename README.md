# Island Pilot

A small Three.js flight sandbox with Bush and Fighter (Legacy) profiles, terrain and trees, chase cameras, and a JSON flight recorder. This refactor preserves the behavior of the original single-file `main` at commit `594b298`.

## Run locally on macOS

Clone the repository, enter the directory, then run:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/) in a modern desktop browser. Stop the server with Ctrl+C. No package installation or build is needed. Native ES modules and external GLB files require HTTP; double-clicking `index.html` is no longer supported.

Run the small deterministic physics comparison with `node tests/physics-regression.mjs` if Node.js is installed. It checks Bush and Fighter trajectories against numeric snapshots from the original `main` implementation.

## Layout

| Path | Responsibility |
| --- | --- |
| `index.html` | Original markup and visual styles; loads the module entry point. |
| `src/main.js` | Startup, frame accumulator, fixed-step sequence, visual interpolation and reset. |
| `src/config/profiles.js` | Bush and Fighter coefficients, defaults and tuning fields. Add a profile here, with a matching tuning state and selector option. |
| `src/physics/Flight.js` | Original force, stall, input-smoothing and angular integration equations. |
| `src/world/height.js`, `src/world/world.js` | Analytic ground height, terrain tiles, tree instancing, tile density and placement settings. |
| `src/aircraft/aircraft.js` | Aircraft GLB, pivot, propeller and elevator visuals. |
| `src/rendering/scene.js`, `src/rendering/camera.js` | Lighting, sky, renderer setup and chase camera. |
| `src/controls/keyboard.js` | Held keys, controls and input transitions. |
| `src/telemetry/recorder.js` | 10 Hz samples, exact events, stall diagnostic classification, performance windows, JSON export. The diagnostic phases do not modify flight physics. |
| `src/ui/interface.js` | HUD, panel interactions, tuning and warning display. |
| `src/vendor/three.js` | Exact Three.js, GLTFLoader and geometry utility code extracted from the original embedded bundle; no runtime CDN. |
| `assets/models/` | Original aircraft and both tree GLBs, unchanged bytes. Add a GLB here and load its path from the responsible aircraft/world module. |

## Update order

On each active animation frame, performance is sampled, then the accumulator advances in `1/120` second physics steps. Every step calls `Flight.step` followed by the recorder's `recordTick`. Afterward, the visual aircraft pose is interpolated, moving parts update, terrain and tree tiles update, the chase camera follows, the HUD refreshes when due, and the renderer draws. The recorder owns its diagnostic stall phase separately from `Flight.stall`.

Shared mutable state is owned by its module or factory: `Flight` owns physical state and tuning; keyboard owns pressed keys; recorder owns telemetry and event clocks; world owns tile caches; camera owns chase vectors and preset; `main.js` owns pause and frame timing. Factories receive only the references they need. See [architecture-map.md](architecture-map.md) for the original initialization and update dependency map.
