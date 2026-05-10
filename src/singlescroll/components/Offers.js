// file location: src/singlescroll/components/Offers.js
// Promotional banners — image with gradient overlay + headline. Each
// card is wrapped in <Card3D> for premium tilt-on-hover. Routed through
// the unified SceneShell so the chapter shares the page's master layout
// language ("Why families across Kent keep coming back" diorama).

import Card3D from "./Card3D";
import { offers } from "../data/offers";
import SceneShell from "./SceneShell";
import styles from "../styles/singlescroll.module.css";

export default function Offers() {
  return (
    <SceneShell
      id="offers"
      number="02"
      eyebrow="Latest Offers"
      title="Manufacturer offers from people you can trust"
      lead="0% finance, customer savings, and the new e-Vitara on PCH — refreshed every month and explained without small print."
      backdrop="Deals"
      tone="scene"
      ariaLabel="Latest offers"
    >
      <div className={styles.offersGrid} data-parallax-container>
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
    </SceneShell>
  );
}
