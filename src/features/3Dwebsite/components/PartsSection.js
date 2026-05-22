// file location: src/features/3Dwebsite/components/PartsSection.js
// Stage 4 overlay — parts department. Supplier context line + parts lifecycle.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function PartsSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={styles.featureNote}>
        <span className={styles.featureNoteIcon} aria-hidden="true">
          📦
        </span>
        <span>
          Supplier · <span className={styles.featureNoteStrong}>{feature.supplier}</span> — order {feature.order}
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
