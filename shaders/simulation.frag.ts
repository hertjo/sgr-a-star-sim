const source = `
// Sgr A* split-view fragment shader (main body).
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

  // Sample fields once.
  float B   = bFieldMag(p, uTime);
  float rho = density(p, uTime);
  float P   = radiationPower(p, uTime);

  if (p.x < 0.0) {
    // ---------------- Left: radiation power (inferno) with subtle |B| tint ----
    // Radiation dominates — bright, hot, varied colors like the source video.
    float pN = clamp(P / 1.2, 0.0, 1.0);
    pN = pow(pN, 0.5);
    vec3 rad = inferno(pN);

    // Quiet |B| underlay — desaturated and dark, just enough to hint at
    // field topology in low-emission regions (avoids stippled rainbow look).
    float bN = clamp(B / 1.8, 0.0, 1.0);
    vec3 baseB = magRainbow(bN);
    // Desaturate toward dark plum.
    float luma = dot(baseB, vec3(0.299, 0.587, 0.114));
    baseB = mix(vec3(luma) * 0.30, baseB, 0.25);

    col = mix(baseB, rad, smoothstep(0.02, 0.35, pN));

    // Photon ring darkening (thin ring at r ~ 2.6).
    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.6 * ring;
  } else {
    // ---------------- Right: density (mostly grayscale with red core) ---------
    // Background is near-white; density adds red/orange in concentrated regions.
    float rhoN = clamp(rho * 1.4, 0.0, 1.0);
    rhoN = pow(rhoN, 0.85);

    // Grayscale base that goes from off-white at low density to mid-gray.
    vec3 base = vec3(mix(0.94, 0.35, smoothstep(0.0, 0.55, rhoN)));

    // Red/orange overlay for the densest plasma (the bright core in the source).
    vec3 hot = hotDensity(rhoN);
    col = mix(base, hot, smoothstep(0.25, 0.85, rhoN));

    // Photon ring darkening.
    float ring = exp(-pow((r - R_PHOTON) / 0.32, 2.0));
    col *= 1.0 - 0.6 * ring;
  }

  // ---------------- Subtle vertical divider at x = 0 ----------------
  float divider = smoothstep(0.14, 0.0, abs(p.x));
  col = mix(col, vec3(0.0), divider * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;
export default source;
