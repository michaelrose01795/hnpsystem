// file location: src/singlescroll/components/PartsAndAccessories.js
// Genuine parts + accessories section. Three brand cards + CTA.

import LayerSurface from "@/components/ui/LayerSurface";
import Card3D from "./Card3D";
import { partsContent } from "../data/partsContent";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function PartsAndAccessories() {
  return (
    <section id="parts" className={styles.section} aria-label="Parts & Accessories">
      <SectionHeading
        number="05"
        eyebrow={partsContent.eyebrow}
        title={partsContent.title}
        lead={partsContent.body[0]}
      />

      <div className={styles.partsGrid}>
        {partsContent.brands.map((brand) => (
          <div key={brand.name} data-reveal>
            <Card3D intensity={0.7}>
              <LayerSurface className={styles.partsCard} padding="28px">
                <span className={styles.partsBrandLabel}>Genuine</span>
                <h3 className={styles.partsBrandName}>{brand.name}</h3>
                <p className={styles.partsBrandNote}>{brand.note}</p>
              </LayerSurface>
            </Card3D>
          </div>
        ))}
      </div>

      <div className={styles.partsFooter} data-reveal>
        <p className={styles.partsFootnote}>{partsContent.body[1]}</p>
        <a href={partsContent.cta.href} className="app-btn">
          {partsContent.cta.label}
        </a>
      </div>
    </section>
  );
}
