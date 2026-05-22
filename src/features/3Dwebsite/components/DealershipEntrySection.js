// file location: src/features/3Dwebsite/components/DealershipEntrySection.js
// Stage 1 bar — reception. Two route choices (Book a Service / Buy a Car) that
// jump the scroll to the matching stage, alongside the live booking card.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function DealershipEntrySection({ stage, active, onJump }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay
      stage={stage}
      active={active}
      note={
        <>
          <span className={styles.noteIcon} aria-hidden="true">🚪</span>
          <span>{feature.prompt}</span>
        </>
      }
    >
      <div className={styles.cardTrack}>
        {feature.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.choice}
            onClick={() => onJump?.(option.target)}
          >
            <span className={styles.choiceIcon} aria-hidden="true">
              {option.icon}
            </span>
            <span className={styles.choiceLabel}>{option.label}</span>
            <span className={styles.choiceNote}>{option.note}</span>
            <span className={styles.choiceGo}>
              Jump to stage <span aria-hidden="true">→</span>
            </span>
          </button>
        ))}
        {cards.map((card) => (
          <FloatingCard key={card.id} card={card} />
        ))}
      </div>
    </SectionOverlay>
  );
}
