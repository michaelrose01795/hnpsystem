// file location: src/features/roleTreeDemo/components/sections/InteractiveDemoSection.js
// Interactive demo with animated camera-style movement from the top roles
// down to the apprentice technician. Includes controls and a step deep dive.

import React, { useCallback, useEffect, useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { demoPrinciples, demoSteps } from "../../data/mockData";
import useReducedMotionPreference from "../../hooks/useReducedMotionPreference";

const STEP_DURATION = 3200;
const LEVEL_WIDTH = 220 + 56;

export default function InteractiveDemoSection() {
  const reducedMotion = useReducedMotionPreference();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stepTo = useCallback((index) => {
    const safe = Math.max(0, Math.min(demoSteps.length - 1, index));
    setActiveIndex(safe);
    if (safe >= demoSteps.length - 1) {
      setFinished(true);
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) {
      clearTimer();
      return undefined;
    }
    timerRef.current = window.setTimeout(() => {
      if (activeIndex >= demoSteps.length - 1) {
        setPlaying(false);
        setFinished(true);
        return;
      }
      stepTo(activeIndex + 1);
    }, STEP_DURATION);
    return clearTimer;
  }, [playing, activeIndex, clearTimer, stepTo]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPlay = () => {
    if (finished) {
      setFinished(false);
      setActiveIndex(0);
    }
    setPlaying(true);
  };

  const onPause = () => setPlaying(false);

  const onReplay = () => {
    clearTimer();
    setActiveIndex(0);
    setFinished(false);
    setPlaying(true);
  };

  const onSkip = () => {
    clearTimer();
    setActiveIndex(demoSteps.length - 1);
    setFinished(true);
    setPlaying(false);
  };

  const offset = reducedMotion ? 0 : -(activeIndex * LEVEL_WIDTH);
  const activeStep = demoSteps[activeIndex];

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 06 &middot; Interactive demo</span>
        <h2 className={styles.title}>From the Top Down to the Bay</h2>
        <p className={styles.subtitle}>
          Press play. The camera moves from the top of the business down to the apprentice
          technician, with a short callout at every level.
        </p>
      </header>

      <div className={styles.demoStage}>
        <div className={styles.demoExperience}>
          <div className={styles.demoTrack} aria-live="polite">
            <div className={styles.demoDataStream} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div
              className={styles.demoCameraTrack}
              style={{ transform: `translate3d(${offset}px, 0, 0)` }}
            >
              {demoSteps.map((step, index) => (
                <LayerSurface
                  key={step.id}
                  className={`${styles.demoLevel} ${index === activeIndex ? styles.demoLevelActive : ""}`}
                  radius="var(--radius-md)"
                  padding="0 14px"
                  style={{ display: "grid", placeItems: "center" }}
                >
                  {step.level}
                </LayerSurface>
              ))}
            </div>
          </div>

          <LayerSurface
            className={styles.demoCallout}
            radius="var(--radius-md)"
            padding="16px 22px"
            style={{ display: "grid", placeItems: "center" }}
          >
            {activeStep.callout}
          </LayerSurface>
        </div>

        <LayerSurface className={styles.demoInsight} radius="var(--radius-lg)">
          <div className={styles.detailHeader}>
            <div>
              <span className={styles.cardKicker}>Current level</span>
              <div className={styles.cardTitle}>{activeStep.level}</div>
            </div>
            <span className={styles.detailPill}>{activeIndex + 1} of {demoSteps.length}</span>
          </div>
          <p className={styles.cardBody}>{activeStep.callout}</p>
          <div className={styles.principleList}>
            {demoPrinciples.map((principle, index) => (
              <LayerTheme key={principle} padding="12px" gap="4px">
                <span className={styles.dashboardCardLabel}>Principle {index + 1}</span>
                <span>{principle}</span>
              </LayerTheme>
            ))}
          </div>
        </LayerSurface>

        <div className={styles.demoStepRail} role="tablist" aria-label="Choose a role-tree level">
          {demoSteps.map((step, index) => (
            <button
              key={step.id}
              type="button"
              className={`${styles.demoStepButton} ${index === activeIndex ? styles.demoStepButtonActive : ""}`}
              onClick={() => {
                setPlaying(false);
                stepTo(index);
              }}
              role="tab"
              aria-selected={index === activeIndex}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step.level}</strong>
            </button>
          ))}
        </div>

        {finished ? (
          <div className={styles.demoFinal}>
            If these problems are visible from the apprentice level, they affect the whole business.
          </div>
        ) : null}

        <div className={styles.demoControls} role="group" aria-label="Demo controls">
          {playing ? (
            <button type="button" className="app-btn app-btn--secondary" onClick={onPause}>
              Pause
            </button>
          ) : (
            <button type="button" className="app-btn app-btn--primary" onClick={onPlay}>
              {finished ? "Replay" : "Play demo"}
            </button>
          )}
          <button type="button" className="app-btn app-btn--secondary" onClick={onReplay}>
            Restart
          </button>
          <button type="button" className="app-btn app-btn--secondary" onClick={onSkip}>
            Skip to end
          </button>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={() => stepTo(activeIndex - 1)}
            disabled={activeIndex === 0}
          >
            Previous level
          </button>
          <button
            type="button"
            className="app-btn app-btn--secondary"
            onClick={() => stepTo(activeIndex + 1)}
            disabled={activeIndex >= demoSteps.length - 1}
          >
            Next level
          </button>
        </div>
      </div>
    </div>
  );
}
