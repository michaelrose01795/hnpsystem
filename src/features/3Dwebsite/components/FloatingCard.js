// file location: src/features/3Dwebsite/components/FloatingCard.js
// A single floating DMS card (plain HTML/CSS overlay — not rendered in 3D).
// Shape comes straight from the mock data: icon, title, subtitle, key/value
// rows and a status pill. The left accent strip colour follows the status.

import React from "react";
import { PALETTE } from "@/features/3Dwebsite/data/threeDWebsiteMockData";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

const TONE_CLASS = {
  done: styles.toneDone,
  active: styles.toneActive,
  queued: styles.toneQueued,
  alert: styles.toneAlert,
};

const TONE_ACCENT = {
  done: PALETTE.black,
  active: PALETTE.red,
  queued: PALETTE.mute,
  alert: PALETTE.redBright,
};

export default function FloatingCard({ card }) {
  const { icon, title, subtitle, rows = [], status } = card;
  const accent = TONE_ACCENT[status?.tone] || PALETTE.red;

  return (
    <article className={styles.card} style={{ "--card-accent": accent }}>
      <div className={styles.cardHead}>
        <span className={styles.cardIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.cardHeadText}>
          <h3 className={styles.cardTitle}>{title}</h3>
          {subtitle ? <p className={styles.cardSub}>{subtitle}</p> : null}
        </div>
      </div>

      {rows.length > 0 ? (
        <div className={styles.cardRows}>
          {rows.map((row) => (
            <div key={row.label} className={styles.cardRow}>
              <span className={styles.cardRowLabel}>{row.label}</span>
              <span className={styles.cardRowValue}>{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}

      {status ? (
        <span className={`${styles.pill} ${TONE_CLASS[status.tone] || styles.toneQueued}`}>
          <span className={styles.pillDot} aria-hidden="true" />
          {status.label}
        </span>
      ) : null}
    </article>
  );
}
