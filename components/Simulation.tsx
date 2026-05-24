"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";

import SimulationPlane from "@/components/SimulationPlane";
import MagneticFieldLines from "@/components/MagneticFieldLines";
import CameraController from "@/components/CameraController";
import TitleOverlay from "@/components/hud/TitleOverlay";
import PanelLabels from "@/components/hud/PanelLabels";
import AxisLabels from "@/components/hud/AxisLabels";
import LeftColorbars from "@/components/hud/LeftColorbars";
import BottomColorbar from "@/components/hud/BottomColorbar";
import PlayerControls from "@/components/hud/PlayerControls";

const DURATION = 37; // seconds, matches "0:37" in the source video.

type CameraHandle = { reset: () => void };

export default function Simulation() {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const lastTickRef = useRef<number | null>(null);
  const cameraRef = useRef<CameraHandle | null>(null);

  // Drive simulation time forward when playing.
  useEffect(() => {
    if (!playing) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const tick = (ts: number) => {
      if (lastTickRef.current == null) lastTickRef.current = ts;
      const dt = (ts - lastTickRef.current) / 1000;
      lastTickRef.current = ts;
      setTime((t) => {
        const next = t + dt;
        return next >= DURATION ? next - DURATION : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const onTogglePlay = useCallback(() => setPlaying((p) => !p), []);
  const onSeek = useCallback((t: number) => setTime(t), []);
  const onResetCamera = useCallback(() => {
    cameraRef.current?.reset();
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      {/* Plot box — 2:1 aspect, sized to fit viewport with HUD breathing room */}
      <div className="absolute left-1/2 top-1/2 aspect-[2/1] w-[min(96vw,calc(96vh*2))] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black ring-1 ring-white/5">
        <Canvas
          camera={{ position: [0, 0, 78], fov: 42, near: 0.1, far: 600 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={["#000000"]} />
          <SimulationPlane time={time} />
          <MagneticFieldLines time={time} />
          <CameraController controlsRef={cameraRef} />
        </Canvas>

        <TitleOverlay />
        <PanelLabels />
        <LeftColorbars />
        <AxisLabels />
        <BottomColorbar />
        <PlayerControls
          playing={playing}
          onTogglePlay={onTogglePlay}
          time={time}
          duration={DURATION}
          onSeek={onSeek}
          onResetCamera={onResetCamera}
        />
      </div>
    </div>
  );
}
