// file location: src/singlescroll/three/CameraRig.js
// Scroll-driven camera. Reads the global scroll progress ref each frame and
// eases the camera position/rotation toward a target derived from scroll +
// time. Pure useFrame work — no React re-renders.
//
// Behaviour:
//   - At scroll = 0   : camera sits at hero pose, slow auto-orbit.
//   - At scroll ≈ 0.12: camera has pulled back and up, "letting go" of the
//                       scene as the user moves into the page content.
//   - The orbit continues subtly so even at rest the scene feels alive.

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const HERO_RANGE = 0.12;

export default function CameraRig({ scrollRef, mouseRef }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.4, 0));
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const scroll = scrollRef?.current ?? 0;
    const local = Math.min(1, scroll / HERO_RANGE); // 0 at hero, 1 once past

    // Auto-orbit angle (slow, idle).
    const orbit = t * 0.08;

    // Mouse parallax (capped) for subtle "look-around" feel.
    const mx = (mouseRef?.current?.x ?? 0) * 0.4;
    const my = (mouseRef?.current?.y ?? 0) * 0.25;

    // Radius / height push back as user scrolls into the page.
    const radius = 5.4 + local * 2.2;
    const height = 0.75 + local * 1.3;

    tmp.current.set(
      Math.sin(orbit) * radius + mx,
      height + my,
      Math.cos(orbit) * radius
    );

    // Smooth ease toward target position (frame-rate independent).
    const lerp = 1 - Math.pow(0.0001, delta);
    camera.position.lerp(tmp.current, lerp);
    camera.lookAt(target.current);
  });

  return null;
}
