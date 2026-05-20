// file location: src/features/roleTreeDemo/components/sections/ConnectedDmsSection.js
// Connected DMS hub with the system at the centre, feature cards either side,
// and outcome cards that describe what the connection improves.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { connectedFeatures, connectedOutcomes } from "../../data/mockData";

export default function ConnectedDmsSection() {
  const mid = Math.ceil(connectedFeatures.length / 2);
  const left = connectedFeatures.slice(0, mid);
  const right = connectedFeatures.slice(mid);

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 07 &middot; The connected DMS</span>
        <h2 className={styles.title}>One Hub. Every Department.</h2>
        <p className={styles.subtitle}>
          The DMS sits at the centre, connecting every department and every role into one workflow
          that can be trusted from the workshop floor to the morning meeting.
        </p>
      </header>

      <div className={styles.hubScene}>
        <div className={styles.hubColumn}>
          {left.map((feature) => (
            <LayerSurface key={feature.id} className={styles.hubFeature} radius="var(--radius-md)" padding="14px 16px" gap="4px">
              <span className={styles.hubFeatureTitle}>{feature.title}</span>
              <span className={styles.hubFeatureLine}>{feature.line}</span>
            </LayerSurface>
          ))}
        </div>

        <LayerSurface className={styles.hubCore} radius="var(--radius-lg)" padding="28px 24px">
          <div className={styles.hubOrbitScene} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className={styles.hubCoreLabel}>The hub</span>
          <div className={styles.hubCoreTitle}>HNP DMS</div>
          <p className={styles.hubCoreLine}>
            One connected workflow. Built around the way H&amp;P already works, not the other way
            around.
          </p>
        </LayerSurface>

        <div className={styles.hubColumn}>
          {right.map((feature) => (
            <LayerSurface key={feature.id} className={styles.hubFeature} radius="var(--radius-md)" padding="14px 16px" gap="4px">
              <span className={styles.hubFeatureTitle}>{feature.title}</span>
              <span className={styles.hubFeatureLine}>{feature.line}</span>
            </LayerSurface>
          ))}
        </div>
      </div>

      <LayerSurface className={styles.outcomePanel} radius="var(--radius-lg)">
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.cardKicker}>What improves</span>
            <div className={styles.cardTitle}>The system gives the day a shared memory.</div>
          </div>
          <span className={styles.detailPill}>Connected DMS</span>
        </div>
        <div className={styles.outcomeGrid}>
          {connectedOutcomes.map((outcome) => (
            <LayerTheme key={outcome.id} padding="14px" gap="4px">
              <span className={styles.dashboardCardLabel}>{outcome.title}</span>
              <span>{outcome.line}</span>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </div>
  );
}
