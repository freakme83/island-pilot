# Island Pilot

A small Three.js flight sandbox with Bush and Fighter (Legacy) profiles, terrain and trees, a procedural mountain, chase cameras, and a JSON flight recorder. The Off preset preserves the airborne dynamics of the original single-file baseline at commit `594b298`.

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
| `src/world/height.js`, `src/world/world.js`, `src/world/noise.js` | Mountain/terrain source, shared mesh-height queries and gradients, deterministic noise, static tiles and tree instancing. |
| `src/physics/terrain-airflow.js`, `src/physics/terrain-collision.js` | Terrain-induced airflow and swept aircraft contact proxies; both consume the shared surface. |
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

## V2.2 mountain and terrain airflow

The existing world is a scrolling procedural landscape, with 49 tiles covering 21 × 21 km around the aircraft, rather than a fixed island boundary. No world enlargement was needed. One seeded mountain is centered at `(1600, 4400)` m: roughly 5.2 km from spawn, bearing 032°, about 2.4 minutes at Bush cruise. Its rotated footprint is about 6 × 5.6 km. Three smoothly blended peaks and a connecting ridge produce asymmetric shoulders around 360–480 m above the underlying terrain. Nominal relief is 650 m; the rendered grid reaches about 649.7 m of relief and a maximum world elevation around 763.6 m. Terrain seed is 65021. The original palette, tile density, tree system and aircraft assets are retained.

`terrainVertexHeight` supplies mesh vertices; `ground` interpolates those exact grid triangles and is now shared by collision, AGL, trees, camera clearance and airflow. `terrainGradient` takes smoothed central differences of that surface. A bounded 8,192-vertex query cache avoids repeating procedural work; meshes still rebuild only when entering new tile coverage. The original world spawn is retained to preserve the flight regression, with a shared-surface safety check. AGL is now aligned to the rendered surface (the old analytic/mesh difference at spawn was only 2.6 cm).

The main application supplies this terrain sampler to the existing Atmosphere. Local horizontal wind dotted with slope gives upward airflow when wind blows uphill. Downhill slope and a 350 m upstream sample give bounded lee sink. Effects fade exponentially with clearance, using a 450 m height scale, and naturally disappear away from slopes. Terrain flow is softly limited to +4 / −3 m/s. Lee conditions can amplify the existing local turbulence by up to 65%; they do not add an independent angular force. Applied wind already eases over three seconds, so changing FROM direction smoothly moves lift/sink to the appropriate slopes. Presets and the default 1× response are unchanged; 1.7× remains selectable.

At 8 m/s wind and 180 m clearance, the sampled west/east slopes give:

| Wind FROM | Western slope vertical air | Eastern slope vertical air |
| --- | --- | --- |
| West (270°) | +1.82 m/s | −1.45 m/s |
| East (90°) | −1.68 m/s | +1.95 m/s |

Zero horizontal wind produces zero terrain airflow. A controlled 10-second Bush pass gained 12.05 m with terrain airflow versus 0 m without it, from the same aircraft state with steady 8 m/s westerly wind. This effect enters through air-relative velocity and the existing aerodynamics.

Terrain contact uses 11 body/wing/nose/tail/fin proxies based on the actual leveled GLB bounds (9 m span). Motion and rotation are swept in intervals of at most 2 m of proxy travel, including high-speed paths that start and end above terrain but cross the mountain between them. Contact immediately resets airborne, matching the existing recovery style, and shows an impact notice for four seconds. The rendered water plane at 19 m is also a contact surface, so lowering the old center clearance does not permit underwater flight. Collision is approximate: there is no landing, damage, sliding, debris or tree collision model.

In Flight Recorder, enable **Terrain & wind diagnostics** for local horizontal wind FROM/speed, terrain height, AGL, terrain-driven vertical airflow and lift/sink classification. It is off by default. Recorder schema remains additive `1.0`, simulation version is `1.7`, atmosphere model is `2.2`; samples add `terrain` fields. Existing `ground_contact` events add an `impact` object with pre-reset location, surface and proxy. Their existing event state remains post-reset. The frame loop now passes the individual physics-step reset flag to the recorder, avoiding duplicate contact events within one render frame.

For this branch on a Mac with a Desktop clone:

```sh
cd ~/Desktop/island-pilot
git fetch origin
git switch feat/terrain-atmosphere-v2-2
git pull --ff-only origin feat/terrain-atmosphere-v2-2
python3 -m http.server 8000
```

