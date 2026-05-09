// file location: src/singlescroll/three/CameraRig.js
// Persistent scroll-driven camera. Reads global scroll progress (0..1 across
// the WHOLE page) every frame and continuously moves the camera through the
// scene. This is what makes the 3D object feel "dragged" from one section
// into the next — the camera (and the object's apparent screen position)
// flow smoothly with scroll.
//
// Pose is parametric — sin/cos waves of scroll progress drive the orbit
// angle, radius, height and look-at target. No discrete keyframes to
// maintain; the curves are tuned so each scene section catches the object
// at a meaningful pose.

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

// Scene sections — these scroll progress positions are roughly where the
// scene-section content is centred in the viewport. The camera curves are
// tuned so the object sits in a flattering pose at each.
//   ~0.00  hero       camera close, low angle, full chrome torus front-and-centre
//   ~0.16  diorama    camera pulled back, subtle high angle
//   ~0.62  timeline   camera approaches from the side — historical "monument" feel
//   ~0.78  reviews    camera close again, slightly above

const TAU = Math.PI * 2;

function ease(p) {
  // smoothstep — gentle starts/stops between sections
  return p * p * (3 - 2 * p);
}

function poseForScroll(s) {
  const e = ease(s);

  // Orbit angle: ~1.5 full revolutions across the page
  const angle = e * TAU * 1.4 + 0.4;

  // Radius pulses — closer at scene sections, further at card sections
  const radius = 5.4
    + Math.sin(s * TAU * 2.8) * 1.6
    + e * 1.4;

  // Height also pulses with a slow rise across the page
  const height = 0.9
    + Math.cos(s * TAU * 1.9 + 0.6) * 0.9
    + e * 0.8;

  return {
    pos: new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius),
    look: new THREE.Vector3(0, 0.4, 0),
  };
}

export default function CameraRig({ scrollRef, mouseRef }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3(0, 0.4, 0));
  const currLook = useRef(new THREE.Vector3(0, 0.4, 0));
  const tmp = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const scroll = scrollRef?.current ?? 0;
    const { pos, look } = poseForScroll(scroll);

    // Mouse parallax
    const mx = (mouseRef?.current?.x ?? 0) * 0.4;
    const my = (mouseRef?.current?.y ?? 0) * 0.25;

    targetPos.current.copy(pos);
    targetPos.current.x += mx;
    targetPos.current.y += my;
    targetLook.current.copy(look);

    // Frame-rate-independent ease toward target.
    const lerpAmt = 1 - Math.pow(0.0001, delta);
    camera.position.lerp(targetPos.current, lerpAmt);
    currLook.current.lerp(targetLook.current, lerpAmt);
    camera.lookAt(currLook.current);
  });

  return null;
}
