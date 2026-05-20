// file location: src/features/roleTreeDemo/components/sections/FinalSection.js
// Closing message for the presentation, with concise proof points that connect
// the final claim back to the earlier sections.

import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import styles from "../../styles/roleTreeDemo.module.css";
import { closingMessage, closingProofPoints } from "../../data/mockData";

export default function FinalSection() {
  return (
    <div className={styles.sectionFlow}>
      <header className={styles.heading}>
        <span className={styles.chapter}>Chapter 09 &middot; Closing</span>
        <h2 className={styles.title}>Built From Inside H&amp;P</h2>
      </header>

      <LayerSurface className={styles.finalScene} radius="var(--radius-xl)">
        <div className={styles.finalConstellation} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.finalHeadline}>{closingMessage.headline}</div>
        <p className={styles.finalSupporting}>{closingMessage.supporting}</p>
        <div className={styles.finalProofGrid}>
          {closingProofPoints.map((point) => (
            <LayerTheme key={point.id} padding="14px" gap="4px">
              <span className={styles.dashboardCardLabel}>{point.title}</span>
              <span>{point.line}</span>
            </LayerTheme>
          ))}
        </div>
      </LayerSurface>
    </div>
  );
}
