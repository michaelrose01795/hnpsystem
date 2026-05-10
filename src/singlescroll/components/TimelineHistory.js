// file location: src/singlescroll/components/TimelineHistory.js
// Continuation of the About chapter — the H&P story told as a vertical
// 3D timeline with milestone cards alternating across the spine. Acts
// as a "scene section" so the persistent 3D canvas reads through.
//
// Renders without a section id — the About Us nav anchors at the
// Storyteller diorama above; this continues the same chapter.

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { timeline } from "../data/timeline";
import styles from "../styles/singlescroll.module.css";

export default function TimelineHistory() {
  return (
    <section className={`${styles.section} ${styles.timelineSection}`} aria-label="Our story">
      <header className={styles.subSceneHead} data-reveal>
        <span className={styles.subSceneEyebrow}>Our Story</span>
        <h3 className={styles.subSceneTitle}>From a blacksmith&rsquo;s shop in 1947 to three generations later</h3>
        <p className={styles.subSceneLead}>
          Charles Humphries and Arthur Parks bought a village blacksmith&rsquo;s shop after the war. Three quarters of a century, four franchises and three generations later — same family, same idea.
        </p>
      </header>

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
                <h4 className={styles.timelineCardTitle}>{entry.title}</h4>
                <p className={styles.timelineCardBody}>{entry.body}</p>
              </LayerSurface>
            </Card3D>
          </li>
        ))}
      </ol>
    </section>
  );
}
