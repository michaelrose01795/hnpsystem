// file location: src/singlescroll/components/Card3D.js
// Wraps any card in a mouse-following 3D tilt effect. CSS-only transforms
// (no Three.js) — cheap, GPU-accelerated, and degrades gracefully if the
// user has prefers-reduced-motion enabled.
//
// Behaviour:
//   - On pointermove inside the card: rotateX / rotateY based on cursor
//     position, plus translateZ to "lift" the card toward the viewer.
//   - On pointerleave: smoothly returns to flat with a CSS transition.
//   - Inner contents can be tagged with data-card3d-layer="N" to opt into
//     a parallax z-translation (deeper layers move more).

import { useRef } from "react";
import useReducedMotion from "../hooks/useReducedMotion";
import styles from "../styles/singlescroll.module.css";

const MAX_TILT = 9; // degrees
const LIFT = 18;    // px

export default function Card3D({ children, className = "", style, intensity = 1 }) {
  const ref = useRef(null);
  const reduced = useReducedMotion();

  const handleMove = (e) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const rx = (-py * MAX_TILT * intensity).toFixed(2);
    const ry = (px * MAX_TILT * intensity).toFixed(2);
    ref.current.style.setProperty("--c3d-rx", `${rx}deg`);
    ref.current.style.setProperty("--c3d-ry", `${ry}deg`);
    ref.current.style.setProperty("--c3d-lift", `${LIFT * intensity}px`);
    ref.current.style.setProperty("--c3d-glare-x", `${(px + 0.5) * 100}%`);
    ref.current.style.setProperty("--c3d-glare-y", `${(py + 0.5) * 100}%`);
    ref.current.style.setProperty("--c3d-glare-opacity", "1");
    ref.current.style.setProperty("--c3d-transition", "transform 0s linear");
  };

  const handleLeave = () => {
    if (!ref.current) return;
    ref.current.style.setProperty("--c3d-rx", "0deg");
    ref.current.style.setProperty("--c3d-ry", "0deg");
    ref.current.style.setProperty("--c3d-lift", "0px");
    ref.current.style.setProperty("--c3d-glare-opacity", "0");
    ref.current.style.setProperty("--c3d-transition", "transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)");
  };

  return (
    <div
      ref={ref}
      className={`${styles.card3d} ${className}`}
      style={style}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div className={styles.card3dInner}>
        {children}
        <span className={styles.card3dGlare} aria-hidden="true" />
      </div>
    </div>
  );
}
