// file location: src/features/3Dwebsite/components/three/SimpleCar.js
// Reusable low-poly car built entirely from primitives (no external models).
// One component drives every car in the showcase via the `effect` prop:
//   • "static"   — sits still
//   • "spin"     — slow showroom turntable rotation
//   • "explode"  — parts lift away in an exploded view (scroll-driven)
//   • "driveOff" — rolls out of the building (scroll-driven)
// `repairPanel` swaps the nearside rear door for its own material so the
// smart-repair stage can paint it from a dulled finish back to factory colour.
//
// All scroll-driven effects read the shared scrollRef inside useFrame, so the
// component never re-renders while the page scrolls.

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, clamp01, stageReveal } from "@/features/3Dwebsite/data/threeDWebsiteMockData";

// Separable pieces for the exploded view: assembled base position + the
// outward direction / distance each piece travels as `explode` goes 0 → 1.
const PIECES = [
  { id: "bonnet", base: [1.25, 1.12, 0], dir: [0.2, 1, 0], dist: 1.5 },
  { id: "glasshouse", base: [-0.25, 1.62, 0], dir: [-0.1, 1, 0], dist: 2.4 },
  { id: "doorL", base: [-0.2, 1.0, -1.0], dir: [0, 0.15, -1], dist: 1.7 },
  { id: "doorR", base: [-0.2, 1.0, 1.0], dir: [0, 0.15, 1], dist: 1.7 },
  { id: "wheelFL", base: [1.5, 0.52, -0.92], dir: [0.5, 0, -1], dist: 1.3 },
  { id: "wheelFR", base: [1.5, 0.52, 0.92], dir: [0.5, 0, 1], dist: 1.3 },
  { id: "wheelRL", base: [-1.5, 0.52, -0.92], dir: [-0.5, 0, -1], dist: 1.3 },
  { id: "wheelRR", base: [-1.5, 0.52, 0.92], dir: [-0.5, 0, 1], dist: 1.3 },
];
const WHEEL_IDS = ["wheelFL", "wheelFR", "wheelRL", "wheelRR"];

