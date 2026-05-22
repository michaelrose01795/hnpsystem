// file location: src/features/3Dwebsite/components/SmartRepairSection.js
// Stage 5 bar — smart repair bay. Damage callout note + repair lifecycle cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SmartRepairSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      noteTone="alert"
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">⚠️</span>
          <span>
            Damage logged · <span className={styles.noteStrong}>{feature.damage}</span>
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
