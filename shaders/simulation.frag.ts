const source = `
// Sgr A* split-view fragment shader.
//
// Quadrant layout (split by uXSplit / uYSplit):
//   x > uXSplit                Density
//   x < uXSplit, y > uYSplit   Radiation Power (viridis)
//   x < uXSplit, y < uYSplit   Magnetic Field Strength (inferno)
//
// Header (precision + varyings + uniform decls) and the noise / colormaps
// / fields libraries are prepended at compile time by SimulationPlane.tsx
// so the symbols below are in scope.

const float PLOT_XMIN = -60.0;
const float PLOT_XMAX =  60.0;
const float PLOT_YMIN = -30.0;
const float PLOT_YMAX =  30.0;

// Iso-contour bands of \`v\` at integer multiples of \`spacing\`. Uses
// fwidth(v) so the band thickness stays roughly constant in screen
// pixels regardless of local gradient steepness — the lines naturally
// hug bright filaments rather than forming blobs in dim regions.
float isoContours(float v, float spacing) {
  float phase = mod(v, spacing);
  float toEdge = min(phase, spacing - phase);
  float fw = max(fwidth(v), 1e-5);
  return smoothstep(fw * 1.6, fw * 0.4, toEdge);
}

float sampleAtlasFrame(float u, float v, float f) {
  float col = mod(f, uAtlasCols);
  float row = floor(f / uAtlasCols);
  vec2 uv = vec2(
    (col + u) / uAtlasCols,
    (row + v) / uAtlasRows
  );
  return texture2D(uRadAtlas, uv).r;
}

// Sample the radiation-intensity atlas at (plot-space x, y). Linearly
// interpolates between adjacent atlas frames so the plasma evolves
// continuously rather than stepping at frame boundaries.
float sampleRadAtlas(vec2 p) {
  float u = (p.x - PLOT_XMIN) / (PLOT_XMAX - PLOT_XMIN);
  float v = (PLOT_YMAX - p.y) / (PLOT_YMAX - PLOT_YMIN);
  // Half-texel pad keeps bilinear filtering inside the current tile.
  float pad = 0.5 / 256.0;
  u = clamp(u, pad, 1.0 - pad);
  v = clamp(v, pad, 1.0 - pad);

  float fContinuous = mod(uTime, uDataDuration) / uDataDuration * uAtlasFrames;
  float fa = floor(fContinuous);
  float fb = mod(fa + 1.0, uAtlasFrames);
  float t = fContinuous - fa;

  float a = sampleAtlasFrame(u, v, fa);
  float b = sampleAtlasFrame(u, v, fb);
  return mix(a, b, t);
}

void main() {
  vec2 p = vPos;
  float r = length(p);

  vec3 col;

  if (p.x < uXSplit) {
    float radValue;
    if (uUseData > 0.5) {
      radValue = sampleRadAtlas(p);
    } else {
      float P = radiationPower(p, uTime);
      float B = bFieldMag(p, uTime);
      radValue = (p.y >= uYSplit)
        ? pow(clamp(P / 1.0, 0.0, 1.0), 0.55)
        : pow(clamp(B / 1.6, 0.0, 1.0), 0.65);
    }

    col = (p.y >= uYSplit) ? viridis(radValue) : inferno(radValue);

    // Thin horizontal divider at the equator (uYSplit).
    float eqLine = smoothstep(0.18, 0.0, abs(p.y - uYSplit));
    col = mix(col, vec3(0.0), eqLine * 0.5);
  } else {
    // Density panel: black -> deep red -> red-orange -> bright orange -> yellow.
    float rhoN;
    if (uUseData > 0.5) {
      rhoN = sampleRadAtlas(p);
    } else {
      float rho = density(p, uTime);
      rhoN = pow(clamp(rho * 1.4, 0.0, 1.0), 0.7);
    }

    vec3 cBlack   = vec3(0.00, 0.00, 0.00);
    vec3 cDeepRed = vec3(0.30, 0.03, 0.02);
    vec3 cRed     = vec3(0.80, 0.15, 0.05);
    vec3 cOrange  = vec3(1.00, 0.50, 0.10);
    vec3 cYellow  = vec3(1.00, 0.85, 0.45);

    col =          mix(cBlack,  cDeepRed, smoothstep(0.00, 0.20, rhoN));
    col = mix(col, cRed,        smoothstep(0.18, 0.50, rhoN));
    col = mix(col, cOrange,     smoothstep(0.45, 0.80, rhoN));
    col = mix(col, cYellow,     smoothstep(0.80, 1.00, rhoN));
  }

  // White iso-contours over the radiation / |B| panels only.
  if (uUseData > 0.5 && p.x < uXSplit && r > R_PHOTON + 0.3) {
    float vSample = sampleRadAtlas(p);
    float line = isoContours(vSample, 0.075);
    line *= smoothstep(0.05, 0.25, vSample);
    col = mix(col, vec3(1.0), line * 0.85);
  }

  // Vertical divider at uXSplit.
  float divider = smoothstep(0.14, 0.0, abs(p.x - uXSplit));
  col = mix(col, vec3(0.0), divider * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;
export default source;
