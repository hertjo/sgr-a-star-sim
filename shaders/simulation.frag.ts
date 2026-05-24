const source = `
// Sgr A* split-view fragment shader.
//
// Layout (matches Andrew Chael's video):
//   right half (x > 0):   Density (grayscale + soft red plasma core)
//   left half (x < 0):
//     top quadrant   (y > 0):  Radiation Power  (viridis colormap)
//     bottom quadrant(y < 0):  Magnetic Field Strength (inferno-like)
//
// Header (precision + varying + uniform decls) and libraries are prepended
// at compile time by SimulationPlane.tsx so the symbols below are in scope.

const float PLOT_XMIN = -60.0;
const float PLOT_XMAX =  60.0;
const float PLOT_YMIN = -30.0;
const float PLOT_YMAX =  30.0;

// Draws iso-contour bands of value v at integer multiples of "spacing".
// Uses fwidth(v) so the band thickness stays roughly constant in screen
// pixels regardless of how steep the gradient is locally — which means
// the lines naturally hug the bright filaments in the Inu data instead
// of forming big blobs in the dim outer regions.
float isoContours(float v, float spacing) {
  float phase = mod(v, spacing);
  float toEdge = min(phase, spacing - phase);   // distance to nearest level
  float fw = max(fwidth(v), 1e-5);
  return smoothstep(fw * 1.6, fw * 0.4, toEdge);
}

// Sample a frame from the radiation-intensity atlas at (plot-space x, y).
// The frame index is a continuous fraction of uTime; we sample both the
// floor and ceil frames and linearly interpolate between them so the
// plasma evolves smoothly instead of jumping every ~370ms when crossing
// a frame boundary (101 frames over 37s = visible stepping otherwise).
float sampleAtlasFrame(float u, float v, float f) {
  float col = mod(f, uAtlasCols);
  float row = floor(f / uAtlasCols);
  vec2 uv = vec2(
    (col + u) / uAtlasCols,
    (row + v) / uAtlasRows
  );
  return texture2D(uRadAtlas, uv).r;
}

float sampleRadAtlas(vec2 p) {
  // Plot -> in-frame UV (V starts at top of plot because the atlas was
  // baked with flipY=false; the python script already flipped the array).
  float u = (p.x - PLOT_XMIN) / (PLOT_XMAX - PLOT_XMIN);
  float v = (PLOT_YMAX - p.y) / (PLOT_YMAX - PLOT_YMIN);
  // Clamp inside tile so bilinear filtering never bleeds across borders.
  float pad = 0.5 / 256.0;
  u = clamp(u, pad, 1.0 - pad);
  v = clamp(v, pad, 1.0 - pad);

  float fContinuous = mod(uTime, uDataDuration) / uDataDuration * uAtlasFrames;
  float fa = floor(fContinuous);
  float fb = mod(fa + 1.0, uAtlasFrames);
  float t = fContinuous - fa;
  // Smoothstep the interpolation so the eye reads it as truly continuous
  // motion rather than a piecewise-linear "ease".
  t = t * t * (3.0 - 2.0 * t);

  float a = sampleAtlasFrame(u, v, fa);
  float b = sampleAtlasFrame(u, v, fb);
  return mix(a, b, t);
}

void main() {
  vec2 p = vPos;
  float r = length(p);

  // ---------------- Black hole shadow ----------------
  if (r < R_HORIZON) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec3 col;

  if (p.x < 0.0) {
    // ---------------- Left half: split at the equator (y = 0) -----------------
    float radValue;
    if (uUseData > 0.5) {
      // Real Sgr A* GRMHD radiation intensity (Yoon+ 2020) — same field
      // sampled on both halves; the two halves use different colormaps,
      // as in the reference video.
      radValue = sampleRadAtlas(p);
      // The atlas covers the full plot box, so the top and bottom quadrants
      // each get the upper / lower half of the same intensity image — which
      // is exactly the symmetry the reference shows.
    } else {
      // Procedural fallback.
      float P = radiationPower(p, uTime);
      float B = bFieldMag(p, uTime);
      radValue = (p.y >= 0.0)
        ? pow(clamp(P / 1.0, 0.0, 1.0), 0.55)
        : pow(clamp(B / 1.6, 0.0, 1.0), 0.65);
    }

    if (p.y >= 0.0) {
      // Top: Radiation Power -> viridis.
      col = viridis(radValue);
    } else {
      // Bottom: Magnetic Field Strength -> inferno.
      col = inferno(radValue);
    }

    // Thin equator divider line, just like the source.
    float eqLine = smoothstep(0.18, 0.0, abs(p.y));
    col = mix(col, vec3(0.0), eqLine * 0.5);

    // Photon ring darkening.
    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.55 * ring;
  } else {
    // ---------------- Right half: Density --------------------------------------
    // Synchrotron emissivity ~ rho * |B|^2 * T_e, so the Yoon Inu atlas is
    // structurally a strong proxy for plasma density. We sample the same
    // atlas as the left half but push it through a soft pink->red density
    // colormap, exactly mirroring how the reference video's density panel
    // looks (smooth bright plasma core fading into an off-white background).
    float rhoN;
    if (uUseData > 0.5) {
      rhoN = sampleRadAtlas(p);
      // Push dim/outer regions hard toward off-white background so the
      // density panel reads as "smooth plasma blob on white" like the
      // reference, with the filaments only barely showing in the bright
      // disk core.
      rhoN = pow(rhoN, 3.0);
    } else {
      float rho = density(p, uTime);
      rhoN = pow(clamp(rho * 1.4, 0.0, 1.0), 0.7);
    }

    // Smooth two-segment blend (no piecewise stops -> no visible banding):
    //   bg -> mid (salmon) over [0, 0.6]
    //   mid -> core (deep red) over [0.6, 1]
    vec3 cBg   = vec3(0.96, 0.96, 0.95);
    vec3 cMid  = vec3(0.97, 0.72, 0.62);
    vec3 cCore = vec3(0.88, 0.30, 0.25);
    col = mix(
      mix(cBg, cMid, smoothstep(0.0, 0.6, rhoN)),
      cCore,
      smoothstep(0.55, 1.0, rhoN)
    );

    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.55 * ring;
  }

  // ---------------- White iso-contours of the real Inu field --------------
  // Only when sampling real GRMHD data and only on the left half (the
  // radiation / |B| panels — the density panel in the reference has no
  // contour overlay). The contours are derived from the same field that
  // colors the background, so by construction they trace the actual
  // bright filaments instead of an unrelated procedural topology.
  if (uUseData > 0.5 && p.x < 0.0 && r > R_PHOTON + 0.3) {
    float vSample = sampleRadAtlas(p);
    float line = isoContours(vSample, 0.075);     // ~13 contour levels
    // Strongest where there's actually emission so dim outer regions
    // don't get hatched.
    line *= smoothstep(0.05, 0.25, vSample);
    col = mix(col, vec3(1.0), line * 0.85);
  }

  // ---------------- Subtle vertical divider at x = 0 -----------------------
  float divider = smoothstep(0.14, 0.0, abs(p.x));
  col = mix(col, vec3(0.0), divider * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;
export default source;
