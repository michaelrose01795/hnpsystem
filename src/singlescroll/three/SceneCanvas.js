// file location: src/singlescroll/three/SceneCanvas.js
// Persistent fullscreen 3D canvas. Mounted once at the top of the page and
// kept fixed across the whole scroll.
//
// Frame-loop policy:
//   - Animates ONLY while the user is actively scrolling AND a scene-section
//     is in view. Both conditions must be true.
//   - On idle (no scroll for ~220ms) the loop pauses ("never") — the scene
//     freezes on its last frame. Resumes as soon as the next scroll fires.
//   - Reduced-motion users: scene never animates at all.

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useProgress } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";

import Showroom from "./Showroom";
import CameraRig from "./CameraRig";
import useReducedMotion from "../hooks/useReducedMotion";
import useIsScrolling from "../hooks/useIsScrolling";
import styles from "../styles/singlescroll.module.css";

export default function SceneCanvas({ scrollRef, lowQuality = false }) {
  const mouseRef = useRef({ x: 0, y: 0 });
  const [warmedUp, setWarmedUp] = useState(false);
  const reduced = useReducedMotion();
  const { scrolling } = useIsScrolling(220);
  // drei's useProgress subscribes to THREE.DefaultLoadingManager. While
  // `active` is true ANY texture is still loading — we MUST keep the render
  // loop alive during that time, otherwise frameloop="never" freezes the
  // canvas before the textures actually paint and the user sees a blank
  // scene.
  const { active: assetsLoading } = useProgress();

  // Grace period after mount — keep the loop running for ~4s as a safety
  // margin in case the loading-manager misses fire-and-forget assets.
  useEffect(() => {
    const t = setTimeout(() => setWarmedUp(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // The canvas is now visible behind every section (sections are
  // translucent), so we no longer need a per-section visibility check.
  // The render loop is gated purely by scroll activity.

  // Mouse for camera parallax (smoothed inside CameraRig).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Animate while: textures are loading (so they actually paint), within
  // the warm-up window, OR while the user is scrolling.
  const shouldAnimate =
    !reduced && (assetsLoading || !warmedUp || scrolling);

  return (
    <div className={styles.sceneCanvas} aria-hidden="true">
      <Canvas
        dpr={lowQuality ? [1, 1.25] : [1, 1.6]}
        camera={{ position: [0, 0.9, 5.4], fov: 36 }}
        frameloop={shouldAnimate ? "always" : "never"}
        gl={{ antialias: !lowQuality, alpha: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#06060a"]} />
        <fog attach="fog" args={["#06060a", 7, 18]} />

        <Suspense fallback={null}>
          <CameraRig scrollRef={scrollRef} mouseRef={mouseRef} />
          <Showroom lowQuality={lowQuality} />
        </Suspense>

        {!lowQuality && (
          <EffectComposer>
            <Bloom
              intensity={0.85}
              luminanceThreshold={0.55}
              luminanceSmoothing={0.4}
              radius={0.8}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.2} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
