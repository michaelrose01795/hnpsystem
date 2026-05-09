// file location: src/singlescroll/components/Hero.js
// Hero with the 3D showroom canvas behind, hero copy in front. The poster
// fallback (the dealership storefront image) is rendered as a low-priority
// background image so reduced-motion / non-WebGL visitors still see context.

import { useEffect, useRef, useState } from "react";
import { siteContent } from "../data/siteContent";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function Hero({ children3D }) {
  const scrollTo = useSmoothScrollTo();
  const innerRef = useRef(null);
  const { hero } = siteContent;
  const [progress, setProgress] = useState(0);

  // Track hero's own scroll progress (0 at top, 1 once hero is fully scrolled
  // out) so we can fade and translate the hero copy as the user scrolls.
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
  const innerStyle = {
    opacity: fade,
    transform: `translate3d(0, ${-translate}px, 0)`,
  };

  return (
    <section id="top" className={styles.hero} data-parallax-container>
      {/* 3D canvas mounts here (passed in by parent so SSR / capability
          checks live one level up — Hero stays presentational). */}
      <div className={styles.heroSceneSlot}>{children3D}</div>

      {/* Poster fallback — visible if 3D is disabled / behind the canvas */}
      <div className={styles.heroBgWrap} data-parallax="-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.backgroundUrl}
          alt=""
          className={styles.heroBg}
          aria-hidden="true"
        />
      </div>

      <div className={styles.heroOverlay} aria-hidden="true" />

      <div ref={innerRef} className={styles.heroInner} style={innerStyle}>
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
              {cta.label}
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
