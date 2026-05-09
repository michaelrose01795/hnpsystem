// file location: src/singlescroll/components/SectionHeading.js
// Razorpay Sprint-style numbered section heading.
//
//   - `number` prop renders a "01 /" prefix in monospace before the eyebrow,
//     borrowing the Sprint cadence of "01/Agentic Stack", "02/...".
//   - When `sticky` is true the whole heading uses `position: sticky` so it
//     pins under the nav while the section's content scrolls past it.
//   - `align="center"` centres the lockup for hero-feeling sections.

import styles from "../styles/singlescroll.module.css";

export default function SectionHeading({
  number,
  eyebrow,
  title,
  lead,
  align = "left",
  sticky = false,
}) {
  const className = [
    styles.sectionHead,
    align === "center" ? styles.sectionHeadCenter : "",
    sticky ? styles.sectionHeadSticky : "",
  ].filter(Boolean).join(" ");

  return (
    <header className={className} data-reveal>
      <div className={styles.sectionHeadTopRow}>
        {number && <span className={styles.sectionNumber}>{number} /</span>}
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      </div>
      <h2 className={styles.heading}>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  );
}
