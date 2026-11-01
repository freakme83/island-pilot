# Chios Terrain Lab v1

An isolated static experiment. Start at repository root: `python3 -m http.server 8000` and open <http://localhost:8000/terrain-lab/>. The simulator at `/` is unchanged. No terrain network service is used. Three.js r180 and OrbitControls are vendored locally because the simulator's existing bundle exports only a small subset of Three.js; the simulator and its bundle are untouched.

Overview: drag to orbit, right-drag to pan, wheel to zoom. Explorer: select Explorer, click the scene for pointer lock, move the mouse to look; W/A/S/D move and R/F move vertically. Escape releases the mouse. Select a movement speed. The four presets work in both modes. Controls don't capture movement keys while the pointer is unlocked. LOD unchecked uses fixed step 4 for comparison. Frame stats use the last 300 frames (up to 5 seconds at 60 FPS); 1% low is inverse p99 frame time, not a benchmark.

## Data and regeneration

Source: supplied Copernicus GLO-30 `output_hh.tif`; retain the source and check its licensing and attribution requirements before redistribution or publication. This DEM is a digital **surface** model and can include vegetation and buildings; it isn't precise bare-earth ground. The raster has PixelIsPoint coordinates: metadata gives sample-centre bounds, not outer pixel bounds. X east, Z south, Y up, in metres. WGS84 ellipsoid tangent-scale approximation at the centre preserves 1:1 local horizontal and vertical scale; curvature and projection distortion grow with distance and are not modelled. Binary is little-endian Float32, north-to-south row-major. All source values, including zero and negatives, are preserved without quantization. No nodata or invalid samples were found. The dataset has no coastline/land mask: zero is not proof of sea.

Regenerate with Python 3, Pillow and NumPy (`python3 -m pip install Pillow numpy`), then:

```sh
tar --no-same-owner -xzf rasters_COP30.tar.gz output_hh.tif
python3 terrain-lab/scripts/prepare.py output_hh.tif
node terrain-lab/tests/height.test.js
```

The source SHA-256 and raster statistics are recorded in metadata. The script rejects invalid/nodata values rather than guessing how to fill them. Verify source georeferencing if using any other input. The file is EPSG:4326, single band, 1343 × 1689, nominal 30 m; source sample-centre extent is 32.58 × 52.05 km, elevations −1.92 to 1286.45 m. This covers the supplied rectangle, which may contain other land beyond Chios.

## Geometry, heights and limitations

Tiles cover at most 128 × 128 source cells. Distance selects steps 1, 2, 4 or 8 (roughly 30, 60, 120, 240 m); fixed mode uses 4. Changes are evaluated twice per second; only changed geometries are rebuilt and the replaced GPU geometry is disposed. Downward 120 m skirts hide most cracks at different LOD boundaries; extremely steep seams or skirts visible near ground should be checked in a real browser. Frustum culling is provided by Three.js; draw calls and triangles include all scene objects. Memory use and performance vary by browser/GPU and number of nearby fine tiles.

`makeTerrain(...).heightAt(x,z)` performs bilinear interpolation on the original DEM, independent of LOD and returns null outside the rectangle. It preserves metres and is the intended starting point for a future deterministic modifier layer. Rendered meshes use piecewise triangular interpolation, and coarser LODs skip samples, so a sampled height can differ from the visible mesh between vertices. Collision against a coarse visible mesh therefore needs a deliberate policy; no existing simulator ground function is changed.

Ocean is a simple plane at 0 m. Fully zero-valued terrain triangles are omitted to avoid coplanar depth fighting; this is a **rendering heuristic**, not classification in the underlying data. A genuinely flat zero-height land surface may consequently appear as sea. Negative and mixed zero/nonzero terrain can intersect the water plane; no reliable land mask or reconstructed shoreline exists. Flicker, jagged shorelines, vertical skirt walls, popping and coarse-detail changes remain possible; assess them during a real browser flyover. No near-plane change is presented as a shoreline fix: near=2 m and far=160 km trade close viewing against depth precision. No roads, airport flattening or terrain editing is applied. Future modifications should operate deterministically on the same source/query used when regenerating meshes; seam and collision behavior must be addressed alongside them.

## Checks

`node terrain-lab/tests/height.test.js` checks real-data counts/range, orientation endpoints, out-of-bounds behavior, and synthetic bilinear interpolation. Compare LOD on/off, wireframe and tile borders while moving close to seams; inspect coastlines at different angles and speeds. Check CPU/GPU and FPS on the target Mac, and open `/` to confirm the existing simulator still runs. Do not interpret source subdivision as new 4 m geographic detail.
