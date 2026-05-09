// file location: src/singlescroll/components/TrustBar.js
// Trust strip directly under the hero — years in business, ratings, EV approved, etc.

import { siteContent } from "../data/siteContent";
import styles from "../styles/singlescroll.module.css";

export default function TrustBar() {
  return (
    <div className={styles.trustBar} data-reveal>
      <div className={styles.trustGrid}>
        {siteContent.trustPoints.map((point) => (
          <div key={point.label} className={styles.trustItem}>
            <span className={styles.trustValue}>{point.value}</span>
            <span className={styles.trustLabel}>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
