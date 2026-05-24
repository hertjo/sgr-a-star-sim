// Seed grid for the magnetic field streamlines.
// Shared between the streamline worker (which traces them) and any
// debug/preview consumer on the main thread.

import { R_HORIZON } from "./fieldMath";

export const SEEDS: Array<[number, number]> = (() => {
  const seeds: Array<[number, number]> = [];

  // Dense equatorial seeding — wound-up flux loops thread the disk.
  for (let xi = -55; xi <= 55; xi += 3.5) {
    seeds.push([xi, 0.4]);
    seeds.push([xi, -0.4]);
    seeds.push([xi, 2.5]);
    seeds.push([xi, -2.5]);
  }
  // Mid-latitude seeds — show the field arcing up out of the disk.
  for (let xi = -32; xi <= 32; xi += 5) {
    seeds.push([xi, 6]);
    seeds.push([xi, -6]);
    seeds.push([xi, 12]);
    seeds.push([xi, -12]);
    seeds.push([xi, 18]);
    seeds.push([xi, -18]);
  }
  // Polar / jet seeds — open field lines leaving the funnel.
  for (let yi = -28; yi <= 28; yi += 3) {
    seeds.push([0.5, yi]);
    seeds.push([-0.5, yi]);
    seeds.push([1.5, yi]);
    seeds.push([-1.5, yi]);
  }
  // Golden-angle scatter for variety in the outer flow.
  for (let i = 0; i < 90; i++) {
    const ang = (i * 137.508 * Math.PI) / 180;
    const rad = 5 + 35 * Math.sqrt((i + 1) / 90);
    seeds.push([Math.cos(ang) * rad, Math.sin(ang) * rad * 0.5]);
  }

  return seeds.filter(([x, y]) => Math.hypot(x, y) > R_HORIZON + 0.5);
})();
