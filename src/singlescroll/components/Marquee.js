// file location: src/singlescroll/components/Marquee.js
// Continuous horizontal ticker — plays between sections to give the page
// the same constant-motion rhythm as the Razorpay Sprint banner. Pure CSS
// keyframe animation, no JS — never blocks scroll.
//
// We render the items twice so the animation can loop seamlessly with a
// single -50% translateX (no perceived jump at the wrap point).

import styles from "../styles/singlescroll.module.css";

export default function Marquee({ items, separator = "/", reverse = false, speed = 28 }) {
  const repeated = [...items, ...items];

  return (
    <div className={styles.marquee} aria-hidden="true">
      <div
        className={`${styles.marqueeTrack} ${reverse ? styles.marqueeTrackReverse : ""}`}
        style={{ animationDuration: `${speed}s` }}
      >
        {repeated.map((item, i) => (
          <span key={i} className={styles.marqueeItem}>
            <span>{item}</span>
            <span className={styles.marqueeSep} aria-hidden="true">{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
