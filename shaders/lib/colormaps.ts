const source = `
// Polynomial colormap fits (Matt Zucker / shadertoy convention).

// Inferno: black -> purple -> magenta -> orange -> yellow -> white.
vec3 inferno(float t) {
  t = clamp(t, 0.0, 1.0);
  const vec3 c0 = vec3( 0.000020,  0.001647, -0.019480);
  const vec3 c1 = vec3( 0.106692,  0.563648,  3.932646);
  const vec3 c2 = vec3(11.602401, -3.972823, -15.943876);
  const vec3 c3 = vec3(-41.703993, 17.436910,  44.354091);
  const vec3 c4 = vec3( 77.162935, -33.402567, -81.808793);
  const vec3 c5 = vec3(-71.319428,  32.626594,  73.209519);
  const vec3 c6 = vec3( 25.131114, -12.242661, -23.070794);
  return clamp(c0 + t*(c1 + t*(c2 + t*(c3 + t*(c4 + t*(c5 + t*c6))))), 0.0, 1.0);
}

// "Hot" density colormap: black -> dark red -> red -> orange -> white.
// The right-panel density visualization in the source video has a
// roughly black/gray -> red/orange -> white ramp.
vec3 hotDensity(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c;
  if (t < 0.25) {
    // Black -> dark red
    float k = t / 0.25;
    c = mix(vec3(0.02, 0.02, 0.02), vec3(0.30, 0.05, 0.05), k);
  } else if (t < 0.55) {
    // Dark red -> bright red
    float k = (t - 0.25) / 0.30;
    c = mix(vec3(0.30, 0.05, 0.05), vec3(0.95, 0.20, 0.10), k);
  } else if (t < 0.80) {
    // Red -> orange
    float k = (t - 0.55) / 0.25;
    c = mix(vec3(0.95, 0.20, 0.10), vec3(1.00, 0.65, 0.25), k);
  } else {
    // Orange -> white
    float k = (t - 0.80) / 0.20;
    c = mix(vec3(1.00, 0.65, 0.25), vec3(1.00, 0.98, 0.92), k);
  }
  return c;
}

// Magnetic field strength rainbow: cyan -> green -> yellow -> orange -> red -> pink.
vec3 magRainbow(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c1 = vec3(0.30, 0.78, 1.00);  // cyan
  vec3 c2 = vec3(0.20, 0.88, 0.40);  // green
  vec3 c3 = vec3(0.92, 0.90, 0.20);  // yellow
  vec3 c4 = vec3(1.00, 0.52, 0.10);  // orange
  vec3 c5 = vec3(0.95, 0.15, 0.18);  // red
  vec3 c6 = vec3(1.00, 0.45, 0.78);  // pink
  float seg = t * 5.0;
  if (seg < 1.0) return mix(c1, c2, seg);
  if (seg < 2.0) return mix(c2, c3, seg - 1.0);
  if (seg < 3.0) return mix(c3, c4, seg - 2.0);
  if (seg < 4.0) return mix(c4, c5, seg - 3.0);
  return mix(c5, c6, seg - 4.0);
}

// Plasma/temperature colormap (third left-edge bar): purple -> red -> orange -> yellow.
vec3 plasma(float t) {
  t = clamp(t, 0.0, 1.0);
  const vec3 c0 = vec3( 0.05873234392399702, 0.02333670892565664, 0.5433401826748754);
  const vec3 c1 = vec3( 2.176514634195958,  0.2383834171260182,  0.7539604599784036);
  const vec3 c2 = vec3(-2.689460476458034, -7.455851135738909,  3.110799939717086);
  const vec3 c3 = vec3( 6.130348345893603, 42.3461881477227,  -28.51885465332158);
  const vec3 c4 = vec3(-11.10743619062271, -82.66631109428045,  60.13984767418263);
  const vec3 c5 = vec3( 10.02306557647065,  71.41361770095349, -54.07218655560067);
  const vec3 c6 = vec3(-3.658713842777788, -22.93153465461149,  18.19190778539828);
  return clamp(c0 + t*(c1 + t*(c2 + t*(c3 + t*(c4 + t*(c5 + t*c6))))), 0.0, 1.0);
}
`;
export default source;
