const TICKS = [-60, -40, -20, 0, 20, 40, 60];
const X_MIN = -60;
const X_MAX = 60;

export default function AxisLabels() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[42px] z-10 select-none">
      <div className="relative mx-[6%] h-4">
        {TICKS.map((t) => {
          const pct = ((t - X_MIN) / (X_MAX - X_MIN)) * 100;
          return (
            <div
              key={t}
              className="absolute flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <div className="h-2 w-px bg-white/70" />
              <div className="font-mono text-[10px] text-white/85">{t}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
