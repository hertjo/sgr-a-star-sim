"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const FRAMES = 60;
const DURATION = 180;

type Props = {
  timeRef: React.MutableRefObject<number>;
  visible?: boolean;
  onProgress?: (p: number) => void;
  onReady?: () => void;
};

// Precomputed magnetic-field streamlines drawn as Three.js LineSegments.
// A Worker traces each seed at every frame at mount; useFrame swaps the
// rendered BufferGeometry per frame so the main thread does almost no
// work during playback.
export default function MagneticFieldLines({
  timeRef,
  visible = true,
  onProgress,
  onReady,
}: Props) {
  const [geometries, setGeometries] = useState<THREE.BufferGeometry[] | null>(
    null,
  );
  const lineRef = useRef<THREE.LineSegments>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL("@/lib/streamlineWorker.ts", import.meta.url),
      { type: "module" },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as
        | { type: "progress"; current: number; total: number }
        | { type: "done"; buffers: Float32Array[] };
      if (msg.type === "progress") {
        onProgress?.(msg.current / msg.total);
      } else if (msg.type === "done") {
        const geoms = msg.buffers.map((arr) => {
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
          return g;
        });
        setGeometries(geoms);
        onReady?.();
      }
    };

    worker.postMessage({ frames: FRAMES, duration: DURATION });

    return () => {
      worker.terminate();
    };
  }, [onProgress, onReady]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        linewidth: 1,
        depthWrite: false,
      }),
    [],
  );

  // Per-frame: swap geometry on the existing LineSegments — no React re-render.
  useFrame(() => {
    if (!geometries || !lineRef.current) return;
    const t = timeRef.current;
    const idx = Math.floor((t / DURATION) * FRAMES) % FRAMES;
    const g = geometries[idx];
    if (lineRef.current.geometry !== g) {
      lineRef.current.geometry = g;
    }
    if (lineRef.current.visible !== visible) {
      lineRef.current.visible = visible;
    }
  });

  if (!geometries) return null;

  return <lineSegments ref={lineRef} geometry={geometries[0]} material={material} />;
}
