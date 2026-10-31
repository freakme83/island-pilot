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
| `src/physics/ground-handling.js`, `src/world/runway.js` | Bush three-point contact/tire forces; tarmac properties, runway dimensions and shared local leveling. |
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

## V2.3 tarmac ground-handling baseline

PR #3 was verified merged; this work starts from remote `main` at `622f3e8995c63a21194e91b031ab8371e940badb`. The original airborne start remains the default. In **Flight tuning → Start position**, choose **Bush · tarmac runway** for ground testing; switching start resets the flight, and **R** repeats the selected start. Fighter keeps its existing airborne behavior and has no wheel model in this milestone.

The asphalt strip is **1,200 × 40 m**, centered at **X −1000, Z −1600 m**, elevation **100 m**, aligned **000°/180°** (+Z north). Ground spawn is at `(−1000, −2100)` m, pointing north, stationary at zero throttle. The site is about 1.6 km south of the original airborne spawn and well away from the mountain. Existing terrain varied by less than 8 m along the strip. A small shared-height plateau blends into that terrain: fully flat over 220 × 1,420 m, fading out within 580 × 1,780 m. Its margins accommodate the existing 83 m terrain grid; rendering, wheel contact, collision, AGL and terrain airflow all sample the same surface. Asphalt/markings add two static draw calls, with trees excluded from the strip. There are no new assets or dependencies.

**Controls:** Shift increases throttle; Ctrl decreases it (23 percentage points/second). Try 15–25% power to taxi. Q/E reuse the existing yaw control sense for tailwheel steering; steering angle reduces with speed. The inherited control sense is Q toward increasing heading, E toward decreasing heading. Hold **B** for wheel brakes, reduce power to stop, and use **R** to reset. W/S and A/D retain their flight controls. Choose **Airborne** to return to the original flight start. Use Off for repeatable calm comparisons, then Light to test wind; hold B while parked in gusts.

`src/physics/ground-handling.js` implements a three-point **taildragger**, measured from the existing leveled Bush GLB (`wheel-l`, `wheel-r`, `wheel-tail`). Main contact points are ±1.2 m across, 1.398 m forward and 1.818 m below the flight pivot; the tailwheel is 3.952 m aft and 0.725 m below it. Reset solves the static spring balance, giving about 11.5° nose-up attitude and a pivot height of 101.468 m. Each wheel supplies positive vertical spring/damper support (70,000 N/m, 7,600 N·s/m), with bounded safe compression and descent. There is no per-step height snap or parking velocity reset. Visual gear remains unchanged; small tire penetration represents compliance.

The original thrust, drag, lift, side force, atmospheric response and control equations remain active. Wheel forces share the existing mass and scalar inertia proxies. Coupled tire impulses oppose longitudinal movement and lateral slip, with each wheel limited by its current load and grip. The sole `tarmac` definition supplies rolling resistance `Crr = 0.018`, brake grip 0.45 and lateral grip 0.7. Brake input adds load-dependent longitudinal friction and cannot drive the aircraft backward; low-speed friction can balance small thrust without endless numerical creep. Wind changes airspeed, lift, side force and weathercocking through the existing atmosphere/aerodynamics; lateral tire grip resists floating sideways. Sustained wind can still move or turn an unbraked aircraft, and strong gusts can overcome grip.

As lift develops, spring support falls, reducing rolling resistance and brake authority. Contact ceases geometrically when the wheels leave the surface; there is no takeoff-speed switch or runway glue. An uncontrolled Off/full-power run naturally lifted off near 125 km/h after about 624 m; this is an observation, **not takeoff-performance calibration**. Rotation, landings, suspension travel, propwash and low-speed aerodynamic tuning remain for V2.4/later. The legacy stall model still reports raw high-AoA/sideslip conditions at very low airspeed; the HUD suppresses flight stall cautions during loaded taxi below 8 m/s, while recorder diagnostics remain intact.

