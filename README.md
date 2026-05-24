# Sgr A* Simulation

Interactive recreation of Andrew Chael's *Sgr A\* Simulation* visualization —
a GRMHD-style split-view of an accretion flow around Sagittarius A\*, rendered
in real time in the browser with custom GLSL shaders and React Three Fiber.

The plot mirrors the layout from the reference video:

- **Top-left quadrant** (`x < 0`, `y > 0`) — *Radiation Power* in viridis
  (cyan → green → yellow).
- **Bottom-left quadrant** (`x < 0`, `y < 0`) — *Magnetic Field Strength*
  in inferno (purple → magenta → orange → yellow). The two left quadrants
  are separated by a thin equator line, exactly like the source.
- **Right half** (`x > 0`) — *Density* on a soft off-white background with
  a hot-density overlay in the densest plasma core.
- **Black hole shadow** at the origin with a faint photon-ring darkening
  at `r ≈ 2.6 r_g`.
- **White streamlines** are integrated along the analytic magnetic field
  `B = ∇ × ψ` (see `lib/fieldMath.ts`) and drawn as Three.js
  `LineSegments` over the shader plane. They animate smoothly because
  every frame's geometry is precomputed in a Web Worker at startup.
- **Three left-edge colorbars** echo the source video's tick magnitudes.
- **Camera controller** — orbit (drag), pan (right-drag), zoom (scroll),
  with a reset button in the top-right corner.

The plasma/field state is entirely procedural — no precomputed simulation
data is shipped. See `shaders/lib/fields.ts` for the analytic recipes.

## Running

```bash
npm install
npm run dev
# open http://localhost:3000 (or PORT=3010 npm run dev if 3000 is taken)
```

A short "tracing magnetic field lines…" loading bar appears for ~1 second
on first load while the streamline worker computes all 60 frames of line
geometry. After that the simulation runs at the browser's vsync rate.

## Project layout

```
app/                          Next.js App Router root
components/
  Simulation.tsx              Composition root: Canvas + HUD + time loop
  SimulationPlane.tsx         Shader-driven plane mesh
  MagneticFieldLines.tsx      Streamline player: useFrame swaps prebuilt geom
  CameraController.tsx        OrbitControls + imperative reset handle
  hud/                        Tailwind overlays (labels, colorbars, controls,
                              loading screen)
lib/
  fieldMath.ts                JS streamFunction + bField + RK2 streamline trace
  streamlineSeeds.ts          Shared seed grid (used by worker & main)
  streamlineWorker.ts         Web Worker: precomputes N frames of line geometry
  colormaps.ts                TS mirror of GLSL colormaps for HUD bars
shaders/
  simulation.vert.ts          Pass-through vertex shader (plane geometry)
  simulation.frag.ts          Split-view assembly
  lib/
    noise.ts                  2D simplex + fbm + domain-warped fbm
    colormaps.ts              inferno / viridis / plasma / hotDensity / magRainbow
    fields.ts                 density, radiationPower, streamFunction, bField
```

The `.ts` shader files export GLSL as template-string defaults — bundler-
agnostic, no loader configuration required. `SimulationPlane.tsx` concatenates
a header + the noise/colormaps/fields libraries + the main fragment shader
before handing the whole thing to a `ShaderMaterial`.

## Performance

The slow part of this kind of visualization is integrating streamlines
through a turbulent field — domain-warped fbm is expensive, and tracing
~250 seeds × 180 RK2 steps × ~8 fbm evaluations per step adds up to
hundreds of thousands of noise lookups per frame. The naïve approach
(re-tracing every few frames on the main thread) shows up as a visible
hitch every half-second.

Instead, on mount, a Web Worker traces every seed at every frame in the
simulation's loop (60 frames over 37s) and posts back the line-segment
position buffers as transferable `Float32Array`s. The main thread builds
a `BufferGeometry` per frame, and inside `useFrame` we just swap which
geometry the `LineSegments` object renders — a single ref assignment.
The browser then runs at vsync.

## Tuning

The look lives mostly in two places:

- `shaders/lib/fields.ts` — physics of density/B/radiation. Change the
  `streamFunction` to reshape the field topology; tweak the `density`
  and `radiationPower` formulas for different emission patterns.
- `shaders/simulation.frag.ts` — the blending of those fields into the
  final color. The `clamp(P / N)` and `smoothstep` thresholds control
  which features dominate each quadrant.
