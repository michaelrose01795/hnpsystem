// file location: src/features/3Dwebsite/components/PartsSection.js
// Stage 4 bar — parts department. Supplier context note + parts lifecycle.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function PartsSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">📦</span>
          <span>
            Supplier · <span className={styles.noteStrong}>{feature.supplier}</span> — order {feature.order}
          </span>
        </>
      }
    >
      <div className={styles.cardTrack}>
        {cards.map((card) => (
          <FloatingCard key={card.id} card={card} />
        ))}
      </div>
    </SectionOverlay>
  );
}
