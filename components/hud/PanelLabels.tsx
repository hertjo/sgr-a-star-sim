export default function PanelLabels() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex select-none justify-around text-[13px] tracking-wide">
      <div className="rounded px-2 py-0.5 text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        Radiation Power
      </div>
      <div className="rounded px-2 py-0.5 text-zinc-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.6)]">
        Density
      </div>
    </div>
  );
}
