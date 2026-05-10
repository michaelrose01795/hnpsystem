// file location: src/singlescroll/components/Storyteller.js
// "The H&P Promise" — an immersive 3D diorama showcasing the four trust
// pillars all at once, instead of the previous fragile pin-and-crossfade.
//
// Layout:
//   - A single ~100vh section with strong 3D perspective.
//   - A central rotating chrome ring (pure CSS 3D — no extra Three.js).
//   - Four trust pillars arranged around it as floating tilted panels at
//     different z-depths.
//   - The whole scene parallaxes against the user's mouse + scroll, giving
//     the feeling of moving through a 3D installation.
//
// Pure CSS-transform driven — robust, no pin, no scroll-spacer surprises.

import { useEffect, useRef } from "react";
import useReducedMotion from "../hooks/useReducedMotion";
import styles from "../styles/singlescroll.module.css";

const PILLARS = [
  {
    big: "75+",
    eyebrow: "Since 1947",
    title: "Three generations of family",
    body: "Same family, same showroom in West Malling. Treating customers like part of the H&P family from day one.",
    pos: "tl",
    depth: -120,
  },
  {
    big: "5.0★",
    eyebrow: "97 reviews",
    title: "The reviews speak for us",
    body: "Multi-award-winning. Recognised by AutoTrader, JudgeService and Google. Customers come back, and tell their friends.",
    pos: "tr",
    depth: -60,
  },
  {
    big: "120",
    eyebrow: "Point inspection",
    title: "Every used car. No exceptions.",
    body: "Every used car arrives with a 120-point inspection, free 6-month warranty and minimum 6-month MOT.",
    pos: "bl",
    depth: -60,
  },
  {
    big: "EV",
    eyebrow: "Approved retailer",
    title: "Ready for what's next",
    body: "Certified by the Office for Low Emission Vehicles. Authorised retailer for the new Suzuki e-Vitara.",
    pos: "br",
    depth: -120,
  },
];

export default function Storyteller() {
  const sceneRef = useRef(null);
  const reduced = useReducedMotion();

  // Mouse-driven scene tilt — the whole diorama leans toward the cursor.
  useEffect(() => {
    if (typeof window === "undefined" || reduced) return;
    const el = sceneRef.current;
    if (!el) return;

    let raf = null;
    let targetX = 0;
    let targetY = 0;
    let currX = 0;
    let currY = 0;

    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      // Only respond when the section is in the viewport.
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetX = ((e.clientX - cx) / rect.width) * 8;   // up to ±8deg
      targetY = ((e.clientY - cy) / rect.height) * -6; // up to ±6deg
      if (raf == null) raf = requestAnimationFrame(tick);
    };

    const tick = () => {
      currX += (targetX - currX) * 0.08;
      currY += (targetY - currY) * 0.08;
      el.style.setProperty("--scene-rot-y", `${currX.toFixed(2)}deg`);
      el.style.setProperty("--scene-rot-x", `${currY.toFixed(2)}deg`);
      if (Math.abs(targetX - currX) > 0.05 || Math.abs(targetY - currY) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <section id="about" className={styles.diorama} aria-label="About Humphries & Parks">
      {/* Backdrop numerals — huge faded "1947" parallax layer */}
      <div className={styles.dioramaBackdrop} data-parallax="-20" aria-hidden="true">
        <span>1947</span>
      </div>

      {/* Section heading — sits at the top of the diorama. The About Us
          nav scrolls here; this is the heart of who we are, not just a
          promise badge. */}
      <header className={styles.dioramaHead} data-reveal>
        <div className={styles.sceneHeadRow} style={{ justifyContent: "center" }}>
          <span className={styles.sceneNumber}>06 /</span>
          <span className={styles.eyebrow}>About Us</span>
        </div>
        <h2 className={styles.heading}>Why families across Kent keep coming back</h2>
        <p className={styles.lead} style={{ textAlign: "center" }}>
          Same family, same showroom, same idea since 1947 — take care of the customer.
        </p>
      </header>

      {/* The 3D scene — perspective parent */}
      <div ref={sceneRef} className={styles.dioramaScene}>
        {/* Centerpiece: rotating chrome ring with 1947 inside */}
        <div className={styles.dioramaCenter} aria-hidden="true">
          <div className={styles.dioramaRing} />
          <div className={styles.dioramaRingInner} />
          <div className={styles.dioramaRingOuter} />
          <span className={styles.dioramaCenterLabel}>Est.</span>
          <span className={styles.dioramaCenterYear}>1947</span>
          <span className={styles.dioramaCenterTagline}>Humphries &amp; Parks</span>
        </div>

        {/* Four corner pillars */}
        {PILLARS.map((p) => (
          <article
            key={p.big}
            className={`${styles.dioramaPillar} ${styles[`pillar_${p.pos}`]}`}
            style={{ "--pillar-depth": `${p.depth}px` }}
            data-reveal
          >
            <span className={styles.dioramaPillarBig} aria-hidden="true">{p.big}</span>
            <span className={styles.dioramaPillarEyebrow}>{p.eyebrow}</span>
            <h3 className={styles.dioramaPillarTitle}>{p.title}</h3>
            <p className={styles.dioramaPillarBody}>{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
