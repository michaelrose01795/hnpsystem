// file location: src/features/3Dwebsite/components/SalesSection.js
// Stage 2 bar — showroom & sales. Buyer context note + the sales cards.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SalesSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">🧑</span>
          <span>
            Buyer · <span className={styles.noteStrong}>{feature.buyer}</span> — {feature.stock}
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
