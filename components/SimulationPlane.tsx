"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

import vertShader from "@/shaders/simulation.vert";
import fragMain from "@/shaders/simulation.frag";
import noiseLib from "@/shaders/lib/noise";
import colormapsLib from "@/shaders/lib/colormaps";
import fieldsLib from "@/shaders/lib/fields";
import { PLOT_W, PLOT_H } from "@/lib/fieldMath";

const FRAGMENT_HEADER = `
precision highp float;
varying vec2 vPos;
uniform float uTime;
uniform float uUseData;       // 0 = procedural, 1 = real GRMHD textures
uniform sampler2D uRadAtlas;
uniform float uAtlasFrames;
uniform float uAtlasCols;
uniform float uAtlasRows;
uniform float uDataDuration;  // seconds the atlas should loop over
`;

const FRAGMENT_SHADER = [
  FRAGMENT_HEADER,
  noiseLib,
  colormapsLib,
  fieldsLib,
  fragMain,
].join("\n");

type SimulationPlaneProps = {
  time: number;
  useData: boolean;
  dataDuration: number;
};

type Manifest = {
  radiation: {
    frames: number;
    tile_w: number;
    tile_h: number;
    cols: number;
    rows: number;
  };
};

export default function SimulationPlane({
  time,
  useData,
  dataDuration,
}: SimulationPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const atlas = useLoader(THREE.TextureLoader, "/grmhd/inu_atlas.png");
  useEffect(() => {
    atlas.flipY = false;
    atlas.minFilter = THREE.LinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.wrapS = THREE.ClampToEdgeWrapping;
    atlas.wrapT = THREE.ClampToEdgeWrapping;
    atlas.needsUpdate = true;
  }, [atlas]);

  // The manifest is small JSON; fetched once on mount.
  const manifestRef = useRef<Manifest | null>(null);
  useEffect(() => {
    fetch("/grmhd/manifest.json")
      .then((r) => r.json())
      .then((m: Manifest) => {
        manifestRef.current = m;
        const u = materialRef.current?.uniforms;
        if (u) {
          (u.uAtlasFrames as { value: number }).value = m.radiation.frames;
          (u.uAtlasCols as { value: number }).value = m.radiation.cols;
          (u.uAtlasRows as { value: number }).value = m.radiation.rows;
        }
      })
      .catch((e) => console.error("manifest load failed", e));
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uUseData: { value: useData ? 1 : 0 },
      uRadAtlas: { value: atlas },
      uAtlasFrames: { value: 101 },
      uAtlasCols: { value: 11 },
      uAtlasRows: { value: 10 },
      uDataDuration: { value: dataDuration },
    }),
    // Build uniforms once; toggling is handled via direct mutation below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    (u.uTime as { value: number }).value = time;
    (u.uUseData as { value: number }).value = useData ? 1 : 0;
    (u.uDataDuration as { value: number }).value = dataDuration;
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[PLOT_W, PLOT_H, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertShader}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        toneMapped={false}
        depthWrite={true}
      />
    </mesh>
  );
}
