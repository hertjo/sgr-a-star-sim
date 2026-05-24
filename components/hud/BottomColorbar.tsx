"use client";

import { cssGradient, magRainbow } from "@/lib/colormaps";

export default function BottomColorbar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 select-none px-[6%]">
      <div className="flex items-center gap-3">
        <div className="text-[11px] tracking-wide text-white/90">
          Magnetic Field Strength
        </div>
        <div className="relative h-[6px] flex-1 overflow-hidden rounded-full ring-1 ring-white/15">
          <div
            className="absolute inset-0"
            style={{ background: cssGradient(magRainbow, 32, "to right") }}
          />
          {/* End marker dot, mimicking the red ball in the YouTube player. */}
          <div className="absolute right-[-2px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-red-500 shadow shadow-red-900/60" />
        </div>
      </div>
    </div>
  );
}
