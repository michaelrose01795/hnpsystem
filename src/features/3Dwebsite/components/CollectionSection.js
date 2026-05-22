// file location: src/features/3Dwebsite/components/CollectionSection.js
// Stage 7 overlay — collection & drive-away. Collection cards plus the final
// connected dashboard summarising every department in one record.

import React from "react";
import SectionOverlay from "./SectionOverlay";
import FloatingCard from "./FloatingCard";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function CollectionSection({ stage, active }) {
  const { feature, cards } = stage;
  return (
    <SectionOverlay stage={stage} active={active}>
      <div className={styles.cardArea}>
        {cards.map((card) => (
          <FloatingCard key={card.id} card={card} />
        ))}
      </div>

      <div className={styles.dashHead}>Connected workflow — one record</div>
      <div className={styles.dashGrid}>
        {feature.dashboard.map((item) => (
          <div key={item.id} className={styles.dashItem}>
            <span className={styles.dashDot} aria-hidden="true" />
            <span className={styles.dashText}>
              <span className={styles.dashLabel}>{item.label}</span>
              <span className={styles.dashValue}>{item.value}</span>
            </span>
          </div>
        ))}
      </div>
    </SectionOverlay>
  );
}
