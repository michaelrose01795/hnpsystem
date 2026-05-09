// file location: src/singlescroll/components/AboutUs.js
// About section — split layout (image + ethos copy + ratings).

import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function AboutUs() {
  const { about, ratings } = siteContent;

  return (
    <section id="about" className={`${styles.section} ${styles.sectionTinted}`}>
      <SectionHeading eyebrow={about.eyebrow} title={about.title} />

      <div className={styles.split} data-reveal data-reverse="true">
        <div className={styles.splitMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={about.imageUrl}
            alt="The Humphries & Parks team"
            className={styles.splitMediaImg}
            loading="lazy"
          />
        </div>
        <div className={styles.splitBody}>
          {about.body.map((p, i) => <p key={i}>{p}</p>)}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 6 }}>
            {ratings.map((r) => (
              <div key={r.source} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accentText)", letterSpacing: "-0.01em" }}>
                  {r.score}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7 }}>
                  {r.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
