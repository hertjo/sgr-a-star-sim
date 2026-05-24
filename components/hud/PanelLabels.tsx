// Bigger, higher-contrast panel labels.
//   Radiation Power      — top-left of the upper-left field
//   Magnetic Field Str.  — bottom-left of the lower-left field (above the
//                          player bar so they don't collide)
//   Density              — top-left of the right field (clear of the
//                          top-right button cluster)

const TEXT =
  "select-none text-[15px] font-semibold tracking-wide text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]";

export default function PanelLabels() {
  return (
    <>
      <div
        className={`pointer-events-none absolute left-[8%] top-3 z-10 ${TEXT}`}
      >
        Radiation Power
      </div>
      <div
        className={`pointer-events-none absolute right-[8%] top-12 z-10 ${TEXT}`}
      >
        Density
      </div>
      <div
        className={`pointer-events-none absolute bottom-16 left-[8%] z-10 ${TEXT}`}
      >
        Magnetic Field Strength
      </div>
    </>
  );
}
