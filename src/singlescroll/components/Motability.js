// file location: src/singlescroll/components/Motability.js
// Motability chapter — copy + price + CTA on one side, brand/model
// scene panels on the other. Wrapped in the unified SceneShell so the
// chapter shares the master diorama language with every other section.

import Card3D from "./Card3D";
import { siteContent } from "../data/siteContent";
import SceneShell from "./SceneShell";
import styles from "../styles/singlescroll.module.css";

export default function Motability() {
  const { motability } = siteContent;

  return (
    <SceneShell
      id="motability"
      number="05"
      eyebrow={motability.eyebrow}
      title={motability.title}
      lead={motability.body[0]}
      backdrop="All Abilities"
      tone="scene"
      ariaLabel="Motability"
    >
      <div className={styles.sceneSplit} data-reveal>
        <div className={styles.sceneSplitBody}>
          {motability.body.slice(1).map((p, i) => <p key={i}>{p}</p>)}

          <p className={styles.scenePanelMonogram} style={{ fontSize: "clamp(34px, 4vw, 48px)" }}>
            {motability.payments}
          </p>

          <div className={styles.sceneCtaRow}>
            <a
              href={motability.cta.href}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              <span>{motability.cta.label}</span>
              <span className={styles.btnChevron} aria-hidden="true">→</span>
            </a>
          </div>

          <ul className={styles.sceneFeatureList} style={{ marginTop: 8 }}>
            {[
              "5 dedicated Motability specialists on staff",
              "Adaptations & maintenance handled in-house",
              "EV-approved retailer — including the new e-Vitara",
              "Free delivery within Kent",
            ].map((b) => (
              <li key={b} className={styles.sceneFeature}>
                <span className={styles.sceneFeatureDot} aria-hidden="true" />
                {b}
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.sceneGridTwo}>
          {motability.rangeBrands.map((brand) => (
            <div key={brand.brand} data-reveal>
              <Card3D intensity={0.6}>
                <article className={styles.scenePanel}>
                  <span className={styles.scenePanelEyebrow}>{brand.brand}</span>
                  <h3 className={styles.scenePanelTitle}>Available models</h3>
                  <ul className={styles.motabilityModelList}>
                    {brand.models.map((m) => (
                      <li key={m} className={styles.motabilityModelChip}>{m}</li>
                    ))}
                  </ul>
                </article>
              </Card3D>
            </div>
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
