// file location: src/features/3Dwebsite/components/WorkshopSection.js
// Stage 3 bar — workshop & diagnostics. Ramp context note + workshop cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function WorkshopSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">🔧</span>
          <span>
            Vehicle live on <span className={styles.noteStrong}>{feature.ramp}</span> — Ford Focus · HP21 XKR
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
