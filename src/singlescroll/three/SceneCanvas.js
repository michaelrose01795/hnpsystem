// file location: src/singlescroll/three/SceneCanvas.js
// The R3F canvas wrapper that hosts the hero showroom scene.
//
// - Sits absolute-positioned inside the hero so it disappears with the hero.
// - Render loop pauses (frameloop="never") when the hero scrolls out of view
//   to save battery — IntersectionObserver flips it back to "always" when
//   the hero re-enters.
// - Reads the user's mouse position at the page level for camera parallax.
// - Adds Bloom postprocessing on capable devices for a premium glow on the
//   red core.

import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useEffect, useRef, useState } from "react";

import Showroom from "./Showroom";
import CameraRig from "./CameraRig";
import useReducedMotion from "../hooks/useReducedMotion";
import styles from "../styles/singlescroll.module.css";

export default function SceneCanvas({ scrollRef, lowQuality = false }) {
  const containerRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [active, setActive] = useState(true);
  const reduced = useReducedMotion();

  // Pause the render loop when the hero is offscreen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("top");
    if (!target || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "120px 0px 120px 0px" },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  // Track mouse position across the window for camera parallax.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={containerRef} className={styles.sceneCanvas} aria-hidden="true">
      <Canvas
        dpr={lowQuality ? [1, 1.25] : [1, 1.6]}
        camera={{ position: [0, 0.75, 5.5], fov: 36 }}
        frameloop={active && !reduced ? "always" : "never"}
        gl={{
          antialias: !lowQuality,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#080809"]} />
        <fog attach="fog" args={["#080809", 8, 14]} />

        <CameraRig scrollRef={scrollRef} mouseRef={mouseRef} />
        <Showroom scrollRef={scrollRef} lowQuality={lowQuality} />

        {!lowQuality && (
          <EffectComposer>
            <Bloom
              intensity={0.9}
              luminanceThreshold={0.6}
              luminanceSmoothing={0.4}
              radius={0.75}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.18} darkness={0.65} />
          </EffectComposer>
        )}
      </Canvas>

      {/* Vignette overlay — keeps text readable + sells the depth of the scene */}
      <div className={styles.sceneVignette} />
    </div>
  );
}
