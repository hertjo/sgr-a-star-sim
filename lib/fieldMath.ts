// JS mirror of shaders/lib/fields.glsl — used to generate explicit
// streamline geometry (Three.js Lines) on top of the shader plane.
//
// Only `streamFunction` and `bField` are needed here; the density /
// radiation fields live entirely in GLSL.

export const R_HORIZON = 2.0;
export const PLOT_W = 120; // total width in r_g
export const PLOT_H = 60;  // total height in r_g

// Cheap deterministic hash → [-1, 1]. Good enough for the static
// streamline seed turbulence; the heavy turbulence is rendered in GLSL.
function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return 2 * (s - Math.floor(s)) - 1;
}

function smoothNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (
    a * (1 - u) * (1 - v) +
    b * u * (1 - v) +
    c * (1 - u) * v +
    d * u * v
  );
}

function fbm(x: number, y: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 4; i++) {
    sum += amp * smoothNoise(x * freq, y * freq);
    freq *= 2.05;
    amp *= 0.52;
  }
  return sum;
}

export function streamFunction(x: number, y: number, t: number): number {
  const r = Math.hypot(x, y);
  const rs = Math.max(r, 0.001);

  const radial = (r * r) / ((r + 1.5) * (r + 1.5));
  const decay = Math.exp(-r / 32.0);
  const psi1 = (y / rs) * radial * decay * 8.0;

  const jetMask =
    Math.exp(-Math.pow(x / 5.0, 2)) *
    Math.max(0, Math.min(1, (Math.abs(y) - 2.5) / (10.0 - 2.5)));
  const psi2 = -x * jetMask * 5.0;

  const wx = fbm(x * 0.07 + t * 0.030, y * 0.07);
  const wy = fbm(x * 0.07 + 7.13, y * 0.07 - t * 0.030);
  const psi3 = 1.4 * fbm(x * 0.13 + 2.8 * wx, y * 0.13 + 2.8 * wy + t * 0.040);

  return psi1 + psi2 + psi3;
}

export function bField(x: number, y: number, t: number): [number, number] {
  const eps = 0.18;
  const dpx =
    (streamFunction(x + eps, y, t) - streamFunction(x - eps, y, t)) /
    (2 * eps);
  const dpy =
    (streamFunction(x, y + eps, t) - streamFunction(x, y - eps, t)) /
    (2 * eps);
  return [dpy, -dpx];
}

// Integrate a streamline from a seed in both directions.
// Returns an array of [x, y] in plot-space.
export function traceStreamline(
  seedX: number,
  seedY: number,
  t: number,
  opts: {
    stepSize?: number;
    maxSteps?: number;
    maxRadius?: number;
  } = {},
): [number, number][] {
  const h = opts.stepSize ?? 0.4;
  const N = opts.maxSteps ?? 250;
  const RMAX = opts.maxRadius ?? 58;

  const forward: [number, number][] = [];
  const backward: [number, number][] = [];

  // RK2 step in direction `sign` (+1 = forward, -1 = backward).
  const step = (x: number, y: number, sign: 1 | -1): [number, number] | null => {
    const [b1x, b1y] = bField(x, y, t);
    const bm1 = Math.hypot(b1x, b1y);
    if (bm1 < 1e-6) return null;
    const u1x = (b1x / bm1) * sign;
    const u1y = (b1y / bm1) * sign;
    // Midpoint
    const mx = x + 0.5 * h * u1x;
    const my = y + 0.5 * h * u1y;
    const [b2x, b2y] = bField(mx, my, t);
    const bm2 = Math.hypot(b2x, b2y);
    if (bm2 < 1e-6) return null;
    const nx = x + h * (b2x / bm2) * sign;
    const ny = y + h * (b2y / bm2) * sign;
    return [nx, ny];
  };

  // Forward
  let x = seedX;
  let y = seedY;
  forward.push([x, y]);
  for (let i = 0; i < N; i++) {
    const next = step(x, y, 1);
    if (!next) break;
    [x, y] = next;
    const r = Math.hypot(x, y);
    if (r < R_HORIZON || r > RMAX) break;
    if (Math.abs(x) > 62 || Math.abs(y) > 32) break;
    forward.push([x, y]);
  }
  // Backward
  x = seedX;
  y = seedY;
  for (let i = 0; i < N; i++) {
    const prev = step(x, y, -1);
    if (!prev) break;
    [x, y] = prev;
    const r = Math.hypot(x, y);
    if (r < R_HORIZON || r > RMAX) break;
    if (Math.abs(x) > 62 || Math.abs(y) > 32) break;
    backward.push([x, y]);
  }

  return [...backward.reverse(), ...forward];
}
