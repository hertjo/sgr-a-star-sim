// In-plot text labels matching the reference video:
//   top-left quadrant   : Radiation Power
//   top-right quadrant  : Density
//   bottom-left quadrant: Magnetic Field Strength

export default function PanelLabels() {
  return (
    <>
      <div className="pointer-events-none absolute left-[12%] top-3 z-10 select-none text-[13px] tracking-wide text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        Radiation Power
      </div>
      <div className="pointer-events-none absolute right-[12%] top-3 z-10 select-none text-[13px] tracking-wide text-zinc-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)]">
        Density
      </div>
      <div className="pointer-events-none absolute bottom-7 left-[12%] z-10 select-none text-[13px] tracking-wide text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        Magnetic Field Strength
      </div>
    </>
  );
}
