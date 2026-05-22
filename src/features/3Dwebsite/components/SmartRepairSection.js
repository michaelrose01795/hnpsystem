// file location: src/features/3Dwebsite/components/SmartRepairSection.js
// Stage 5 overlay — smart repair bay. Damage callout + repair lifecycle cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SmartRepairSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={`${styles.featureNote} ${styles.featureNoteAlert}`}>
        <span className={styles.featureNoteIcon} aria-hidden="true">
          ⚠️
        </span>
        <span>
          Damage logged · <span className={styles.featureNoteStrong}>{feature.damage}</span>
        </span>
      </div>

      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <FloatingCard key={card.id} card={card} />
        ))}
      </div>
    </SectionOverlay>
  );
}
