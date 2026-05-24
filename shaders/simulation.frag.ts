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

// Sample a frame from the radiation-intensity atlas at (plot-space x, y).
// Frame is selected by current uTime mapped onto uDataDuration.
// Returns brightness in [0, 1] (log-normalized Inu).
float sampleRadAtlas(vec2 p) {
  // Plot -> in-frame UV (V starts at top of plot because the atlas was
  // baked with flipY=false; the python script already flipped the array).
  float u = (p.x - PLOT_XMIN) / (PLOT_XMAX - PLOT_XMIN);
  float v = (PLOT_YMAX - p.y) / (PLOT_YMAX - PLOT_YMIN);
  // Clamp inside tile so we never bleed across tile borders during
  // bilinear filtering.
  float pad = 0.5 / 256.0;     // half-texel of tile (TILE_W = 256)
  u = clamp(u, pad, 1.0 - pad);
  v = clamp(v, pad, 1.0 - pad);

  float f = floor(mod(uTime, uDataDuration) / uDataDuration * uAtlasFrames);
  f = clamp(f, 0.0, uAtlasFrames - 1.0);

  float col = mod(f, uAtlasCols);
  float row = floor(f / uAtlasCols);

  vec2 atlasUV = vec2(
    (col + u) / uAtlasCols,
    (row + v) / uAtlasRows
  );
  return texture2D(uRadAtlas, atlasUV).r;
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
    // ---------------- Right half: Density (smooth continuous gradient) -------
    // Density stays procedural for now — the public dataset only ships
    // radially-averaged density profiles, not 2D snapshots.
    float rho = density(p, uTime);
    float rhoN = clamp(rho * 1.4, 0.0, 1.0);
    rhoN = pow(rhoN, 0.7);

    vec3 cBg     = vec3(0.97, 0.97, 0.96);
    vec3 cCream  = vec3(0.97, 0.90, 0.85);
    vec3 cSalmon = vec3(0.97, 0.65, 0.50);
    vec3 cRed    = vec3(0.93, 0.30, 0.22);
    vec3 cCore   = vec3(0.78, 0.18, 0.18);

    if (rhoN < 0.25) {
      col = mix(cBg, cCream, rhoN / 0.25);
    } else if (rhoN < 0.55) {
      col = mix(cCream, cSalmon, (rhoN - 0.25) / 0.30);
    } else if (rhoN < 0.85) {
      col = mix(cSalmon, cRed, (rhoN - 0.55) / 0.30);
    } else {
      col = mix(cRed, cCore, (rhoN - 0.85) / 0.15);
    }

    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.55 * ring;
  }

  // ---------------- Subtle vertical divider at x = 0 -----------------------
  float divider = smoothstep(0.14, 0.0, abs(p.x));
  col = mix(col, vec3(0.0), divider * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;
export default source;
