"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

type Handle = {
  reset: () => void;
};

type Props = {
  controlsRef?: React.MutableRefObject<Handle | null>;
};

const DEFAULT_POSITION = new THREE.Vector3(0, 0, 78);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

export default function CameraController({ controlsRef }: Props) {
  const orbitRef = useRef<React.ComponentRef<typeof OrbitControls> | null>(null);
  const { camera } = useThree();

  useEffect(() => {
    camera.position.copy(DEFAULT_POSITION);
    camera.lookAt(DEFAULT_TARGET);
    if (controlsRef) {
      controlsRef.current = {
        reset: () => {
          camera.position.copy(DEFAULT_POSITION);
          camera.lookAt(DEFAULT_TARGET);
          const c = orbitRef.current as unknown as {
            target: THREE.Vector3;
            update: () => void;
          } | null;
          if (c) {
            c.target.copy(DEFAULT_TARGET);
            c.update();
          }
        },
      };
    }
  }, [camera, controlsRef]);

  return (
    <OrbitControls
      ref={orbitRef}
      enableDamping
      dampingFactor={0.08}
      minDistance={28}
      maxDistance={260}
      makeDefault
    />
  );
}
