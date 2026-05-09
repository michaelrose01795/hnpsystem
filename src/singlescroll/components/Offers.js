// file location: src/singlescroll/components/Offers.js
// Promotional banners — image with gradient overlay + headline. Each card
// is wrapped in <Card3D> for premium tilt-on-hover.

import Card3D from "./Card3D";
import { offers } from "../data/offers";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function Offers() {
  return (
    <section id="offers" className={`${styles.section} ${styles.sectionTinted}`} data-parallax-container>
      <SectionHeading
        number="02"
        eyebrow="Latest Offers"
        title="Manufacturer offers, from people you can trust"
        lead="0% finance, customer savings, and the new e-Vitara on PCH — refreshed every month."
      />

      <div className={styles.offersGrid}>
        {offers.map((offer) => (
          <div key={offer.id} data-reveal>
            <Card3D intensity={0.7}>
              <article className={styles.offerCard}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={offer.image}
                  alt={offer.title}
                  className={styles.offerImg}
                  loading="lazy"
                />
                <div className={styles.offerOverlay} aria-hidden="true" />
                <div className={styles.offerContent}>
                  <span className={styles.offerTitle}>{offer.title}</span>
                  <h3 className={styles.offerHeadline}>{offer.headline}</h3>
                  <p className={styles.offerBody}>{offer.body}</p>
                </div>
              </article>
            </Card3D>
          </div>
        ))}
      </div>
    </section>
  );
}
