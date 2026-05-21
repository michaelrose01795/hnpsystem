// file location: src/features/roleTreeDemo/components/RoleTreeDemo.js
// Full-screen shell for the /vision/role-tree-demo presentation. Owns section
// state, sticky chrome (kicker + heading + progress dots + Back / Next / Exit) and
// keyboard navigation. Bypasses the persistent app <Layout>, so there is no
// sidebar, no topbar and no auth chrome. Mock data only.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import styles from "../styles/roleTreeDemo.module.css";
import { presentationSections } from "../data/mockData";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference";

import OpeningSection from "./sections/OpeningSection";
import TopRolesSection from "./sections/TopRolesSection";
import DepartmentsSection from "./sections/DepartmentsSection";
import ProblemsSection from "./sections/ProblemsSection";
import TechniciansSection from "./sections/TechniciansSection";
import InteractiveDemoSection from "./sections/InteractiveDemoSection";
import ConnectedDmsSection from "./sections/ConnectedDmsSection";
import RolloutSection from "./sections/RolloutSection";
import FinalSection from "./sections/FinalSection";

const SECTION_COMPONENTS = {
  opening: OpeningSection,
  "top-roles": TopRolesSection,
  departments: DepartmentsSection,
  problems: ProblemsSection,
  technicians: TechniciansSection,
  "interactive-demo": InteractiveDemoSection,
  "connected-dms": ConnectedDmsSection,
  rollout: RolloutSection,
  final: FinalSection,
};

export default function RoleTreeDemo() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const systemReducedMotion = useReducedMotionPreference();
  const reducedMotion = systemReducedMotion;

  const activeSection = presentationSections[activeIndex];

  const goPrev = useCallback(() => {
    setActiveIndex((index) => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((index) => Math.min(presentationSections.length - 1, index + 1));
  }, []);

  const goTo = useCallback((index) => {
    setActiveIndex(Math.max(0, Math.min(presentationSections.length - 1, index)));
  }, []);

  const onExit = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/login");
  }, [router]);

  useEffect(() => {
    const handler = (event) => {
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNext();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goTo(presentationSections.length - 1);
      } else if (event.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, goTo, onExit]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const dots = useMemo(
    () =>
      presentationSections.map((section, index) => {
        let className = styles.progressDot;
        if (index === activeIndex) className += ` ${styles.progressDotActive}`;
        else if (index < activeIndex) className += ` ${styles.progressDotDone}`;
        return { ...section, index, className };
      }),
    [activeIndex]
  );

  const Component = SECTION_COMPONENTS[activeSection.id] || OpeningSection;
  const stageRef = React.useRef(null);

  useEffect(() => {
    if (!stageRef.current) return;
    stageRef.current.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [activeIndex, reducedMotion]);

  return (
    <div
      className={`${styles.shell} ${reducedMotion ? styles.reducedMotion : ""}`}
      data-presentation="role-tree-demo"
      role="region"
      aria-label="Role tree presentation"
    >
      <LayerSurface
        as="header"
        className={styles.chrome}
        radius="0"
        padding="14px clamp(16px, 3vw, 32px)"
        gap="16px"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          alignItems: "center",
        }}
      >
        <div className={styles.chromeTitle}>
          <span className={styles.chromeKicker}>HNP Vision &middot; Presentation</span>
          <span className={styles.chromeHeading}>Role Tree &amp; Connected DMS</span>
        </div>

        <div className={styles.chromeProgress} role="tablist" aria-label="Presentation sections">
          {dots.map((dot) => (
            <button
              key={dot.id}
              type="button"
              className={dot.className}
              onClick={() => goTo(dot.index)}
              aria-label={`Go to ${dot.label}`}
              aria-current={dot.index === activeIndex ? "step" : undefined}
              role="tab"
            >
              <span className={styles.progressDotChapter}>{dot.chapter}</span>
              <span className={styles.progressDotLabel}>{dot.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.chromeControls}>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={goPrev}
            disabled={activeIndex === 0}
          >
            Back
          </button>
          <button
            type="button"
            className="app-btn app-btn--primary"
            onClick={goNext}
            disabled={activeIndex >= presentationSections.length - 1}
          >
            Next
          </button>
          <button
            type="button"
            className="app-btn app-btn--ghost"
            onClick={onExit}
            aria-label="Exit presentation"
          >
            Exit
          </button>
        </div>
      </LayerSurface>

      <main className={styles.stage} ref={stageRef}>
        {presentationSections.map((section, index) => (
          <section
            key={section.id}
            id={`role-tree-demo-${section.id}`}
            className={`${styles.section} ${index === activeIndex ? styles.sectionActive : ""}`}
            aria-hidden={index !== activeIndex}
          >
            {index === activeIndex ? <Component /> : null}
          </section>
        ))}
      </main>

    </div>
  );
}
