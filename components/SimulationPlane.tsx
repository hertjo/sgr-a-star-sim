"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
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
};

export default function SimulationPlane({ time }: SimulationPlaneProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame(() => {
    if (materialRef.current) {
      (materialRef.current.uniforms.uTime as { value: number }).value = time;
    }
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
