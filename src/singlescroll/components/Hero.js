// file location: src/singlescroll/components/Hero.js
// Hero — text overlay that sits on top of the persistent 3D canvas.
//
// Redesign notes:
//   - Same scroll-fade behaviour as before so the headline melts into
//     the next chapter as you scroll.
//   - Adds a huge ghost "1947" backdrop numeral matching the rest of
//     the page's scene language (Storyteller diorama master pattern).
//   - Inline trust mini-strip below the CTAs introduces the trust pillars
//     without a separate slab section. The full TrustBar is rolled
//     into the cars chapter that follows.

import { useEffect, useRef, useState } from "react";
import { siteContent } from "../data/siteContent";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

const HERO_STATS = [
  { value: "75+", label: "Years family-run" },
  { value: "5.0★", label: "97 reviews" },
  { value: "120-pt", label: "Inspection" },
  { value: "EV", label: "Approved" },
];

export default function Hero() {
  const scrollTo = useSmoothScrollTo();
  const innerRef = useRef(null);
  const { hero } = siteContent;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const heroEl = document.getElementById("top");
      if (!heroEl) return;
      const r = heroEl.getBoundingClientRect();
      const scrolled = -r.top;
      const total = r.height;
      setProgress(Math.max(0, Math.min(1, scrolled / total)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const handleCta = (href) => (e) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      scrollTo(href.slice(1));
    }
  };

  const fade = 1 - Math.min(1, progress * 1.6);
  const translate = progress * 60;

  return (
    <section id="top" className={styles.hero} aria-label="Welcome">
      <div className={styles.heroOverlay} aria-hidden="true" />

      <div className={styles.heroBackdrop} aria-hidden="true" data-parallax="-30">
        <span>1947</span>
      </div>

      <div
        ref={innerRef}
        className={styles.heroInner}
        style={{ opacity: fade, transform: `translate3d(0, ${-translate}px, 0)` }}
      >
        <span className={styles.heroEyebrow} data-reveal>{hero.eyebrow}</span>
        <h1 className={styles.heroHeadline} data-reveal>{hero.headline}</h1>
        <p className={styles.heroSubhead} data-reveal>{hero.subhead}</p>

        <div className={styles.heroCtas} data-reveal>
          {hero.ctas.map((cta) => (
            <a
              key={cta.label}
              href={cta.href}
              onClick={handleCta(cta.href)}
              className={`${styles.btn} ${
                cta.variant === "primary" ? styles.btnPrimary : styles.btnGhost
              }`}
            >
              <span>{cta.label}</span>
              <span className={styles.btnChevron} aria-hidden="true">→</span>
            </a>
          ))}
        </div>

        <div className={styles.heroStatRow} data-reveal>
          {HERO_STATS.map((s) => (
            <div key={s.label} className={styles.heroStat}>
              <span className={styles.heroStatValue}>{s.value}</span>
              <span className={styles.heroStatLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.heroScrollHint} aria-hidden="true">
        <span>Scroll</span>
        <span className={styles.heroScrollHintLine} />
      </div>
    </section>
  );
}
