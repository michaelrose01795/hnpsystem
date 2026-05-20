// file location: src/features/roleTreeDemo/components/sections/RolloutSection.js
// Phased rollout shown as five phase cards plus a safeguard panel. The tone is
// deliberately safe, realistic and low-risk.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { rolloutPhases, rolloutSafeguards } from "../../data/mockData";

export default function RolloutSection() {
  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 08 &middot; Phased rollout</span>
        <h2 className={styles.title}>A Safe Path In</h2>
        <p className={styles.subtitle}>
          Nothing is forced and nothing is rushed. The DMS earns its place one workflow at a time,
          with staff feedback shaping each step.
        </p>
      </header>

      <div className={styles.rolloutLivePath} aria-hidden="true">
        {rolloutPhases.map((phase, index) => (
          <span key={phase.id} style={{ "--step": index }} />
        ))}
      </div>

      <div className={styles.rolloutScene}>
        {rolloutPhases.map((phase) => (
          <LayerSurface
            as="article"
            key={phase.id}
            className={styles.phaseCard}
            radius="var(--radius-md)"
            padding="18px"
            gap="6px"
          >
            <span className={styles.phaseLabel}>{phase.label}</span>
            <span className={styles.phaseTitle}>{phase.title}</span>
            <span className={styles.phaseLine}>{phase.line}</span>
          </LayerSurface>
        ))}
      </div>

      <LayerSurface className={styles.rolloutAssurance} radius="var(--radius-lg)">
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.cardKicker}>Rollout discipline</span>
            <div className={styles.cardTitle}>Make adoption feel controlled, not disruptive.</div>
          </div>
          <span className={styles.detailPill}>Low-risk expansion</span>
        </div>
        <div className={styles.outcomeGrid}>
          {rolloutSafeguards.map((item) => (
            <LayerTheme key={item.id} padding="14px" gap="4px">
              <span className={styles.dashboardCardLabel}>{item.title}</span>
              <span>{item.line}</span>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </div>
  );
}
