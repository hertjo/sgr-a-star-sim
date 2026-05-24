// Mirror of shaders/lib/colormaps.glsl for HUD colorbars.

type RGB = [number, number, number];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function polyEval(
  t: number,
  coeffs: RGB[],
): RGB {
  // Horner's method.
  let r = coeffs[coeffs.length - 1][0];
  let g = coeffs[coeffs.length - 1][1];
  let b = coeffs[coeffs.length - 1][2];
  for (let i = coeffs.length - 2; i >= 0; i--) {
    r = coeffs[i][0] + t * r;
    g = coeffs[i][1] + t * g;
    b = coeffs[i][2] + t * b;
  }
  return [clamp01(r), clamp01(g), clamp01(b)];
}

const INFERNO_COEFFS: RGB[] = [
  [0.000020, 0.001647, -0.019480],
  [0.106692, 0.563648, 3.932646],
  [11.602401, -3.972823, -15.943876],
  [-41.703993, 17.436910, 44.354091],
  [77.162935, -33.402567, -81.808793],
  [-71.319428, 32.626594, 73.209519],
  [25.131114, -12.242661, -23.070794],
];

const VIRIDIS_COEFFS: RGB[] = [
  [0.2777273272234177, 0.005407344544966578, 0.3340998053353061],
  [0.1050930431085774, 1.404613529898575, 1.384590162594685],
  [-0.3308618287255143, 0.214847559468213, 0.09509516302823659],
  [-4.634230498983486, -5.799100973351585, -19.33244095627987],
  [6.228269936347081, 14.17993336680509, 56.69055260068105],
  [4.776384997670288, -13.74514537774601, -65.35303263337234],
  [-5.435455855934631, 4.645852612178535, 26.3124352495832],
];

const PLASMA_COEFFS: RGB[] = [
  [0.05873234392399702, 0.02333670892565664, 0.5433401826748754],
  [2.176514634195958, 0.2383834171260182, 0.7539604599784036],
  [-2.689460476458034, -7.455851135738909, 3.110799939717086],
  [6.130348345893603, 42.3461881477227, -28.51885465332158],
  [-11.10743619062271, -82.66631109428045, 60.13984767418263],
  [10.02306557647065, 71.41361770095349, -54.07218655560067],
  [-3.658713842777788, -22.93153465461149, 18.19190778539828],
];

export function inferno(t: number): RGB {
  return polyEval(clamp01(t), INFERNO_COEFFS);
}

export function viridis(t: number): RGB {
  return polyEval(clamp01(t), VIRIDIS_COEFFS);
}

export function plasma(t: number): RGB {
  return polyEval(clamp01(t), PLASMA_COEFFS);
}

export function hotDensity(t: number): RGB {
  t = clamp01(t);
  const lerp = (a: RGB, b: RGB, k: number): RGB => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  if (t < 0.25) return lerp([0.02, 0.02, 0.02], [0.30, 0.05, 0.05], t / 0.25);
  if (t < 0.55) return lerp([0.30, 0.05, 0.05], [0.95, 0.20, 0.10], (t - 0.25) / 0.30);
  if (t < 0.80) return lerp([0.95, 0.20, 0.10], [1.00, 0.65, 0.25], (t - 0.55) / 0.25);
  return lerp([1.00, 0.65, 0.25], [1.00, 0.98, 0.92], (t - 0.80) / 0.20);
}

export function magRainbow(t: number): RGB {
  t = clamp01(t);
  const stops: RGB[] = [
    [0.30, 0.78, 1.00],
    [0.20, 0.88, 0.40],
    [0.92, 0.90, 0.20],
    [1.00, 0.52, 0.10],
    [0.95, 0.15, 0.18],
    [1.00, 0.45, 0.78],
  ];
  const seg = t * (stops.length - 1);
  const i = Math.min(Math.floor(seg), stops.length - 2);
  const k = seg - i;
  const a = stops[i];
  const b = stops[i + 1];
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

// Build a CSS linear-gradient stop string for a colormap.
export function cssGradient(
  cmap: (t: number) => RGB,
  stops = 16,
  direction: "to top" | "to right" | "to bottom" | "to left" = "to top",
): string {
  const parts: string[] = [];
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const [r, g, b] = cmap(t);
    const r8 = Math.round(r * 255);
    const g8 = Math.round(g * 255);
    const b8 = Math.round(b * 255);
    parts.push(`rgb(${r8}, ${g8}, ${b8}) ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(${direction}, ${parts.join(", ")})`;
}
