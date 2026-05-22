// file location: src/features/3Dwebsite/components/ThreeDScene.js
// The React Three Fiber <Canvas> for the showcase. Composes lighting, the
// cutaway building shell, the scroll-driven camera rig and all seven rooms.
// Memoised so it never re-renders while the page scrolls — the scene reads
// scroll state through the shared ref inside useFrame instead.

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import CameraScrollController from "./CameraScrollController";
import CutawayBuilding from "./CutawayBuilding";
import RoomContent from "./three/RoomFixtures";
import { BUILDING, PALETTE, getRoomCenterX, STAGES } from "@/features/3Dwebsite/data/threeDWebsiteMockData";

function ThreeDScene({ scrollRef, reducedMotion = false, frameloop = "always" }) {
  const start = STAGES[0].cam;

  return (
    <Canvas
      shadows
      frameloop={frameloop}
      dpr={[1, 1.8]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [start.pos[0], start.pos[1], start.pos[2]], fov: 42, near: 0.5, far: 240 }}
    >
      <color attach="background" args={[PALETTE.sceneBg]} />
      <fog attach="fog" args={[PALETTE.sceneBg, 56, 168]} />

      {/* Ambient + soft fills. The shadow-casting key light lives in the
          camera rig so it always tracks the active room. */}
      <ambientLight intensity={0.85} />
      <hemisphereLight color="#ffffff" groundColor="#8b8d97" intensity={0.7} />
      <directionalLight position={[-9, 11, -7]} intensity={0.55} />

      <Suspense fallback={null}>
        <CameraScrollController scrollRef={scrollRef} reducedMotion={reducedMotion} />
        <CutawayBuilding />
        {BUILDING.rooms.map((room, i) => (
          <group key={room.id} position={[getRoomCenterX(i), 0, 0]}>
            <RoomContent index={i} scrollRef={scrollRef} reducedMotion={reducedMotion} />
          </group>
        ))}
      </Suspense>
    </Canvas>
  );
}

export default React.memo(ThreeDScene);
