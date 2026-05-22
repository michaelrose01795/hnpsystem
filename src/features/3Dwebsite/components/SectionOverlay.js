// file location: src/features/3Dwebsite/components/SectionOverlay.js
// Generic full-width "Stage" bar shared by every stage. It docks to the top of
// the page: a header row (title block + lede/note) above a horizontal card
// row. Visibility + the card entrance animation are driven by `active` (CSS).

import React from "react";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SectionOverlay({ stage, active, note, noteTone, children }) {
  return (
    <section
      className={`${styles.overlay} ${active ? styles.overlayActive : ""}`}
      aria-hidden={!active}
      aria-label={stage.title}
    >
      <div className={styles.overlayInner}>
        <div className={styles.overlayHead}>
          <div className={styles.overlayHeadMain}>
            <div className={styles.eyebrow}>
              <span className={styles.badge}>{stage.badge}</span>
              <span className={styles.kicker}>{stage.kicker}</span>
            </div>
            <h2 className={styles.heading}>{stage.title}</h2>
          </div>
          <div className={styles.overlayHeadAside}>
            <p className={styles.lede}>{stage.description}</p>
            {note ? (
              <div className={`${styles.note} ${noteTone === "alert" ? styles.noteAlert : ""}`}>
                {note}
              </div>
            ) : null}
          </div>
        </div>
        <div className={styles.overlayBody}>{children}</div>
      </div>
    </section>
  );
}