export default function SimpleCar({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  bodyColor = PALETTE.carGrey,
  effect = "static",
  stageIndex = 0,
  repairPanel = false,
  scrollRef = null,
  reducedMotion = false,
}) {
  const rootRef = useRef();
  // Per-piece refs keyed by id (positioning groups for the exploded view).
  const pieceRefs = useRef({});
  // Inner spin groups for the four wheels (rolling during drive-off).
  const wheelSpinRefs = useRef({});

  // Animated materials must be stable instances so useFrame can mutate them.
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.45, roughness: 0.42 }),
    [bodyColor],
  );
  const repairMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: repairPanel ? PALETTE.carDamaged : bodyColor,
        metalness: 0.4,
        roughness: 0.5,
      }),
    [repairPanel, bodyColor],
  );

  // Reusable colour scratch values (avoid per-frame allocation).
  const colours = useMemo(
    () => ({
      body: new THREE.Color(bodyColor),
      grime: new THREE.Color(PALETTE.grime),
      damaged: new THREE.Color(PALETTE.carDamaged),
      scratch: new THREE.Color(),
    }),
    [bodyColor],
  );

  // Materials are attached to meshes, so React Three Fiber disposes them when
  // the scene unmounts — no manual disposal effect needed.

  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const dt = Math.min(delta, 0.066);
    const sf = scrollRef?.current?.stageFloat ?? stageIndex;
    const baseX = position[0];

    // --- Exploded view ----------------------------------------------------
    if (effect === "explode") {
      const amt = reducedMotion ? 1 : stageReveal(sf, stageIndex);
      for (const piece of PIECES) {
        const g = pieceRefs.current[piece.id];
        if (!g) continue;
        g.position.set(
          piece.base[0] + piece.dir[0] * piece.dist * amt,
          piece.base[1] + piece.dir[1] * piece.dist * amt,
          piece.base[2] + piece.dir[2] * piece.dist * amt,
        );
      }
    }

    // --- Drive-away -------------------------------------------------------
    if (effect === "driveOff") {
      const off = reducedMotion ? 1 : clamp01((sf - (stageIndex - 0.7)) / 0.62);
      root.position.x = baseX + off * 26;
      for (const id of WHEEL_IDS) {
        const w = wheelSpinRefs.current[id];
        if (w) w.rotation.z = -off * 34;
      }
    }

    // --- Showroom turntable ----------------------------------------------
    if (effect === "spin") {
      root.rotation.y = reducedMotion ? rotation[1] - 0.5 : rotation[1] + state.clock.elapsedTime * 0.22;
    }

    // --- Valet: grime washes off as the stage reveals --------------------
    if (effect === "grime") {
      const dirt = reducedMotion ? 0 : 1 - stageReveal(sf, stageIndex);
      colours.scratch.copy(colours.body).lerp(colours.grime, dirt * 0.78);
      bodyMat.color.lerp(colours.scratch, 1 - Math.pow(0.0025, dt));
    }

    // --- Smart repair: dulled panel is painted back to colour ------------
    if (repairPanel) {
      const paint = reducedMotion ? 1 : stageReveal(sf, stageIndex);
      colours.scratch.copy(colours.damaged).lerp(colours.body, paint);
      repairMat.color.lerp(colours.scratch, 1 - Math.pow(0.0025, dt));
      repairMat.roughness = THREE.MathUtils.lerp(0.78, 0.42, paint);
    }
  });

  const registerPiece = (id) => (el) => {
    pieceRefs.current[id] = el;
  };

  return (
    <group ref={rootRef} position={position} rotation={rotation} scale={scale}>
      {/* Lower body — non-separable core */}
      <RoundedBox args={[4.3, 0.9, 2.04]} radius={0.22} smoothness={3} position={[0, 0.66, 0]} castShadow receiveShadow material={bodyMat} />
      <RoundedBox args={[3.4, 0.5, 2.1]} radius={0.18} smoothness={2} position={[-0.1, 1.12, 0]} castShadow material={bodyMat} />

      {/* Bonnet — separable */}
      <group ref={registerPiece("bonnet")} position={[1.25, 1.12, 0]}>
        <RoundedBox args={[1.55, 0.2, 1.9]} radius={0.09} smoothness={2} castShadow material={bodyMat} />
      </group>

      {/* Glasshouse / cabin — separable, lifts on explode */}
      <group ref={registerPiece("glasshouse")} position={[-0.25, 1.62, 0]}>
        <RoundedBox args={[2.3, 0.62, 1.74]} radius={0.16} smoothness={3} castShadow material={bodyMat} />
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[2.0, 0.46, 1.8]} />
          <meshStandardMaterial color={PALETTE.glass} metalness={0.4} roughness={0.12} />
        </mesh>
      </group>

      {/* Doors — separable. The +Z door is the smart-repair panel. */}
      <group ref={registerPiece("doorL")} position={[-0.2, 1.0, -1.0]}>
        <RoundedBox args={[1.7, 0.74, 0.14]} radius={0.06} smoothness={2} castShadow material={bodyMat} />
      </group>
      <group ref={registerPiece("doorR")} position={[-0.2, 1.0, 1.0]}>
        <RoundedBox args={[1.7, 0.74, 0.14]} radius={0.06} smoothness={2} castShadow material={repairPanel ? repairMat : bodyMat} />
      </group>

      {/* Bumpers — fixed */}
      <RoundedBox args={[0.46, 0.5, 1.98]} radius={0.12} smoothness={2} position={[2.18, 0.52, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.charcoal} metalness={0.3} roughness={0.6} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.5, 1.98]} radius={0.12} smoothness={2} position={[-2.18, 0.52, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.charcoal} metalness={0.3} roughness={0.6} />
      </RoundedBox>

      {/* Lights */}
      <mesh position={[2.34, 0.78, 0.6]}>
        <boxGeometry args={[0.12, 0.22, 0.42]} />
        <meshStandardMaterial color="#fff7e6" emissive="#fff2cc" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[2.34, 0.78, -0.6]}>
        <boxGeometry args={[0.12, 0.22, 0.42]} />
        <meshStandardMaterial color="#fff7e6" emissive="#fff2cc" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[-2.34, 0.82, 0.6]}>
        <boxGeometry args={[0.1, 0.2, 0.4]} />
        <meshStandardMaterial color={PALETTE.redBright} emissive={PALETTE.red} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[-2.34, 0.82, -0.6]}>
        <boxGeometry args={[0.1, 0.2, 0.4]} />
        <meshStandardMaterial color={PALETTE.redBright} emissive={PALETTE.red} emissiveIntensity={0.6} />
      </mesh>

      {/* Wheels — outer group = exploded-view position, inner group = roll */}
      {WHEEL_IDS.map((id) => {
        const piece = PIECES.find((p) => p.id === id);
        return (
          <group key={id} ref={registerPiece(id)} position={piece.base}>
            <group ref={(el) => (wheelSpinRefs.current[id] = el)}>
              <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[0.52, 0.52, 0.36, 20]} />
                <meshStandardMaterial color={PALETTE.tyre} metalness={0.1} roughness={0.85} />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.27, 0.27, 0.38, 16]} />
                <meshStandardMaterial color={PALETTE.chrome} metalness={0.85} roughness={0.3} />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
}
