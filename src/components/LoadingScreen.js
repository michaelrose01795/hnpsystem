import React from "react";
import styles from "./LoadingScreen.module.css";

/**
 * Lightweight transparent overlay with a simple loader indicator.
 * CSS handles the animations; React toggles it on/off via isFadingOut flag.
 */
export default function LoadingScreen({ isFadingOut = false }) {
  return (
    <div
      className={`${styles.loadingContainer} ${
        isFadingOut ? styles.fadeOut : ""
      }`}
    >
      <div className={styles.loader}>
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </div>
      <p className={styles.text}>Loading, please wait...</p>
    </div>
  );
}
