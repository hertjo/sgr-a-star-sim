"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { R_HORIZON, traceStreamline } from "@/lib/fieldMath";

type Props = {
  time: number;
};

// Static seed grid sampled across the plot domain. The streamlines slowly
// breathe in time because the underlying stream function depends on `time`,
// but we recompute only every few frames to keep this cheap.
const SEEDS: Array<[number, number]> = (() => {
  const seeds: Array<[number, number]> = [];
  // Dense equatorial seeding — wound up flux loops thread the disk.
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

export default function MagneticFieldLines({ time }: Props) {
  // Re-trace at a discrete cadence (every 0.5 sim seconds) for performance.
  // This still gives smooth visual motion because the streamlines themselves
  // change shape slowly between samples.
  const sampleTime = Math.round(time * 2) / 2;

  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const [sx, sy] of SEEDS) {
      const line = traceStreamline(sx, sy, sampleTime, {
        stepSize: 0.45,
        maxSteps: 180,
        maxRadius: 56,
      });
      if (line.length < 2) continue;
      // Emit as LineSegments (pairs of vertices).
      for (let i = 0; i < line.length - 1; i++) {
        const [x1, y1] = line[i];
        const [x2, y2] = line[i + 1];
        positions.push(x1, y1, 0.05, x2, y2, 0.05);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geom;
    // sampleTime intentionally drives re-trace cadence.
  }, [sampleTime]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        linewidth: 1,
        depthWrite: false,
      }),
    [],
  );

  return <lineSegments geometry={geometry} material={material} />;
}
