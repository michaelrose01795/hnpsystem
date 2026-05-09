// file location: src/singlescroll/components/Hero.js
// Hero — text overlay that sits on top of the persistent 3D canvas. The
// canvas itself is mounted globally in WebsitePage (not here), so this
// component only owns the text layer and the scroll-fade behaviour.

import { useEffect, useRef, useState } from "react";
import { siteContent } from "../data/siteContent";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function Hero() {
  const scrollTo = useSmoothScrollTo();
  const innerRef = useRef(null);
  const { hero } = siteContent;
  const [progress, setProgress] = useState(0);

  // Hero-local scroll progress (for fading the text out as it scrolls away).
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
      {/* Subtle vignette overlay specific to the hero (text legibility) */}
      <div className={styles.heroOverlay} aria-hidden="true" />

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
      </div>

      <div className={styles.heroScrollHint} aria-hidden="true">
        <span>Scroll</span>
        <span className={styles.heroScrollHintLine} />
      </div>
    </section>
  );
}
