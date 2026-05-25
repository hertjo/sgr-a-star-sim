"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  timeRef: React.MutableRefObject<number>;
  duration: number;
};

const WIDTH = 1000;       // SVG viewBox units; scales freely
const HEIGHT = 70;

export default function LightCurve({ timeRef, duration }: Props) {
  const [series, setSeries] = useState<number[] | null>(null);
  const playheadRef = useRef<SVGLineElement>(null);
  const playheadValRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    fetch("/grmhd/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        const arr: number[] = m?.radiation?.tot_fnu ?? [];
        if (arr.length > 0) setSeries(arr);
      })
      .catch(() => null);
  }, []);

  const { path, vmin, vmax } = useMemo(() => {
    if (!series) return { path: "", vmin: 0, vmax: 1 };
    const vmin = Math.min(...series);
    const vmax = Math.max(...series);
    const pad = (vmax - vmin) * 0.12 || 0.1;
    const lo = vmin - pad;
    const hi = vmax + pad;
    const n = series.length;
    const pts = series.map((v, i) => {
      const x = (i / (n - 1)) * WIDTH;
      const y = HEIGHT - ((v - lo) / (hi - lo)) * HEIGHT;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return {
      path: `M ${pts.join(" L ")}`,
      vmin: lo,
      vmax: hi,
    };
  }, [series]);

  // Animation loop — moves the playhead and reads the current totFnu value
  // off the series with linear interpolation between frames.
  useEffect(() => {
    if (!series) return;
    let raf = 0;
    const tick = () => {
      const t = timeRef.current % duration;
      const f = (t / duration) * (series.length - 1);
      const fa = Math.floor(f);
      const fb = Math.min(fa + 1, series.length - 1);
      const frac = f - fa;
      const v = series[fa] * (1 - frac) + series[fb] * frac;

      const xPx = (f / (series.length - 1)) * WIDTH;
      const yPx = HEIGHT - ((v - vmin) / (vmax - vmin)) * HEIGHT;
      if (playheadRef.current) {
        playheadRef.current.setAttribute("x1", String(xPx));
        playheadRef.current.setAttribute("x2", String(xPx));
      }
      if (playheadValRef.current) {
        playheadValRef.current.setAttribute("cx", String(xPx));
        playheadValRef.current.setAttribute("cy", String(yPx));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [series, vmin, vmax, duration, timeRef]);

  if (!series) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-9 z-10 select-none">
      <div className="mx-[6%] flex items-end gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          Total flux
        </div>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-12 flex-1"
        >
          {/* faint horizontal mid line */}
          <line
            x1={0}
            x2={WIDTH}
            y1={HEIGHT / 2}
            y2={HEIGHT / 2}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {/* curve */}
          <path
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.78)"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
          {/* playhead vertical line */}
          <line
            ref={playheadRef}
            x1={0}
            y1={0}
            x2={0}
            y2={HEIGHT}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {/* dot at current value */}
          <circle
            ref={playheadValRef}
            cx={0}
            cy={HEIGHT / 2}
            r={2.4}
            fill="white"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </div>
  );
}
