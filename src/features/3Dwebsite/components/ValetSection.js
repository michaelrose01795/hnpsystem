// file location: src/features/3Dwebsite/components/ValetSection.js
// Stage 6 overlay — valet bay. Valeter context line + valeting cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function ValetSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={styles.featureNote}>
        <span className={styles.featureNoteIcon} aria-hidden="true">
          ✨
        </span>
        <span>
          Valeted by · <span className={styles.featureNoteStrong}>{feature.valeter}</span>
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
