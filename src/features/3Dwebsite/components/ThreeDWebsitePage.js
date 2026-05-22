// file location: src/features/3Dwebsite/components/ThreeDWebsitePage.js
// Top-level container for the standalone /3Dwebsite showcase.
//
// Owns the single-scroll engine: one rAF-throttled scroll listener writes the
// scroll progress into a ref (consumed by the 3D scene with zero re-renders)
// and only flips React state when the active stage changes. Also handles the
// reduced-motion preference and a WebGL error boundary.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { STAGES, STAGE_COUNT } from "@/features/3Dwebsite/data/threeDWebsiteMockData";
import ThreeDScene from "./ThreeDScene";
import ScrollProgress from "./ScrollProgress";
import DealershipEntrySection from "./DealershipEntrySection";
import SalesSection from "./SalesSection";
import WorkshopSection from "./WorkshopSection";
import PartsSection from "./PartsSection";
import SmartRepairSection from "./SmartRepairSection";
import ValetSection from "./ValetSection";
import CollectionSection from "./CollectionSection";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

// Section overlays in stage order (index === stage index).
const SECTION_COMPONENTS = [
  DealershipEntrySection,
  SalesSection,
  WorkshopSection,
  PartsSection,
  SmartRepairSection,
  ValetSection,
  CollectionSection,
];

// Error boundary — if WebGL is unavailable the scene degrades to a styled
// backdrop and the scrollable story overlays keep working regardless.
class CanvasBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    /* swallowed — the fallback covers it */
  }

  render() {
    if (this.state.failed) return this.props.fallback || null;
    return this.props.children;
  }
}

function SceneFallback() {
  return (
    <div className={styles.sceneFallback}>
      <span className={styles.sceneFallbackNote}>3D view unavailable on this device</span>
    </div>
  );
}

export default function ThreeDWebsitePage() {
  // Live scroll state shared with the 3D scene — a ref, so updating it never
  // triggers a React re-render.
  const scrollRef = useRef({ progress: 0, stageFloat: 0 });
  const scrollerRef = useRef(null);
  const progressFillRef = useRef(null);

  const [activeStage, setActiveStage] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Respect the OS "reduce motion" preference.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Single rAF-throttled scroll listener.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      const progress = max > 0 ? Math.min(Math.max(el.scrollTop / max, 0), 1) : 0;
      const stageFloat = progress * (STAGE_COUNT - 1);
      scrollRef.current.progress = progress;
      scrollRef.current.stageFloat = stageFloat;
      if (progressFillRef.current) {
        progressFillRef.current.style.transform = `scaleX(${progress})`;
      }
      const next = Math.round(stageFloat);
      setActiveStage((prev) => (prev === next ? prev : next));
      if (progress > 0.005) setHasScrolled((was) => was || true);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // Jump straight to a stage (rail dots + entry choice buttons).
  const goToStage = useCallback(
    (index) => {
      const el = scrollerRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      const clamped = Math.min(Math.max(index, 0), STAGE_COUNT - 1);
      el.scrollTo({
        top: (clamped / (STAGE_COUNT - 1)) * max,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [reducedMotion],
  );

  return (
    <div
      ref={scrollerRef}
      className={styles.root}
      tabIndex={0}
      role="region"
      aria-label="3D dealership workflow — scroll to move through the dealership"
    >
      <h1 className={styles.srOnly}>Humphries &amp; Parks — 3D Dealership Workflow</h1>

      {/* Tall track provides the scroll distance; the stage stays pinned. */}
      <div className={styles.track} style={{ height: `${STAGE_COUNT * 100}dvh` }}>
        <div className={styles.sticky}>
          {/* 3D layer */}
          <div className={styles.canvasHolder}>
            <CanvasBoundary fallback={<SceneFallback />}>
              <ThreeDScene scrollRef={scrollRef} reducedMotion={reducedMotion} />
            </CanvasBoundary>
          </div>
          <div className={styles.vignette} aria-hidden="true" />

          {/* Brand mark */}
          <div className={styles.brand} aria-hidden="true">
            <span className={styles.brandChip}>H&amp;P</span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Humphries &amp; Parks</span>
              <span className={styles.brandSub}>3D Dealership Workflow</span>
            </span>
          </div>

          {/* Floating story overlays — all mounted, cross-faded by CSS */}
          <div className={styles.overlays}>
            {STAGES.map((stage, i) => {
              const Section = SECTION_COMPONENTS[i];
              if (!Section) return null;
              return (
                <Section
                  key={stage.id}
                  stage={stage}
                  active={i === activeStage}
                  onJump={goToStage}
                />
              );
            })}
          </div>

          {/* Top progress bar + stage rail */}
          <ScrollProgress
            stages={STAGES}
            activeStage={activeStage}
            onJump={goToStage}
            progressFillRef={progressFillRef}
          />

          {/* First-visit scroll hint */}
          <div
            className={`${styles.hint} ${hasScrolled ? styles.hintHidden : ""}`}
            aria-hidden="true"
          >
            <span className={styles.hintText}>Scroll to explore</span>
            <span className={styles.hintChevron}>▼</span>
          </div>

          {reducedMotion ? <div className={styles.reducedBadge}>Reduced-motion mode</div> : null}
        </div>
      </div>
    </div>
  );
}
