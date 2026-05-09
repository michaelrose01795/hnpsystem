// file location: src/singlescroll/components/BrandStrip.js
// Authorised retailer brand logos (Suzuki / KGM / Mitsubishi).

import { brands } from "../data/brands";
import styles from "../styles/singlescroll.module.css";

export default function BrandStrip() {
  return (
    <div className={styles.brandStrip} data-reveal>
      <div className={styles.brandStripInner}>
        <span className={styles.brandStripLabel}>Authorised retailer for</span>
        {brands.map((brand) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={brand.name}
            src={brand.logo}
            alt={brand.name}
            className={styles.brandLogo}
          />
        ))}
      </div>
    </div>
  );
}
