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

// Wall-clock loop length. The Yoon dataset's 101 frames span 5000 r_g/c of
// simulation time (~28 hours of real Sgr A* accretion). At 180s playback
// each frame is shown for ~1.8s, slow enough that the linear interp
// between adjacent frames reads as a steady evolution rather than a
// pulsation between two states.
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

  // Separator positions live in refs so dragging mutates them every
  // mousemove without re-rendering the React tree. A `_renderTick` state
  // is bumped only to drive the visible handle position via re-render.
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
      // Bump a counter to repaint the React-rendered drag handles. The
      // shader uniforms are read from refs each frame, so they update
      // without needing this.
      forceTick((c) => c + 1);
    },
    [],
  );
  const onCenter = useCallback(() => {
    xSplitRef.current = 0;
    ySplitRef.current = 0;
    forceTick((c) => c + 1);
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
