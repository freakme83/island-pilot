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
| `src/config/profiles.js` | Bush and Fighter coefficients, defaults and tuning fields. Add a profile here, with a matching tuning state, selector option, and approximate airframe dimensions in `src/physics/airflow-response.js`. |
| `src/physics/Flight.js`, `src/physics/atmosphere.js` | Original force, stall and control integration, plus the optional deterministic airflow field and differential wing/tail response. |
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

## Atmosphere v2.1 experiment

Light is the default. Flight tuning includes Off / Calm / Light / Breezy, mean speed, meteorological wind FROM direction, gust intensity, and **Turbulence response** (0–3×, default 1×). Response scales the wing/tail moments; center wind and updrafts still affect aerodynamics at 0×. Changing active settings eases mean flow and intensity over three simulation seconds. Off clears all atmospheric effects immediately, preserving ground velocity and orientation. A fresh start in Off follows the exact legacy trajectory.

`src/physics/atmosphere.js` produces environmental conditions without aircraft or rendering knowledge. It combines prevailing wind, broad slow gusts, two scales of local turbulence, and broad vertical airflow using seeded quintic value noise. World position X/Z, altitude and simulation time genuinely affect the field. Noise values and derivatives are continuous across cell boundaries. Mean flow advects the field through an integrated offset, so changing wind settings does not jump the spatial phase. `update(position, time, dt)` advances settings and advection once per fixed step and writes center conditions. `sample(position, time, output)` queries the same environmental state into caller-owned storage; it does not advance the model or overwrite center telemetry. `createConditions()` allocates that storage once. Future visual weather can consume this interface.

`src/physics/airflow-response.js` samples both wings and the tail in world coordinates. Differences in upflow create roll/pitch moments; tail crossflow differences create a yaw moment. Center airflow supplies the net aerodynamic force, while these differences supply pure moments, avoiding duplicate net forces. The loading approximation uses `0.5 × density × airspeed × area × liftSlope`; moments are divided by scalar inertia proxies derived from current mass and approximate span/length. Bush and Fighter have explicit approximate dimensions and inertia scales (1 and 1.8). These are gameplay calibration values, not measurements of the GLB or an inertia tensor. Smooth acceleration limits keep the added disturbance within control authority. Existing stability and stall equations remain intact.

`Flight.massKg` is the common mass source for forces, trim and atmospheric inertia. It currently returns profile mass; future simplified cargo can extend it. No cargo placement model is involved. Tune dimensions, coupling gains and bounds in `airflow-response.js`. The atmosphere itself needs no aircraft-specific changes. The field is generic rather than terrain driven, with no cloud, fog or precipitation implementation.

World +Z is north, +X east, +Y up; aircraft forward is local +Z. A wind FROM 270° flows toward +X. Heading and ground track remain distinct. Recorder schema `1.0` remains additive; simulation version is `1.6`, and atmosphere `modelVersion` is `2.1`. Existing wind fields, 10 Hz samples and events remain. Environmental additions include slow gust, local turbulence magnitude/vector and broad vertical airflow in m/s. The separate `airflowResponse` object holds resulting body-axis pitch/roll/yaw accelerations in rad/s², sampled airflow differences, mass in kg and inertia proxies in kg·m². Response-slider changes use existing coalesced `tuning_changed` events (`parameter: turbulenceResponse`); environment changes use `atmosphere_changed`. No per-wing arrays are exported.

Run all focused checks:

```sh
node tests/physics-regression.mjs
node tests/runtime-reliability.mjs
node tests/atmosphere-regression.mjs
```

The atmosphere test prints controlled 60-second hands-off runs at 120 Hz, seed 17391. Within each profile, position, attitude, angular rates, throttle and ground velocity start identically across presets. Velocity starts at `[0, 0, cruiseSpeed]`, including the initial crosswind transient. Maximum altitude deviation uses world altitude; pitch is full range; heading is maximum shortest deviation from initial north. Gust RMS is the RMS magnitude of all variable airflow components. Default 1× response:

| Profile / preset | Max / RMS bank ° | Pitch range ° | Max heading deviation ° | Max altitude deviation m | Gust RMS m/s |
| --- | --- | --- | --- | --- | --- |
| Bush Off | 0 / 0 | 0 | 0 | 0 | 0 |
| Bush Light | 8.20 / 3.45 | 2.95 | 34.20 | 10.97 | 1.49 |
| Bush Breezy | 9.81 / 4.55 | 5.85 | 15.65 | 24.86 | 2.74 |
| Fighter Off | 0 / 0 | 0.08 | 0 | 1.91 | 0 |
| Fighter Light | 1.04 / 0.57 | 0.95 | 3.42 | 3.89 | 1.44 |
| Fighter Breezy | 3.16 / 1.69 | 1.66 | 17.96 | 18.67 | 2.62 |

At PR head `857cd85`, the same Bush comparison measured Light max/RMS bank 0.42°/0.22°, pitch range 0.70°, altitude deviation 1.10 m; Breezy 0.78°/0.41°, 1.35°, 2.56 m. The revised runs therefore exercise attitude and flight-path corrections substantially more. Stronger settings do not imply every trajectory statistic increases: different paths cross different air, and signed disturbances can cancel. The printed runs stayed finite with no stalls or ground resets. Additional 90-second runs for seeds 1, 223344 and 98765 stayed out of stall; unattended Breezy Bush bank reached 25.8° in one run, so active piloting matters.

These numerical results establish reproducibility and response, not gameplay quality. Desktop hands-on testing and rendered UI inspection were unavailable in the implementation environment. Review Light and Breezy locally, reset with R between comparisons, and export recordings to assess whether corrections feel useful and controllable.