Open [http://localhost:8000/](http://localhost:8000/). Fly around heading 032° to find the mountain. Climb to roughly 2,800–3,200 ft AGL over low terrain before crossing the main summit, or stay on the lower shoulders for slope tests. Try wind FROM 270°, then 90°, with 8 m/s mean wind; diagnostics and recordings make the reversal measurable. R resets safely. Response 1× is still the default; 1.7× is available for comparison.

```sh
node tests/physics-regression.mjs
node tests/runtime-reliability.mjs
node tests/atmosphere-regression.mjs
node tests/terrain-regression.mjs
```

Focused checks cover unchanged physics fixtures, terrain/cache determinism, rendered triangle agreement below 2 mm, seams and spawn, wind reversal/speed/altitude attenuation, flat-terrain equivalence, swept wing/high-speed contact, reset, recorder impact data and the optional debug view. Light at 1× and 1.7× stayed finite without stall/reset in 60-second Bush and Fighter runs from spawn. Browser execution remains unavailable here; actual rendered interaction, FPS and subjective playability need desktop review. Terrain wakes are a short local approximation; terrain/weather CFD, real geography, hydrology and weather visuals are deferred.

## Atmosphere and aircraft response (V2.1 baseline)


Light is the default. Flight tuning includes Off / Calm / Light / Breezy, mean speed, meteorological wind FROM direction, gust intensity, and **Turbulence response** (0–3×, default 1×). Response scales the wing/tail moments; center wind and updrafts still affect aerodynamics at 0×. Changing active settings eases mean flow and intensity over three simulation seconds. Off clears all atmospheric effects immediately, preserving ground velocity and orientation. A fresh start in Off follows the exact legacy trajectory.

`src/physics/atmosphere.js` produces environmental conditions without aircraft or rendering knowledge. It combines prevailing wind, broad slow gusts, two scales of local turbulence, and broad vertical airflow using seeded quintic value noise. World position X/Z, altitude and simulation time genuinely affect the field. Noise values and derivatives are continuous across cell boundaries. Mean flow advects the field through an integrated offset, so changing wind settings does not jump the spatial phase. `update(position, time, dt)` advances settings and advection once per fixed step and writes center conditions. `sample(position, time, output)` queries the same environmental state into caller-owned storage; it does not advance the model or overwrite center telemetry. `createConditions()` allocates that storage once. Future visual weather can consume this interface.

`src/physics/airflow-response.js` samples both wings and the tail in world coordinates. Differences in upflow create roll/pitch moments; tail crossflow differences create a yaw moment. Center airflow supplies the net aerodynamic force, while these differences supply pure moments, avoiding duplicate net forces. The loading approximation uses `0.5 × density × airspeed × area × liftSlope`; moments are divided by scalar inertia proxies derived from current mass and approximate span/length. Bush and Fighter have explicit approximate dimensions and inertia scales (1 and 1.8). These are gameplay calibration values, not measurements of the GLB or an inertia tensor. Smooth acceleration limits keep the added disturbance within control authority. Existing stability and stall equations remain intact.

`Flight.massKg` is the common mass source for forces, trim and atmospheric inertia. It currently returns profile mass; future simplified cargo can extend it. No cargo placement model is involved. Tune dimensions, coupling gains and bounds in `airflow-response.js`. The atmosphere itself needs no aircraft-specific changes. The generic field remains independently usable; V2.2 supplies the optional terrain extension in the main application. Clouds, fog and precipitation are not implemented.

World +Z is north, +X east, +Y up; aircraft forward is local +Z. A wind FROM 270° flows toward +X. Heading and ground track remain distinct. Recorder schema `1.0` remains additive; simulation version is now `1.7`, and atmosphere `modelVersion` is `2.2`. Existing wind fields, 10 Hz samples and events remain. Environmental additions include slow gust, local turbulence magnitude/vector and broad vertical airflow in m/s. The separate `airflowResponse` object holds resulting body-axis pitch/roll/yaw accelerations in rad/s², sampled airflow differences, mass in kg and inertia proxies in kg·m². Response-slider changes use existing coalesced `tuning_changed` events (`parameter: turbulenceResponse`); environment changes use `atmosphere_changed`. No per-wing arrays are exported.

Run all focused checks:

```sh
node tests/physics-regression.mjs
node tests/runtime-reliability.mjs
node tests/atmosphere-regression.mjs
```

The atmosphere regression isolates the V2.1 field without the optional terrain extension and prints controlled 60-second hands-off runs at 120 Hz, seed 17391. Within each profile, position, attitude, angular rates, throttle and ground velocity start identically across presets. Velocity starts at `[0, 0, cruiseSpeed]`, including the initial crosswind transient. Maximum altitude deviation uses world altitude; pitch is full range; heading is maximum shortest deviation from initial north. Gust RMS is the RMS magnitude of all variable airflow components. Default 1× response:

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
