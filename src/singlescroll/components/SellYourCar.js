// file location: src/singlescroll/components/SellYourCar.js
// "Sell Your Car" chapter — three numbered scene panels (the diorama
// pillar treatment) plus a benefit list and a primary CTA into the
// contact form. Wrapped in the shared SceneShell so it shares the
// master scene language with every other chapter.

import Card3D from "./Card3D";
import { siteContent } from "../data/siteContent";
import SceneShell from "./SceneShell";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function SellYourCar() {
  const scrollTo = useSmoothScrollTo();
  const { sellYourCar } = siteContent;

  const handleCta = (e) => {
    e.preventDefault();
    scrollTo(sellYourCar.cta.href.replace("#", ""));
  };

  return (
    <SceneShell
      id="sell"
      number="03"
      eyebrow={sellYourCar.eyebrow}
      title={sellYourCar.title}
      lead="We buy any car — any age, any mileage, any make — with free home collection and instant payment."
      backdrop="Sell"
      tone="surface"
      ariaLabel="Sell your car"
    >
      <div className={styles.sceneGridThree}>
        {sellYourCar.steps.map((step) => (
          <div key={step.n} data-reveal>
            <Card3D intensity={0.6}>
              <article className={styles.scenePanel}>
                <span className={styles.scenePanelMonogram}>{step.n}</span>
                <h3 className={styles.scenePanelTitle}>{step.title}</h3>
                <p className={styles.scenePanelBody}>{step.body}</p>
              </article>
            </Card3D>
          </div>
        ))}
      </div>

      <ul className={styles.sceneFeatureList} data-reveal style={{ marginTop: 36 }}>
        {sellYourCar.benefits.map((b) => (
          <li key={b} className={styles.sceneFeature}>
            <span className={styles.sceneFeatureDot} aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>

      <div className={styles.sceneCtaRow} data-reveal style={{ marginTop: 32, justifyContent: "center" }}>
        <a
          href={sellYourCar.cta.href}
          onClick={handleCta}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          <span>{sellYourCar.cta.label}</span>
        </a>
      </div>
    </SceneShell>
  );
}
