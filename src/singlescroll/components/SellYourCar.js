// file location: src/singlescroll/components/SellYourCar.js
// 3-step "Sell Your Car" section + benefit list + CTA.

import LayerSurface from "@/components/ui/LayerSurface";
import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
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
    <section id="sell" className={styles.section}>
      <SectionHeading
        eyebrow={sellYourCar.eyebrow}
        title={sellYourCar.title}
        lead="We buy any car, any age, any mileage — with free home collection and instant payment."
      />

      <div className={styles.steps}>
        {sellYourCar.steps.map((step) => (
          <LayerSurface key={step.n} className={styles.step} padding="0">
            <span className={styles.stepNumber}>{step.n}</span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </LayerSurface>
        ))}
      </div>

      <ul className={styles.benefitsList} data-reveal>
        {sellYourCar.benefits.map((b) => (
          <li key={b} className={styles.benefit}>
            <span className={styles.benefitDot} />
            {b}
          </li>
        ))}
      </ul>

      <div data-reveal style={{ marginTop: 28 }}>
        <a
          href={sellYourCar.cta.href}
          onClick={handleCta}
          className={`${styles.btn} ${styles.btnPrimary}`}
        >
          {sellYourCar.cta.label}
        </a>
      </div>
    </section>
  );
}