Normal wheel support is separated from destructive contact. Bush airframe-only collision proxies replace the old coarse body spheres that included gear; swept nose/propeller, body, wings, tail and fin contact remains active against shared terrain/water. Excessive gear compression, gear descent above 3 m/s or wheel contact outside asphalt triggers the existing impact/reset path. R and automatic recovery repeat the selected start. **Only tarmac supports ordinary wheel contact**: rolling off its edge can reset the aircraft. Fighter retains the original collision proxies. This is a taxi baseline, not a general terrain landing system.

The compact ground strip reports selected runway start, observed contact/motion status, horizontal groundspeed in km/h and B/brake state. These statuses impose no speed limit. Recorder schema remains additive `1.0`; simulation version is `1.8`, atmosphere remains `2.2`. Initial metadata includes runway, tarmac and contact tuning. Samples add `startMode` and `groundHandling`: contact count/state, normal load/support ratio, actual rolling/braking/lateral forces, steering/brake input, surface and horizontal groundspeed. Support ratio can briefly exceed one during transients. Existing root groundspeed remains the 3D magnitude. `start_mode_changed` records selection; `wheel_contact_enter/exit` confirm 100 ms of stable contact change (including the beginning timestamp), avoiding zero-load chatter without filtering physics or raw samples. Destructive `ground_contact` events remain compatible. No per-wheel sample arrays are added.

### Focused validation

All five existing/new Node checks pass. Physics fixtures retain all eight exact Bush and Fighter checkpoints. V2.2 mountain height, mesh agreement, airflow reversal, swept collision and terrain recorder checks pass unchanged. The new ground check covers static contact, thrust, load-dependent rolling/brakes, mirrored steering, crosswind grip, natural unloading/liftoff, no airborne brake effect, safe/unsafe collision separation, both start/reset modes and additive recorder export. The interface harness exercises start selection, B key transitions/indicator/export, R reset and Fighter restrictions; it does not render WebGL.

| Deterministic Bush check (120 Hz, seed 17391) | Measured result |
| --- | --- |
| Off, zero throttle, parked 60 s | 0.046 mm position drift; three loaded wheels |
| Off, 20% / 40% throttle after 30 s | 5.44 / 12.87 m/s groundspeed |
| Off, brake from 8 m/s | Below 0.05 m/s at 1.80 s; 7.30 m travel; 5.6 mm spring-settling rollback |
| Off, Q/E for 3 s from 3 m/s | Mirrored ±29.97° heading change; bounded roll |
| 8 m/s steady crosswind, 10 s taxi | 3.98 m cross-track change; 18.45° weathercock heading change |
| Light, braked parking 60 s | Less than 2 cm displacement |
| Off, full-power natural unloading | First raw liftoff at 31.52 s, 34.72 m/s, 623.91 m run; one confirmed exit event |

Actual browser playtesting was **not completed**: no local Chromium executable was available, and the separate remote browser returned an authentication error instead of reaching this workspace's HTTP server. The runway's rendered appearance, FPS, camera feel and subjective taxi handling still need the desktop checks below. These numerical results establish behavior and regression coverage, not gameplay quality.

### Mac testing

With the existing Desktop clone, fetch/switch/update this feature branch and serve the repository root (Python 3 required):

```sh
cd ~/Desktop/island-pilot
git fetch origin
git switch feat/ground-handling-v2-3
git pull --ff-only origin feat/ground-handling-v2-3
python3 -m http.server 8000
```

In a second Terminal window:

```sh
open http://localhost:8000/
```

Choose Bush, Atmosphere Off and the tarmac start. Check stationary wheels, then add 15–25% power, steer gently with Q/E, reduce power and hold B. Reset between tests. Compare Light/headwind/crosswind with the ground and terrain diagnostics and 10 Hz recorder. Try higher power on the centerline to observe reduced support; takeoff handling is uncalibrated. Test pavement-edge recovery, then select Airborne and fly toward the V2.2 mountain (about heading 032° from the original spawn). Confirm Fighter airborne controls and recorder still work. Quit the server with Ctrl+C.

For code-level checks (Node 18+; no install required):

```sh
node tests/physics-regression.mjs
node tests/runtime-reliability.mjs
node tests/atmosphere-regression.mjs
node tests/terrain-regression.mjs
node tests/ground-regression.mjs
```

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
