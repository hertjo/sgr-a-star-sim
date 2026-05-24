"use client";

import { Database, Sparkles } from "lucide-react";

type Props = {
  useData: boolean;
  onToggle: () => void;
};

export default function ModeToggle({ useData, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-12 top-3 z-10 flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] tracking-wide text-white/90 backdrop-blur-sm transition hover:bg-white/20"
      title={
        useData
          ? "Showing real Yoon+ 2020 GRMHD radiation data. Click for procedural."
          : "Showing procedural radiation. Click for real GRMHD data."
      }
    >
      {useData ? <Database size={13} /> : <Sparkles size={13} />}
      <span>{useData ? "Real GRMHD" : "Procedural"}</span>
    </button>
  );
}
