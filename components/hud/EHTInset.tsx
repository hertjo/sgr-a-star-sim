"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uDataDuration;
uniform sampler2D uRadAtlas;
uniform float uAtlasFrames;
uniform float uAtlasCols;
uniform float uAtlasRows;

// Sigma of the Gaussian PSF, in r_g. For Sgr A* at 230 GHz, the EHT beam
// is ~20 microarcsec FWHM, which is ~4 r_g; sigma = FWHM / 2.355 ~= 1.7 r_g.
const float BEAM_SIGMA = 1.7;
// The inset window covers \xb1ZOOM r_g around the BH.
const float ZOOM = 18.0;

// Atlas tile UV from a plot-space (x, y) point. The plot domain is
// always (-60..60) x (-30..30) regardless of zoom.
vec2 atlasUVAt(vec2 p, float f) {
  float fullU = (p.x + 60.0) / 120.0;
  float fullV = (30.0 - p.y) / 60.0;
  fullU = clamp(fullU, 0.005, 0.995);
  fullV = clamp(fullV, 0.005, 0.995);
  float col = mod(f, uAtlasCols);
  float row = floor(f / uAtlasCols);
  return vec2((col + fullU) / uAtlasCols, (row + fullV) / uAtlasRows);
}

float gaussSample(vec2 p, float f) {
  float spacing = BEAM_SIGMA * 0.95;
  float total = 0.0;
  float wsum = 0.0;
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 off = vec2(float(dx), float(dy)) * spacing;
      float d2 = dot(off, off) / (BEAM_SIGMA * BEAM_SIGMA);
      float w = exp(-0.5 * d2);
      total += w * texture2D(uRadAtlas, atlasUVAt(p + off, f)).r;
      wsum += w;
    }
  }
  return total / wsum;
}

vec3 afmhot(float v) {
  v = clamp(v, 0.0, 1.0);
  vec3 cBlack    = vec3(0.0);
  vec3 cDarkRed  = vec3(0.30, 0.03, 0.02);
  vec3 cRed      = vec3(0.85, 0.18, 0.05);
  vec3 cOrange   = vec3(1.00, 0.55, 0.12);
  vec3 cYellow   = vec3(1.00, 0.90, 0.55);
  vec3 col =    mix(cBlack,  cDarkRed, smoothstep(0.0, 0.20, v));
  col = mix(col, cRed,        smoothstep(0.18, 0.50, v));
  col = mix(col, cOrange,     smoothstep(0.45, 0.80, v));
  col = mix(col, cYellow,     smoothstep(0.80, 1.00, v));
  return col;
}

void main() {
  vec2 p = vec2(vUv.x * 2.0 - 1.0, vUv.y * 2.0 - 1.0) * ZOOM;

  float fContinuous = mod(uTime, uDataDuration) / uDataDuration * uAtlasFrames;
  float fa = floor(fContinuous);
  float fb = mod(fa + 1.0, uAtlasFrames);
  float t = fContinuous - fa;
  float a = gaussSample(p, fa);
  float b = gaussSample(p, fb);
  float v = mix(a, b, t);

  // Bring the dim outer disk down to black; emphasize the bright ring.
  v = pow(v, 1.15);

  vec3 col = afmhot(v);
  gl_FragColor = vec4(col, 1.0);
}
`;

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

type SceneProps = {
  timeRef: React.MutableRefObject<number>;
  dataDuration: number;
};

function Scene({ timeRef, dataDuration }: SceneProps) {
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

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDataDuration: { value: dataDuration },
      uRadAtlas: { value: atlas },
      uAtlasFrames: { value: 101 },
      uAtlasCols: { value: 11 },
      uAtlasRows: { value: 10 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    fetch("/grmhd/manifest.json")
      .then((r) => r.json())
      .then((m) => {
        if (!materialRef.current) return;
        const u = materialRef.current.uniforms;
        (u.uAtlasFrames as { value: number }).value = m.radiation.frames;
        (u.uAtlasCols as { value: number }).value = m.radiation.cols;
        (u.uAtlasRows as { value: number }).value = m.radiation.rows;
      })
      .catch(() => null);
  }, []);

  useFrame(() => {
    if (!materialRef.current) return;
    (materialRef.current.uniforms.uTime as { value: number }).value =
      timeRef.current;
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        toneMapped={false}
        depthTest={false}
      />
    </mesh>
  );
}

type Props = {
  timeRef: React.MutableRefObject<number>;
  dataDuration: number;
};

export default function EHTInset({ timeRef, dataDuration }: Props) {
  return (
    <div className="pointer-events-none absolute right-[80px] top-[80px] z-10 select-none">
      <div className="relative">
        <div className="h-[120px] w-[120px] overflow-hidden rounded-sm bg-black ring-1 ring-white/30 shadow-lg shadow-black/40">
          <Canvas
            orthographic
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 2]}
            camera={{ position: [0, 0, 1] }}
          >
            <Scene timeRef={timeRef} dataDuration={dataDuration} />
          </Canvas>
        </div>
        <div className="absolute -bottom-4 left-0 right-0 text-center font-mono text-[9px] uppercase tracking-[0.15em] text-white/65">
          EHT-beam
        </div>
      </div>
    </div>
  );
}
