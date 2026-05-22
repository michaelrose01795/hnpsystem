// file location: src/features/3Dwebsite/components/DealershipEntrySection.js
// Stage 1 overlay — reception. Two route choices (Book a Service / Buy a Car)
// that jump the scroll to the matching stage, plus the live booking card.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function DealershipEntrySection({ stage, active, onJump }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={styles.choices}>
        <p className={styles.choicePrompt}>{feature.prompt}</p>
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
            <span className={styles.choiceBody}>
              <span className={styles.choiceLabel}>{option.label}</span>
              <span className={styles.choiceNote}>{option.note}</span>
            </span>
            <span className={styles.choiceGo} aria-hidden="true">
              →
            </span>
          </button>
        ))}
      </div>

      <div className={styles.cardArea}>
        {cards.map((card) => (
          <FloatingCard key={card.id} card={card} />
        ))}
      </div>
    </SectionOverlay>
  );
}
