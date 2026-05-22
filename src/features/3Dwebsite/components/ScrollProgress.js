// file location: src/features/3Dwebsite/components/ScrollProgress.js
// Two pieces of scroll navigation:
//   • a thin top progress bar (the fill is scaled imperatively by the page's
//     scroll handler via the forwarded ref — no re-render per frame)
//   • a side rail of stage dots that jump straight to any stage

import React from "react";
import styles from "@/features/3Dwebsite/styles/threeDWebsite.module.css";

export default function ScrollProgress({ stages, activeStage, onJump, progressFillRef }) {
  return (
    <>
      <div className={styles.progress} aria-hidden="true">
        <div ref={progressFillRef} className={styles.progressFill} />
      </div>

      <nav className={styles.rail} aria-label="Dealership workflow stages">
        {stages.map((stage, i) => (
          <button
            key={stage.id}
            type="button"
            className={`${styles.railBtn} ${i === activeStage ? styles.railBtnActive : ""}`}
            aria-current={i === activeStage ? "step" : undefined}
            onClick={() => onJump(i)}
          >
            <span className={styles.railDot} aria-hidden="true" />
            <span className={styles.railLabel}>{stage.kicker}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
