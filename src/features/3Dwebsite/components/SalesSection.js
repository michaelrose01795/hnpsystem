// file location: src/features/3Dwebsite/components/SalesSection.js
// Stage 2 overlay — showroom & sales. Buyer context line + the sales cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SalesSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={styles.featureNote}>
        <span className={styles.featureNoteIcon} aria-hidden="true">
          🧑
        </span>
        <span>
          Buyer · <span className={styles.featureNoteStrong}>{feature.buyer}</span> — {feature.stock}
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
