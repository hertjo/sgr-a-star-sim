"use client";

import { cssGradient, hotDensity, inferno, plasma } from "@/lib/colormaps";

type Bar = {
  cmap: (t: number) => [number, number, number];
  ticks: { value: string; t: number }[];
};

// Three small vertical colorbars stacked on the left edge — mirror the
// source video's radiation / density / temperature scales. The numeric
// values are decorative (the simulation is procedural), but they match
// the magnitudes shown in the screenshot.
const BARS: Bar[] = [
  {
    cmap: inferno,
    ticks: [
      { value: "1.0e-19", t: 1.0 },
      { value: "5.6e-19", t: 0.78 },
      { value: "3.2e-19", t: 0.55 },
      { value: "1.8e-19", t: 0.30 },
      { value: "1.0e-19", t: 0.05 },
    ],
  },
  {
    cmap: plasma,
    ticks: [
      { value: "0.0001", t: 1.0 },
      { value: "3.2e-06", t: 0.66 },
      { value: "1.0e-07", t: 0.33 },
      { value: "3.2e-09", t: 0.0 },
    ],
  },
  {
    cmap: hotDensity,
    ticks: [
      { value: "50", t: 1.0 },
      { value: "7.1", t: 0.66 },
      { value: "1.0", t: 0.33 },
      { value: "0.14", t: 0.0 },
    ],
  },
];

function Bar({ bar }: { bar: Bar }) {
  return (
    <div className="flex items-stretch gap-1">
      <div
        className="h-[78px] w-3 rounded-sm shadow-inner shadow-black/40 ring-1 ring-white/10"
        style={{ background: cssGradient(bar.cmap, 24, "to top") }}
      />
      <div className="relative h-[78px] w-12">
        {bar.ticks.map((tk, i) => (
          <div
            key={i}
            className="absolute left-0 flex -translate-y-1/2 items-center gap-1"
            style={{ top: `${(1 - tk.t) * 100}%` }}
          >
            <div className="h-px w-1 bg-white/40" />
            <div className="font-mono text-[8.5px] text-white/85">
              {tk.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeftColorbars() {
  return (
    <div className="pointer-events-none absolute left-2 top-1/2 z-10 flex -translate-y-1/2 select-none flex-col gap-2">
      {BARS.map((b, i) => (
        <Bar key={i} bar={b} />
      ))}
    </div>
  );
}
