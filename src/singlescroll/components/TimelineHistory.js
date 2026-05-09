// file location: src/singlescroll/components/TimelineHistory.js
// Replaces the simple AboutUs section. Renders the H&P story as a scroll-
// driven 3D timeline — vertical spine with milestone cards alternating
// left/right, each with its own scroll-revealed depth. Designed to act as
// a "scene section" — the persistent 3D canvas shows through the centre
// (subtle dark gradient), giving the timeline a museum-installation feel.

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { timeline } from "../data/timeline";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function TimelineHistory() {
  return (
    <section id="about" className={`${styles.section} ${styles.timelineSection}`} aria-label="Our story">
      <SectionHeading
        number="07"
        eyebrow="Our Story"
        title="From a blacksmith's shop in 1947 to three generations later"
        lead="Charles Humphries and Arthur Parks bought a village blacksmith's shop after the war. Three quarters of a century, four franchises, and three generations later — same family, same idea: take care of the customer."
        align="center"
      />

      <ol className={styles.timeline}>
        <span className={styles.timelineSpine} aria-hidden="true" />

        {timeline.map((entry, i) => (
          <li
            key={entry.year}
            className={`${styles.timelineItem} ${i % 2 === 0 ? styles.timelineLeft : styles.timelineRight}`}
            data-reveal
          >
            <span className={styles.timelineDot} aria-hidden="true" />
            <Card3D intensity={0.6} className={styles.timelineCardWrap}>
              <LayerSurface className={styles.timelineCard} padding="22px">
                <span className={styles.timelineYear}>{entry.year}</span>
                <h3 className={styles.timelineCardTitle}>{entry.title}</h3>
                <p className={styles.timelineCardBody}>{entry.body}</p>
              </LayerSurface>
            </Card3D>
          </li>
        ))}
      </ol>
    </section>
  );
}
