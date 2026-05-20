// file location: src/features/roleTreeDemo/components/sections/OpeningSection.js
// Opening scene: title, subtitle, orbital department illustration, and a
// short narrative brief that frames the rest of the presentation.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { openingSignals, orbitDepartments } from "../../data/mockData";

export default function OpeningSection() {
  const total = orbitDepartments.length;

  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 01 &middot; Opening</span>
        <h1 className={styles.title}>Built From the Bottom of the Operation</h1>
        <p className={styles.subtitle}>
          A connected dealership system shaped by the work happening on the floor, then lifted up
          into the views owners, directors and managers need.
        </p>
      </header>

      <div className={styles.openingLayout}>
        <div className={styles.openingScene} aria-hidden="true">
          <div className={styles.openingRings}>
            <div className={`${styles.openingRing} ${styles["openingRing--outer"]}`} />
            <div className={`${styles.openingRing} ${styles["openingRing--inner"]}`} />
          </div>
          <div className={styles.openingSignalBeam} />
          <div className={`${styles.openingSignalBeam} ${styles.openingSignalBeamAlt}`} />

          <div className={styles.openingCore}>
            <span className={styles.openingCoreLabel}>HNP DMS</span>
          </div>

          {orbitDepartments.map((dept, index) => {
            const angle = (index / total) * 360;
            return (
              <div
                key={dept.id}
                className={styles.openingPlanet}
                style={{ "--angle": `${angle}deg`, "--radius": "min(168px, 24vw)" }}
              >
                {dept.label}
              </div>
            );
          })}
        </div>

        <LayerSurface className={styles.openingBrief} radius="var(--radius-lg)">
          <span className={styles.cardKicker}>The page story</span>
          <div className={styles.cardTitle}>One route from daily friction to business clarity.</div>
          <p className={styles.cardBody}>
            The demo now reads like a guided walk: start with the operational floor, climb through
            departments and roles, then finish with a realistic rollout.
          </p>
          <div className={styles.signalGrid}>
            {openingSignals.map((signal) => (
              <LayerTheme key={signal.id} className={styles.signalCard} padding="14px" gap="6px">
                <span className={styles.dashboardCardLabel}>{signal.title}</span>
                <span>{signal.line}</span>
              </LayerTheme>
            ))}
          </div>
        </LayerSurface>
      </div>
    </div>
  );
}
