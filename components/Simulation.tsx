"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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
import LoadingOverlay from "@/components/hud/LoadingOverlay";
import ModeToggle from "@/components/hud/ModeToggle";
import SeparatorHandles from "@/components/hud/SeparatorHandles";
import LightCurve from "@/components/hud/LightCurve";
import EHTInset from "@/components/hud/EHTInset";

// Wall-clock loop length. The data atlas covers ~5000 r_g/c of simulation
// time (~28h of real Sgr A* accretion), played back as a 3-minute loop.
const DURATION = 180;
const DATA_DURATION = 180;
const DISPLAY_UPDATE_MS = 250;

type CameraHandle = { reset: () => void };

export default function Simulation() {
  const timeRef = useRef(0);
  const [displayTime, setDisplayTime] = useState(0);

  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [useData, setUseData] = useState(true);

  // Refs (not state) so that dragging the separators every mousemove
  // doesn't reconcile the React tree. A forced tick re-renders just
  // the visible handle positions; the shader reads the refs each frame.
  const xSplitRef = useRef(0);
  const ySplitRef = useRef(0);
  const [, forceTick] = useState(0);

  const cameraRef = useRef<CameraHandle | null>(null);

  useEffect(() => {
    if (!playing || !ready) return;
    let raf = 0;
    let lastTick = performance.now();
    let lastDisplay = lastTick;
    const tick = (now: number) => {
      const dt = (now - lastTick) / 1000;
      lastTick = now;
      let next = timeRef.current + dt;
      if (next >= DURATION) next -= DURATION;
      timeRef.current = next;
      if (now - lastDisplay >= DISPLAY_UPDATE_MS) {
        setDisplayTime(next);
        lastDisplay = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, ready]);

  const onTogglePlay = useCallback(() => setPlaying((p) => !p), []);
  const onSeek = useCallback((t: number) => {
    timeRef.current = t;
    setDisplayTime(t);
  }, []);
  const onResetCamera = useCallback(() => cameraRef.current?.reset(), []);
  const onStreamlineProgress = useCallback((p: number) => setProgress(p), []);
  const onStreamlineReady = useCallback(() => setReady(true), []);
  const onToggleMode = useCallback(() => setUseData((v) => !v), []);

  const onSplitChange = useCallback(
    ({ x, y }: { x?: number; y?: number }) => {
      if (x !== undefined) xSplitRef.current = x;
      if (y !== undefined) ySplitRef.current = y;
      forceTick((c) => c + 1);
    },
    [],
  );
  const onCenter = useCallback(() => {
    xSplitRef.current = 0;
    ySplitRef.current = 0;
    forceTick((c) => c + 1);
  }, []);

  // Test hook for the demo recording script. No effect in normal use.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      __setSplits?: (x: number, y: number) => void;
    };
    w.__setSplits = (x: number, y: number) => {
      xSplitRef.current = x;
      ySplitRef.current = y;
      forceTick((c) => c + 1);
    };
    return () => {
      delete w.__setSplits;
    };
  }, []);

  return (
    <div className="relative h-full w-full bg-black">
      <div className="absolute left-1/2 top-1/2 aspect-[2/1] w-[min(96vw,calc(96vh*2))] -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-black ring-1 ring-white/5">
        <Canvas
          camera={{ position: [0, 0, 78], fov: 42, near: 0.1, far: 600 }}
          gl={{ antialias: true, alpha: false }}
          dpr={[1, 2]}
          style={{ position: "absolute", inset: 0 }}
        >
          <color attach="background" args={["#000000"]} />
          <Suspense fallback={null}>
            <SimulationPlane
              timeRef={timeRef}
              useData={useData}
              dataDuration={DATA_DURATION}
              xSplitRef={xSplitRef}
              ySplitRef={ySplitRef}
            />
          </Suspense>
          <MagneticFieldLines
            timeRef={timeRef}
            visible={!useData}
            onProgress={onStreamlineProgress}
            onReady={onStreamlineReady}
          />
          <CameraController controlsRef={cameraRef} />
        </Canvas>

        <TitleOverlay />
        <PanelLabels />
        <LeftColorbars />
        <AxisLabels />
        <BottomColorbar />
        <SeparatorHandles
          xSplit={xSplitRef.current}
          ySplit={ySplitRef.current}
          onChange={onSplitChange}
        />
        <ModeToggle useData={useData} onToggle={onToggleMode} />
        {useData && (
          <EHTInset timeRef={timeRef} dataDuration={DATA_DURATION} />
        )}
        <LightCurve timeRef={timeRef} duration={DURATION} />
        <PlayerControls
          playing={playing}
          onTogglePlay={onTogglePlay}
          time={displayTime}
          duration={DURATION}
          onSeek={onSeek}
          onResetCamera={onResetCamera}
          onCenterSplits={onCenter}
        />

        {!ready && <LoadingOverlay progress={progress} />}
      </div>
    </div>
  );
}
