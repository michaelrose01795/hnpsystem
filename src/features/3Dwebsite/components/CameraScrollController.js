// file location: src/features/3Dwebsite/components/CameraScrollController.js
// Drives the camera along the building as the page scrolls, and carries the
// shadow-casting key light so it always lights the active room.
//
// • Reads scrollRef.current.stageFloat (0 → STAGE_COUNT-1) every frame.
// • Interpolates between per-stage camera waypoints with smooth easing, then
//   damps the real camera toward that target so motion is always smooth and
//   easy to follow regardless of how the user scrolls.
// • On wide screens it pans the look target sideways so the room sits to the
//   left of the floating overlay panel; on narrow screens it frames centred.

import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STAGES, getRoomCenterX } from "@/features/3Dwebsite/data/threeDWebsiteMockData";

export default function CameraScrollController({ scrollRef, reducedMotion = false }) {
  const lightRigRef = useRef();
  const lightRef = useRef();
  const firstFrame = useRef(true);
  const curLook = useRef(new THREE.Vector3());

  // A persistent target object for the directional light (lives in the rig).
  const lightTarget = useMemo(() => new THREE.Object3D(), []);

  // Pre-resolve every stage's camera waypoint to absolute world coordinates.
  const waypoints = useMemo(
    () =>
      STAGES.map((stage, i) => {
        const cx = getRoomCenterX(i);
        return {
          centerX: cx,
          pos: new THREE.Vector3(cx + stage.cam.pos[0], stage.cam.pos[1], stage.cam.pos[2]),
          look: new THREE.Vector3(cx + stage.cam.look[0], stage.cam.look[1], stage.cam.look[2]),
        };
      }),
    [],
  );

  // Reusable scratch vectors (no per-frame allocation).
  const scratch = useMemo(
    () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3() }),
    [],
  );

  // Bake the shadow-camera frustum bounds set via JSX props.
  useEffect(() => {
    const light = lightRef.current;
    if (light && light.shadow && light.shadow.camera) {
      light.shadow.camera.updateProjectionMatrix();
    }
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.066);
    const last = waypoints.length - 1;
    const sf = THREE.MathUtils.clamp(scrollRef?.current?.stageFloat ?? 0, 0, last);

    const i0 = Math.floor(sf);
    const i1 = Math.min(i0 + 1, last);
    const raw = sf - i0;
    const frac = raw * raw * (3 - 2 * raw); // smoothstep easing

    const a = waypoints[i0];
    const b = waypoints[i1];
    scratch.pos.lerpVectors(a.pos, b.pos, frac);
    scratch.look.lerpVectors(a.look, b.look, frac);
    const roomCenterX = THREE.MathUtils.lerp(a.centerX, b.centerX, frac);

    // Pan the framing so the room clears the overlay panel on wide screens.
    const w = state.size.width;
    const panX = w >= 1100 ? 5.4 : w >= 760 ? 3.0 : 0;
    scratch.look.x += panX;
    if (w < 760) {
      // Narrow screens: lift + pull back so the room reads above the sheet.
      scratch.pos.y += 1.0;
      scratch.pos.z += 2.2;
      scratch.look.y += 0.5;
    }

    const camera = state.camera;
    if (firstFrame.current) {
      camera.position.copy(scratch.pos);
      curLook.current.copy(scratch.look);
      firstFrame.current = false;
    } else {
      const lambda = reducedMotion ? 20 : 5.2;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, scratch.pos.x, lambda, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, scratch.pos.y, lambda, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, scratch.pos.z, lambda, dt);
      curLook.current.x = THREE.MathUtils.damp(curLook.current.x, scratch.look.x, lambda, dt);
      curLook.current.y = THREE.MathUtils.damp(curLook.current.y, scratch.look.y, lambda, dt);
      curLook.current.z = THREE.MathUtils.damp(curLook.current.z, scratch.look.z, lambda, dt);
    }
    camera.lookAt(curLook.current);

    // Key light rig follows the active room centre so shadows stay crisp.
    if (lightRigRef.current) {
      lightRigRef.current.position.x = THREE.MathUtils.damp(
        lightRigRef.current.position.x,
        roomCenterX,
        reducedMotion ? 20 : 5.2,
        dt,
      );
    }
  });

  return (
    <group ref={lightRigRef}>
      <directionalLight
        ref={lightRef}
        castShadow
        intensity={2.5}
        position={[6, 15, 9]}
        target={lightTarget}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={1}
        shadow-camera-far={72}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <primitive object={lightTarget} />
    </group>
  );
}
