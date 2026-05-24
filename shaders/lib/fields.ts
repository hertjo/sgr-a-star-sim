const source = `
// Procedural fields for a Sgr A* GRMHD-style visualization.
// Domain: plot-space x in [-60, 60], y in [-30, 30] (units of r_g).
// Black hole at origin with event horizon ~r_h.

const float R_HORIZON = 2.0;
const float R_PHOTON  = 2.6;

// -----------------------------------------------------------------------------
// Magnetic stream function ψ(p, t).
// B = (∂ψ/∂y, -∂ψ/∂x). Field lines are level sets of ψ.
// We layer:
//   ψ1: horizontal toroidal-like sheet (lines wrap through the equator)
//   ψ2: jet funnel opening near the polar (y) axis
//   ψ3: turbulent perturbation (domain-warped fbm)
// -----------------------------------------------------------------------------
float streamFunction(vec2 p, float t) {
  float r  = length(p);
  float rs = max(r, 0.001);

  // ψ1: wound-up loops threading the equator.
  // ψ1 = y / r * factor(r) gives B with strong horizontal component near eq.
  float radial = (r * r) / ((r + 1.5) * (r + 1.5));   // suppression near horizon
  float decay  = exp(-r / 32.0);
  float psi1   = (p.y / rs) * radial * decay * 8.0;

  // ψ2: jet opening — near the polar axis (small |x|) we want B aligned with y.
  // A stream function ψ ~ -x * g(r) gives B ~ (0, g(r)) for ∂g/∂x small,
  // confined to small |x| via a Gaussian and biased away from BH.
  float jetMask = exp(-pow(p.x / 5.0, 2.0)) * smoothstep(2.5, 10.0, abs(p.y));
  float psi2    = -p.x * jetMask * 5.0;

  // ψ3: turbulent perturbations — domain-warped fbm, time-evolving.
  vec2 warp = vec2(
    fbm(p * 0.07 + vec2(t * 0.030, 0.0)),
    fbm(p * 0.07 + vec2(7.13, -t * 0.030))
  ) * 2.8;
  float psi3 = 1.4 * fbm(p * 0.13 + warp + vec2(0.0, t * 0.040));

  return psi1 + psi2 + psi3;
}

// Analytic B field via central differencing of the stream function.
// B = (∂ψ/∂y, -∂ψ/∂x).
vec2 bField(vec2 p, float t) {
  float eps = 0.18;
  float dpsi_dx = (streamFunction(p + vec2(eps, 0.0), t)
                 - streamFunction(p - vec2(eps, 0.0), t)) / (2.0 * eps);
  float dpsi_dy = (streamFunction(p + vec2(0.0, eps), t)
                 - streamFunction(p - vec2(0.0, eps), t)) / (2.0 * eps);
  return vec2(dpsi_dy, -dpsi_dx);
}

float bFieldMag(vec2 p, float t) {
  return length(bField(p, t));
}

// -----------------------------------------------------------------------------
// Density ρ(p, t).
// Accretion torus near equator + outflow lobe on the right + funnel evacuation
// near poles + turbulent advection.
// -----------------------------------------------------------------------------
float density(vec2 p, float t) {
  float r  = length(p);
  float rs = max(r, 0.001);
  if (r < R_HORIZON) return 0.0;

  // Latitude factor: 1 at equator (small |y|/r), -> 0 at poles.
  float sinth = abs(p.x) / rs;       // = sin(angle-from-y-axis)
  float diskShape = pow(sinth, 2.0); // soft concentration near equator

  // Smooth gaussian plasma core — gives the right panel a continuous
  // filled blob rather than wispy lines.
  float core = exp(-pow((r - 4.0) / 11.0, 2.0)) * 1.4;

  // Broad outflow lobe biased to the +x side.
  float outflow = exp(-pow((p.x - 12.0) / 18.0, 2.0))
                * exp(-pow(p.y / 22.0, 2.0))
                * 0.9;

  float base = (core + outflow) * (0.4 + 0.6 * diskShape);

  // Gentle turbulent modulation — tight amplitude so the blob stays
  // smooth, not stippled. Low-frequency only.
  vec2 warp = vec2(
    fbm(p * 0.06 + vec2(t * 0.04, 0.0)),
    fbm(p * 0.06 + vec2(11.0, -t * 0.04))
  ) * 2.5;
  float turb = 0.88 + 0.18 * warpedFbm(p * 0.10 + warp, t);

  // Funnel evacuation along the y-axis (jet cone).
  float funnel = exp(-pow(p.x / 2.5, 2.0)) * smoothstep(2.0, 8.0, abs(p.y));
  float funnelEvac = 1.0 - 0.85 * funnel;

  float rho = base * turb * funnelEvac;

  // Far-field falloff.
  rho *= exp(-r / 70.0);

  return max(rho, 0.0);
}

// -----------------------------------------------------------------------------
// Radiation power P(p, t).
// Proxy for synchrotron emissivity: scales with ρ² · |B|² · turbulent boost
// in reconnection-like sheets.
// -----------------------------------------------------------------------------
float radiationPower(vec2 p, float t) {
  float r = length(p);
  if (r < R_HORIZON) return 0.0;

  float rho = density(p, t);
  float B   = bFieldMag(p, t);

  // Reconnection hotspot enhancement — fbm-driven flickering sheets.
  vec2 warp = vec2(
    fbm(p * 0.22 + vec2(t * 0.09, 3.1)),
    fbm(p * 0.22 + vec2(-2.4, -t * 0.09))
  ) * 2.4;
  // Two scales of hot spots — broad arcs + fine reconnection sheets.
  float hotBig   = pow(max(0.0, warpedFbm(p * 0.16 + warp * 0.6, t * 1.0) + 0.45), 3.5);
  float hotFine  = pow(max(0.0, warpedFbm(p * 0.50 + warp, t * 1.4) + 0.30), 4.0);
  float hot = hotBig + 1.4 * hotFine;

  float P = rho * (B * B + 0.05) * (0.25 + 5.5 * hot);

  // Boost near horizon (the hottest, most luminous region).
  P *= 1.0 + 2.0 * exp(-pow((r - 4.0) / 3.0, 2.0));

  return P;
}
`;
export default source;
