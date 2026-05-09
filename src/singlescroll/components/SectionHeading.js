// file location: src/singlescroll/components/SectionHeading.js
// Reusable section heading: small eyebrow + large title + optional lead paragraph.

import styles from "../styles/singlescroll.module.css";

export default function SectionHeading({ eyebrow, title, lead, align = "left" }) {
  const className = `${styles.sectionHead} ${align === "center" ? styles.sectionHeadCenter : ""}`;
  return (
    <header className={className} data-reveal>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h2 className={styles.heading}>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
    </header>
  );
}
