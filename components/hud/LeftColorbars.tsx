"use client";

import { ReactNode } from "react";
import { cssGradient, inferno, viridis } from "@/lib/colormaps";

type RGB = [number, number, number];

// Black -> deep red -> red -> orange -> yellow ramp matching the density
// shader pass in shaders/simulation.frag.ts.
function nasaOrange(t: number): RGB {
  const clamp = Math.max(0, Math.min(1, t));
  const lerp = (a: RGB, b: RGB, k: number): RGB => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  const black: RGB = [0.0, 0.0, 0.0];
  const deepRed: RGB = [0.3, 0.03, 0.02];
  const red: RGB = [0.8, 0.15, 0.05];
  const orange: RGB = [1.0, 0.5, 0.1];
  const yellow: RGB = [1.0, 0.85, 0.45];
  if (clamp < 0.2) return lerp(black, deepRed, clamp / 0.2);
  if (clamp < 0.5) return lerp(deepRed, red, (clamp - 0.2) / 0.3);
  if (clamp < 0.8) return lerp(red, orange, (clamp - 0.5) / 0.3);
  return lerp(orange, yellow, (clamp - 0.8) / 0.2);
}

type Bar = {
  cmap: (t: number) => RGB;
  ticks: { value: string; t: number }[];
  labelSide: "left" | "right";
};

const RADIATION_BAR: Bar = {
  cmap: viridis,
  ticks: [
    { value: "1.0e-04", t: 1.0 },
    { value: "3.2e-06", t: 0.66 },
    { value: "1.0e-07", t: 0.33 },
    { value: "3.2e-09", t: 0.0 },
  ],
  labelSide: "right",
};

const BFIELD_BAR: Bar = {
  cmap: inferno,
  ticks: [
    { value: "50",   t: 1.0 },
    { value: "7.1",  t: 0.66 },
    { value: "1.0",  t: 0.33 },
    { value: "0.14", t: 0.0 },
  ],
  labelSide: "right",
};

const DENSITY_BAR: Bar = {
  cmap: nasaOrange,
  ticks: [
    { value: "1.0e-16", t: 1.0 },
    { value: "5.6e-18", t: 0.66 },
    { value: "3.2e-19", t: 0.33 },
    { value: "1.0e-21", t: 0.0 },
  ],
  labelSide: "left",
};

function VBar({ bar }: { bar: Bar }) {
  const ticks: ReactNode[] = bar.ticks.map((tk, i) => (
    <div
      key={i}
      className="absolute flex -translate-y-1/2 items-center gap-1"
      style={{
        top: `${(1 - tk.t) * 100}%`,
        ...(bar.labelSide === "right" ? { left: 0 } : { right: 0 }),
      }}
    >
      {bar.labelSide === "right" ? (
        <>
          <div className="h-px w-1.5 bg-white/55" />
          <div className="font-mono text-[10px] text-white/90">{tk.value}</div>
        </>
      ) : (
        <>
          <div className="font-mono text-[10px] text-white/90">{tk.value}</div>
          <div className="h-px w-1.5 bg-white/55" />
        </>
      )}
    </div>
  ));

  return (
    <div
      className={`flex items-stretch ${
        bar.labelSide === "right" ? "flex-row" : "flex-row-reverse"
      } gap-2`}
    >
      <div
        className="h-[110px] w-3.5 rounded-sm shadow-inner shadow-black/40 ring-1 ring-white/15"
        style={{ background: cssGradient(bar.cmap, 32, "to top") }}
      />
      <div className="relative h-[110px] w-14">{ticks}</div>
    </div>
  );
}

// Each colorbar sits in the middle of the field whose colormap it
// describes — radiation power & |B| on the left, density on the right.
export default function LeftColorbars() {
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-1/4 z-10 -translate-y-1/2 select-none">
        <VBar bar={RADIATION_BAR} />
      </div>
      <div className="pointer-events-none absolute left-3 top-3/4 z-10 -translate-y-1/2 select-none">
        <VBar bar={BFIELD_BAR} />
      </div>
      <div className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 select-none">
        <VBar bar={DENSITY_BAR} />
      </div>
    </>
  );
}
