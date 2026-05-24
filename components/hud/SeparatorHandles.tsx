"use client";

import { useEffect, useRef } from "react";

type Props = {
  xSplit: number;        // plot coords, -60..60
  ySplit: number;        // plot coords, -30..30
  onChange: (next: { x?: number; y?: number }) => void;
};

const PLOT_W = 120;     // plot extent in x
const PLOT_H = 60;      // plot extent in y
const X_MIN = -60;
const Y_MAX = 30;
const MARGIN = 6;       // plot-units the bars can't approach the edge

export default function SeparatorHandles({ xSplit, ySplit, onChange }: Props) {
  const dragRef = useRef<"x" | "y" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Position as a % of the plot box.
  const xPct = ((xSplit - X_MIN) / PLOT_W) * 100;
  const yPct = ((Y_MAX - ySplit) / PLOT_H) * 100;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const mode = dragRef.current;
      if (!mode || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (mode === "x") {
        const xN = (e.clientX - rect.left) / rect.width;
        const xPlot = xN * PLOT_W + X_MIN;
        onChange({
          x: Math.max(X_MIN + MARGIN, Math.min(-X_MIN - MARGIN, xPlot)),
        });
      } else {
        const yN = (e.clientY - rect.top) / rect.height;
        const yPlot = Y_MAX - yN * PLOT_H;
        onChange({
          y: Math.max(-Y_MAX + MARGIN, Math.min(Y_MAX - MARGIN, yPlot)),
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onChange]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-15">
      {/* Vertical separator drag zone (16px wide grab strip centered on the line) */}
      <div
        role="slider"
        aria-label="Density / radiation separator"
        aria-valuenow={Math.round(xSplit)}
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = "x";
          document.body.style.cursor = "ew-resize";
        }}
        className="group pointer-events-auto absolute top-0 bottom-0 -translate-x-1/2 w-4 cursor-ew-resize"
        style={{ left: `${xPct}%` }}
      >
        {/* Subtle visible line that brightens on hover/drag */}
        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/40 transition-colors group-hover:bg-white/90 group-active:bg-white" />
        {/* Diamond grip in the middle so it's discoverable */}
        <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/40 ring-1 ring-black/30 transition-colors group-hover:bg-white" />
      </div>

      {/* Horizontal separator — only spans the LEFT panel (0 to xPct%) */}
      <div
        role="slider"
        aria-label="Radiation / magnetic-field separator"
        aria-valuenow={Math.round(ySplit)}
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = "y";
          document.body.style.cursor = "ns-resize";
        }}
        className="group pointer-events-auto absolute left-0 -translate-y-1/2 h-4 cursor-ns-resize"
        style={{ top: `${yPct}%`, width: `${xPct}%` }}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/40 transition-colors group-hover:bg-white/90 group-active:bg-white" />
        <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/40 ring-1 ring-black/30 transition-colors group-hover:bg-white" />
      </div>
    </div>
  );
}
