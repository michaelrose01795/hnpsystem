// file location: src/singlescroll/components/SceneShell.js
// Master section shell for every chapter of the single-scroll site.
//
// It generalises the layout language of the "Why families across Kent keep
// coming back" diorama so every section reads as part of the same story:
//
//   - A huge ghost word/numeral painted faintly across the backdrop.
//   - A centered (or left-aligned) numbered head — eyebrow + display title
//     + lead — same cadence as the Storyteller diorama.
//   - A perspective stage that lets nested cards / panels project depth.
//   - Two tones — `surface` (premium dark card background, default) and
//     `scene` (translucent so the persistent 3D canvas shows through).
//
// Sections plug in their own grid / split / panel layouts as `children`.
// Card3D continues to provide hover tilt on individual cards, so we don't
// need scene-wide pointer rotation (that effect lives on the Storyteller
// diorama as a deliberate one-off).

import { useMemo } from "react";
import styles from "../styles/singlescroll.module.css";

export default function SceneShell({
  id,
  number,
  eyebrow,
  title,
  lead,
  backdrop,
  align = "center",
  tone = "surface",
  children,
  ariaLabel,
  innerClassName,
}) {
  const sectionClass = useMemo(
    () =>
      [styles.scene, tone === "scene" ? styles.sceneTransparent : styles.sceneSurface]
        .filter(Boolean)
        .join(" "),
    [tone],
  );

  const headClass = useMemo(
    () =>
      [styles.sceneHead, align === "center" ? styles.sceneHeadCenter : styles.sceneHeadLeft]
        .filter(Boolean)
        .join(" "),
    [align],
  );

  return (
    <section id={id} className={sectionClass} aria-label={ariaLabel || title}>
      {backdrop ? (
        <div className={styles.sceneBackdrop} aria-hidden="true" data-parallax="-22">
          <span>{backdrop}</span>
        </div>
      ) : null}

      <div className={styles.sceneInner}>
        <header className={headClass} data-reveal>
          <div className={styles.sceneHeadRow}>
            {number ? <span className={styles.sceneNumber}>{number} /</span> : null}
            {eyebrow ? <span className={styles.sceneEyebrow}>{eyebrow}</span> : null}
          </div>
          <h2 className={styles.sceneTitle}>{title}</h2>
          {lead ? <p className={styles.sceneLead}>{lead}</p> : null}
        </header>

        <div className={[styles.sceneStage, innerClassName].filter(Boolean).join(" ")}>
          {children}
        </div>
      </div>
    </section>
  );
}
