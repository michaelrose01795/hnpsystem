// file location: src/singlescroll/components/Motability.js
// Motability scheme section — brand/model chips + price + CTA.

import LayerSurface from "@/components/ui/LayerSurface";
import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function Motability() {
  const { motability } = siteContent;

  return (
    <section id="motability" className={styles.section}>
      <SectionHeading
        eyebrow={motability.eyebrow}
        title={motability.title}
        lead={motability.body[0]}
      />

      <div className={styles.split} data-reveal>
        <div className={styles.splitBody}>
          {motability.body.slice(1).map((p, i) => <p key={i}>{p}</p>)}
          <p className={styles.motabilityPrice}>{motability.payments}</p>
          <a
            href={motability.cta.href}
            className={`${styles.btn} ${styles.btnPrimary}`}
            style={{ alignSelf: "flex-start" }}
          >
            {motability.cta.label}
          </a>
        </div>

        <div className={styles.motabilityBrands}>
          {motability.rangeBrands.map((brand) => (
            <LayerSurface key={brand.brand} className={styles.motabilityBrand} padding="0">
              <h3 className={styles.motabilityBrandName}>{brand.brand}</h3>
              <ul className={styles.motabilityModelList}>
                {brand.models.map((m) => (
                  <li key={m} className={styles.motabilityModelChip}>{m}</li>
                ))}
              </ul>
            </LayerSurface>
          ))}
        </div>
      </div>
    </section>
  );
}
