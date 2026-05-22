// file location: src/features/3Dwebsite/components/SectionOverlay.js
// Generic floating panel wrapper shared by every stage. Renders the stage
// heading block and slots in the section-specific body. Visibility + the
// card entrance animation are driven purely by the `active` flag (CSS).

import React from "react";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function SectionOverlay({ stage, active, children }) {
  return (
    <section
      className={`${styles.overlay} ${active ? styles.overlayActive : ""}`}
      aria-hidden={!active}
      aria-label={stage.title}
    >
      <div className={styles.overlayInner}>
        <span className={styles.badge}>{stage.badge}</span>
        <div className={styles.kicker}>{stage.kicker}</div>
        <h2 className={styles.heading}>{stage.title}</h2>
        <p className={styles.lede}>{stage.description}</p>
        {children}
      </div>
    </section>
  );
}
