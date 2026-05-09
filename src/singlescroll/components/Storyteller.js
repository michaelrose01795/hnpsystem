// file location: src/singlescroll/components/Storyteller.js
// Scroll-pinned "story" section — three dramatic stages that crossfade as
// the user scrolls past. Built with GSAP ScrollTrigger pin + scrub for the
// classic premium-website cinematic feel.
//
// The section is 4× viewport tall but pinned at 1× — each stage owns a
// portion of the scroll range and fades in/out via opacity + translateZ.

import { useEffect, useRef } from "react";
import { siteContent } from "../data/siteContent";
import useReducedMotion from "../hooks/useReducedMotion";
import styles from "../styles/singlescroll.module.css";

const STAGES = [
  {
    eyebrow: "Since 1947",
    big: "75+",
    title: "Three generations of Kent dealership",
    body: "Family-run from day one. The same family. The same showroom in West Malling. The same idea — treat customers like part of the family.",
  },
  {
    eyebrow: "5.0 average · 97 reviews",
    big: "5.0★",
    title: "The reviews speak for us",
    body: "Multi-award-winning. Recognised by AutoTrader Retailer Awards, JudgeService, and Google. Our customers come back, and they tell their friends.",
  },
  {
    eyebrow: "120-point inspection",
    big: "120",
    title: "Every used car. No exceptions.",
    body: "Each used car arrives with a 120-point inspection, a free 6-month warranty, and a minimum 6-month MOT. Buy with confidence.",
  },
  {
    eyebrow: "Approved EV retailer",
    big: "EV",
    title: "Ready for what's next",
    body: "Certified Electric Vehicle Approved by the Office for Low Emission Vehicles. Authorised retailer for the new Suzuki e-Vitara — Suzuki's first all-electric SUV.",
  },
];

export default function Storyteller() {
  const sectionRef = useRef(null);
  const stageRefs = useRef([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined" || reduced) return;
    let cleanups = [];
    let cancelled = false;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      const sectionEl = sectionRef.current;
      const pinEl = sectionEl?.querySelector(`.${styles.storyPinned}`);
      if (!sectionEl || !pinEl) return;

      const stages = stageRefs.current.filter(Boolean);

      gsap.set(stages, { opacity: 0, scale: 0.95, z: -120 });
      gsap.set(stages[0], { opacity: 1, scale: 1, z: 0 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionEl,
          start: "top top",
          end: () => `+=${stages.length * window.innerHeight}`,
          pin: pinEl,
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 1,
        },
      });

      stages.forEach((stage, i) => {
        if (i === 0) return;
        const prev = stages[i - 1];
        tl.to(prev, { opacity: 0, scale: 1.05, z: 80, duration: 1, ease: "power2.in" }, "+=0.3");
        tl.fromTo(
          stage,
          { opacity: 0, scale: 0.95, z: -120 },
          { opacity: 1, scale: 1, z: 0, duration: 1, ease: "power2.out" },
          "<",
        );
      });

      cleanups.push(() => {
        tl.scrollTrigger?.kill();
        tl.kill();
      });

      // Refresh once more to account for image/font loads.
      const refresh = setTimeout(() => ScrollTrigger.refresh(), 300);
      cleanups.push(() => clearTimeout(refresh));
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} className={styles.story} aria-label="Why Humphries & Parks">
      <div className={styles.storyPinned}>
        <div className={styles.storyStageWrap}>
          {STAGES.map((stage, i) => (
            <article
              key={stage.big}
              ref={(el) => { stageRefs.current[i] = el; }}
              className={styles.storyStage}
            >
              <span className={styles.storyEyebrow}>{stage.eyebrow}</span>
              <span className={styles.storyBig} aria-hidden="true">{stage.big}</span>
              <h3 className={styles.storyTitle}>{stage.title}</h3>
              <p className={styles.storyBody}>{stage.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.storyProgress} aria-hidden="true">
          {STAGES.map((_, i) => (
            <span key={i} className={styles.storyProgressDot} />
          ))}
        </div>
      </div>
    </section>
  );
}
