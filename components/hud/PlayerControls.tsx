"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

type Props = {
  playing: boolean;
  onTogglePlay: () => void;
  time: number;
  duration: number;
  onSeek: (t: number) => void;
  onResetCamera: () => void;
};

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

export default function PlayerControls({
  playing,
  onTogglePlay,
  time,
  duration,
  onSeek,
  onResetCamera,
}: Props) {
  const pct = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <>
      {/* Top-right: just a camera-reset button (orbit reset). */}
      <button
        type="button"
        onClick={onResetCamera}
        className="absolute right-3 top-3 z-10 rounded p-1 text-white/85 transition hover:bg-white/10"
        title="Reset camera"
      >
        <RotateCcw size={18} />
      </button>

      {/* Bottom controls — minimal: play/pause + scrubber + time. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20">
        <div className="pointer-events-auto group relative h-[3px] w-full cursor-pointer bg-white/10">
          <div
            className="absolute inset-y-0 left-0 bg-white/80"
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 transition-opacity group-hover:opacity-100"
            style={{ left: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={time}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="pointer-events-auto flex items-center gap-3 bg-black/45 px-3 py-1.5 text-white/90 backdrop-blur-sm">
          <button
            type="button"
            onClick={onTogglePlay}
            className="rounded p-1 transition hover:bg-white/10"
            title={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div className="font-mono text-[11px] tabular-nums text-white/80">
            {fmt(time)}{" "}
            <span className="text-white/40">/ {fmt(duration)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
