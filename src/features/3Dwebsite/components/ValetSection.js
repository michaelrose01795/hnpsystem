// file location: src/features/3Dwebsite/components/ValetSection.js
// Stage 6 bar — valet bay. Valeter context note + valeting cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function ValetSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">✨</span>
          <span>
            Valeted by · <span className={styles.noteStrong}>{feature.valeter}</span>
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
