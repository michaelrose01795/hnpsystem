// file location: src/features/3Dwebsite/components/CutawayBuilding.js
// The temporary mock dealership shell — a clean box of 7 connected rooms.
//
// Permanent cutaway / dollhouse rules (no toggles, ever):
//   • Back wall ........... always solid + visible
//   • Side (end) walls .... always visible, each has a doorway opening so the
//                           car can enter (left) and drive out (right)
//   • Internal dividers ... half-height so you see across connected rooms,
//                           AND they fade out automatically when the camera
//                           glides close (Sims-style cutaway)
//   • Front wall .......... never built — this is the open cutaway side facing
//                           the camera
//   • Ceiling ............. never built — open-top dollhouse

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING, PALETTE, getRoomCenterX } from "@/features/3Dwebsite/data/threeDWebsiteMockData";

const { roomWidth, roomDepth, wallHeight, wallThick, dividerHeight, rooms } = BUILDING;
const ROOM_COUNT = rooms.length;
const TOTAL_LENGTH = ROOM_COUNT * roomWidth;
const MIN_X = -roomWidth / 2;
const MAX_X = (ROOM_COUNT - 1) * roomWidth + roomWidth / 2;
const CENTER_X = ((ROOM_COUNT - 1) * roomWidth) / 2;
const BACK_Z = -roomDepth / 2 - wallThick / 2;
const DOOR_HALF = 2.1; // half-width of the side-wall doorway opening
const DOOR_HEIGHT = 3.0;

// One internal divider — a half-height wall that fades automatically as the
// camera passes it, so it can never block the view of the active room.
function CutawayDivider({ x }) {
  const matRef = useRef();
  useFrame(({ camera }, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const dist = Math.abs(camera.position.x - x);
    // Fully clear within ~2.6 units of the camera, fully solid beyond ~7.5.
    const target = THREE.MathUtils.clamp((dist - 2.6) / 4.9, 0.05, 1);
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 7, Math.min(delta, 0.066));
    // Only occlude while solid — a faded divider must not hide the next room.
    mat.depthWrite = mat.opacity > 0.62;
  });
  return (
    <mesh position={[x, dividerHeight / 2, 0]} receiveShadow>
      <boxGeometry args={[wallThick, dividerHeight, roomDepth]} />
      <meshStandardMaterial ref={matRef} color={PALETTE.divider} roughness={0.9} transparent opacity={1} />
    </mesh>
  );
}

// A side (end) wall built as two jambs + a header, leaving a central doorway.
function EndWall({ x }) {
  const jambLength = roomDepth / 2 - DOOR_HALF;
  const jambZ = DOOR_HALF + jambLength / 2;
  return (
    <group position={[x, 0, 0]}>
      {[-1, 1].map((dir) => (
        <mesh key={dir} position={[0, wallHeight / 2, dir * jambZ]} receiveShadow>
          <boxGeometry args={[wallThick, wallHeight, jambLength]} />
          <meshStandardMaterial color={PALETTE.wallOuter} roughness={0.92} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT + (wallHeight - DOOR_HEIGHT) / 2, 0]} receiveShadow>
        <boxGeometry args={[wallThick, wallHeight - DOOR_HEIGHT, DOOR_HALF * 2]} />
        <meshStandardMaterial color={PALETTE.wallOuter} roughness={0.92} />
      </mesh>
    </group>
  );
}

export default function CutawayBuilding() {
  return (
    <group>
      {/* Outer ground slab — grounds the building so there is no void */}
      <mesh position={[CENTER_X, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TOTAL_LENGTH + 26, roomDepth + 30]} />
        <meshStandardMaterial color="#c9cace" roughness={1} />
      </mesh>

      {/* Per-room floor slabs (top face flush at y = 0) */}
      {rooms.map((room, i) => (
        <mesh key={room.id} position={[getRoomCenterX(i), -0.16, 0]} receiveShadow>
          <boxGeometry args={[roomWidth, 0.32, roomDepth]} />
          <meshStandardMaterial color={room.floor} roughness={0.82} metalness={0.04} />
        </mesh>
      ))}

      {/* Back wall — one long solid wall, always visible */}
      <mesh position={[CENTER_X, wallHeight / 2, BACK_Z]} receiveShadow>
        <boxGeometry args={[TOTAL_LENGTH, wallHeight, wallThick]} />
        <meshStandardMaterial color={PALETTE.wallBack} roughness={0.94} />
      </mesh>
      {/* Subtle skirting strip along the back wall base */}
      <mesh position={[CENTER_X, 0.12, BACK_Z + wallThick / 2 + 0.02]}>
        <boxGeometry args={[TOTAL_LENGTH, 0.24, 0.06]} />
        <meshStandardMaterial color={PALETTE.charcoal} roughness={0.7} />
      </mesh>

      {/* Side / end walls with doorway openings — entrance (left) + exit (right) */}
      <EndWall x={MIN_X - wallThick / 2} />
      <EndWall x={MAX_X + wallThick / 2} />

      {/* Internal half-height dividers — auto-fading cutaway */}
      {Array.from({ length: ROOM_COUNT - 1 }).map((_, i) => (
        <CutawayDivider key={i} x={roomWidth / 2 + i * roomWidth} />
      ))}
    </group>
  );
}
