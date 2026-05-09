// file location: src/singlescroll/components/Footer.js
// Bottom footer — logo, legal links, FCA + commission disclosure, copyright.

import { siteContent } from "../data/siteContent";
import styles from "../styles/singlescroll.module.css";

export default function Footer() {
  const year = new Date().getFullYear();
  const { footer, brand } = siteContent;

  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={brand.logoWhiteUrl}
            alt={brand.name}
            className={styles.footerLogo}
          />
          <ul className={styles.footerLinks}>
            {footer.legal.map((label) => (
              <li key={label}><a href="#top">{label}</a></li>
            ))}
          </ul>
        </div>

        <p className={styles.footerLegal}>
          <strong>{footer.fcaReg}.</strong> {footer.creditDisclosure}
        </p>

        <p className={styles.footerCopy}>
          © {year} {brand.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
