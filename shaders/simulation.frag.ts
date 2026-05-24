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
    // Sample fields once.
    float B   = bFieldMag(p, uTime);
    float P   = radiationPower(p, uTime);

    if (p.y >= 0.0) {
      // Top: Radiation Power in viridis.
      float pN = clamp(P / 1.0, 0.0, 1.0);
      pN = pow(pN, 0.55);
      col = viridis(pN);
    } else {
      // Bottom: Magnetic Field Strength in inferno.
      float bN = clamp(B / 1.6, 0.0, 1.0);
      bN = pow(bN, 0.65);
      col = inferno(bN);
    }

    // Thin equator divider line, just like the source.
    float eqLine = smoothstep(0.18, 0.0, abs(p.y));
    col = mix(col, vec3(0.0), eqLine * 0.5);

    // Photon ring darkening (thin ring at r ~ 2.6).
    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.55 * ring;
  } else {
    // ---------------- Right half: Density (smooth continuous gradient) -------
    float rho = density(p, uTime);
    float rhoN = clamp(rho * 1.4, 0.0, 1.0);
    rhoN = pow(rhoN, 0.7);

    // Smooth ramp from off-white background -> cream -> salmon -> red-orange.
    // No sharp threshold so the plasma reads as a continuous filled blob,
    // matching the reference video's density panel.
    vec3 cBg     = vec3(0.97, 0.97, 0.96);  // very pale gray-white background
    vec3 cCream  = vec3(0.97, 0.90, 0.85);  // cream / pale pink
    vec3 cSalmon = vec3(0.97, 0.65, 0.50);  // salmon pink
    vec3 cRed    = vec3(0.93, 0.30, 0.22);  // bright red-orange
    vec3 cCore   = vec3(0.78, 0.18, 0.18);  // darker red core for highest rho

    if (rhoN < 0.25) {
      col = mix(cBg, cCream, rhoN / 0.25);
    } else if (rhoN < 0.55) {
      col = mix(cCream, cSalmon, (rhoN - 0.25) / 0.30);
    } else if (rhoN < 0.85) {
      col = mix(cSalmon, cRed, (rhoN - 0.55) / 0.30);
    } else {
      col = mix(cRed, cCore, (rhoN - 0.85) / 0.15);
    }

    // Photon ring darkening.
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
