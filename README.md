# Island Pilot

A small Three.js flight sandbox with Bush and Fighter (Legacy) profiles, terrain and trees, chase cameras, and a JSON flight recorder. The Off preset preserves the behavior of the original single-file baseline at commit `594b298`.

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
| `src/physics/Flight.js`, `src/physics/atmosphere.js` | Original force, stall and control integration, plus the optional deterministic airflow field. |
| `src/world/height.js`, `src/world/world.js` | Analytic ground height, terrain tiles, tree instancing, tile density and placement settings. |
| `src/aircraft/aircraft.js` | Aircraft GLB, pivot, propeller and elevator visuals. |
| `src/rendering/scene.js`, `src/rendering/camera.js`, `src/rendering/heading.js` | Lighting, sky, chase camera and horizontal heading math. |
| `src/controls/keyboard.js` | Held keys, controls and input transitions. |
| `src/telemetry/recorder.js` | 10 Hz samples, exact events, stall diagnostic classification, performance windows, JSON export. The diagnostic phases do not modify flight physics. |
| `src/ui/interface.js` | HUD, panel interactions, tuning and warning display. |
| `src/vendor/three.js` | Exact Three.js, GLTFLoader and geometry utility code extracted from the original embedded bundle; no runtime CDN. |
| `assets/models/` | Original aircraft and both tree GLBs, unchanged bytes. Add a GLB here and load its path from the responsible aircraft/world module. |

## Update order

On each active animation frame, performance is sampled, then the accumulator advances in `1/120` second physics steps. Every step calls `Flight.step` followed by the recorder's `recordTick`. Afterward, the visual aircraft pose is interpolated, moving parts update, terrain and tree tiles update, the chase camera follows, the HUD refreshes when due, and the renderer draws. The recorder owns its diagnostic stall phase separately from `Flight.stall`.

Shared mutable state is held by its module or factory: `Flight` owns physical state and tuning; `main.js` allocates the held-key set and keyboard updates it; recorder owns telemetry and event clocks; world owns tile caches; camera owns chase vectors and preset; `main.js` owns pause and frame timing. Factories receive the references they need. See [architecture-map.md](architecture-map.md) for the original initialization and update dependency map.

## Dynamic atmosphere experiment

The Light preset is the default. In Flight tuning, select Off, Calm, Light or Breezy, then adjust mean speed, wind FROM direction and gust intensity. Off clears atmosphere effects immediately; changing active settings eases mean flow and gusts over three simulation seconds without changing aircraft velocity or pose. Manual slider use while Off switches to Light. Profiles and aircraft assets are unchanged.

World +Z is north, +X east, and +Y up; aircraft forward is local +Z, independent of the imported GLB orientation. A wind FROM 270° flows toward +X. The atmosphere uses seeded low-frequency sine components for horizontal gusts, a small vertical component and weak pitch/roll/yaw angular accelerations scaled by inverse aircraft mass. These are smooth disturbances, not gusts calculated from spatial weather or certified turbulence categories. Air-relative velocity drives lift, drag, sideslip, AoA, dynamic pressure and control authority; ground-relative velocity drives position. Uniform wind with zero intensity therefore changes ground track without imposing a continuous roll moment. A fresh start in Off follows the exact former trajectory.

The heading instrument displays aircraft heading and ground track independently. The recorder keeps its schema `1.0` with additive fields and simulation version `1.5`: `initialConfiguration.atmosphere`, per-sample heading/ground track, air and ground speeds, air velocity, mean/instantaneous wind, gust and seed, and coalesced `atmosphere_changed` events with first/last application times. All vectors are `[east, up, north]` in m/s; `windFromDeg` is meteorological FROM. Recorder timestamps remain on the existing simulation clock. Run `node tests/atmosphere-regression.mjs` for Off equivalence, steady wind, smooth seeded trajectories, heading and recorder checks.
