// file location: src/features/3Dwebsite/components/three/Mechanic.js
// A simple stylised technician figure built from primitives. The right arm
// runs a looping "working" motion (turning a spanner). Under reduced motion
// the figure freezes in a neutral working pose.

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { PALETTE } from "@/features/3Dwebsite/data/threeDWebsiteMockData";

const SKIN = "#d8a079";
const BOOT = "#1c1d22";

export default function Mechanic({ position = [0, 0, 0], rotation = [0, 0, 0], reducedMotion = false }) {
  const armRef = useRef();
  const torsoRef = useRef();

  useFrame((state) => {
    if (reducedMotion) {
      if (armRef.current) armRef.current.rotation.x = -0.85;
      return;
    }
    const t = state.clock.elapsedTime;
    if (armRef.current) armRef.current.rotation.x = -0.6 + Math.sin(t * 3.4) * 0.55;
    if (torsoRef.current) torsoRef.current.position.y = 1.16 + Math.sin(t * 3.4) * 0.03;
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Legs */}
      <mesh position={[-0.16, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.84, 12]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.8} />
      </mesh>
      <mesh position={[0.16, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.84, 12]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.8} />
      </mesh>
      <mesh position={[-0.16, 0.05, 0.07]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.42]} />
        <meshStandardMaterial color={BOOT} roughness={0.7} />
      </mesh>
      <mesh position={[0.16, 0.05, 0.07]} castShadow>
        <boxGeometry args={[0.22, 0.14, 0.42]} />
        <meshStandardMaterial color={BOOT} roughness={0.7} />
      </mesh>

      {/* Torso — H&P red overalls */}
      <group ref={torsoRef} position={[0, 1.16, 0]}>
        <RoundedBox args={[0.62, 0.78, 0.38]} radius={0.12} smoothness={2} castShadow>
          <meshStandardMaterial color={PALETTE.red} roughness={0.62} />
        </RoundedBox>
        {/* Head + cap */}
        <mesh position={[0, 0.62, 0]} castShadow>
          <sphereGeometry args={[0.2, 18, 18]} />
          <meshStandardMaterial color={SKIN} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.74, 0.02]} castShadow>
          <sphereGeometry args={[0.21, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={PALETTE.charcoal} roughness={0.6} />
        </mesh>

        {/* Left arm — static, resting */}
        <group position={[-0.4, 0.28, 0]} rotation={[0.2, 0, 0.35]}>
          <mesh position={[0, -0.3, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.66, 10]} />
            <meshStandardMaterial color={PALETTE.red} roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.66, 0]} castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
        </group>

        {/* Right arm — animated working motion, pivots at the shoulder */}
        <group ref={armRef} position={[0.4, 0.28, 0]} rotation={[-0.6, 0, -0.25]}>
          <mesh position={[0, -0.32, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.7, 10]} />
            <meshStandardMaterial color={PALETTE.red} roughness={0.62} />
          </mesh>
          <mesh position={[0, -0.7, 0]} castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          {/* Spanner in hand */}
          <mesh position={[0, -0.82, 0.16]} rotation={[0.5, 0, 0]} castShadow>
            <boxGeometry args={[0.07, 0.36, 0.07]} />
            <meshStandardMaterial color={PALETTE.chrome} metalness={0.85} roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
