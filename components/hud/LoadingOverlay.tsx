type Props = {
  progress: number; // 0..1
  label?: string;
};

export default function LoadingOverlay({
  progress,
  label = "Tracing magnetic field lines…",
}: Props) {
  const pct = Math.round(progress * 100);
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/55 backdrop-blur-sm">
      <div className="flex w-72 flex-col items-center gap-3 text-white/90">
        <div className="text-[12px] tracking-[0.15em] uppercase text-white/70">
          {label}
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full bg-white/85 transition-[width] duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[11px] tabular-nums text-white/60">
          {pct}%
        </div>
      </div>
    </div>
  );
}
