// file location: src/singlescroll/components/ServiceAndParts.js
// Service & Parts chapter — combines the workshop split (image, copy,
// service hours, CTAs) with the genuine-parts brand chips that used to
// live in PartsAndAccessories. The 9-item nav has a single "Service &
// Parts" entry, so both belong inside this one chapter.

import { siteContent } from "../data/siteContent";
import { partsContent } from "../data/partsContent";
import SceneShell from "./SceneShell";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function ServiceAndParts() {
  const scrollTo = useSmoothScrollTo();
  const { serviceAndParts, contact } = siteContent;

  return (
    <SceneShell
      id="service"
      number="04"
      eyebrow={serviceAndParts.eyebrow}
      title={serviceAndParts.title}
      lead={serviceAndParts.body[0]}
      backdrop="Workshop"
      tone="surface"
      ariaLabel="Service and parts"
    >
      <div className={`${styles.sceneSplit} ${styles.sceneSplitReverse}`} data-reveal>
        <div className={styles.sceneSplitMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={serviceAndParts.imageUrl}
            alt="Workshop and waiting area"
            loading="lazy"
          />
          <div className={styles.sceneSplitTagline}>
            <span className={styles.sceneSplitTaglineDot} aria-hidden="true" />
            <span>Manufacturer-trained technicians · Authorised service agents</span>
          </div>
        </div>

        <div className={styles.sceneSplitBody}>
          {serviceAndParts.body.slice(1).map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <article className={styles.scenePanel} style={{ padding: "20px 22px" }}>
            <span className={styles.scenePanelEyebrow}>Service hours</span>
            <table className={styles.hoursTable}>
              <tbody>
                {serviceAndParts.hours.map((h) => (
                  <tr key={h.days}>
                    <td>{h.days}</td>
                    <td>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <div className={styles.sceneCtaRow}>
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              <span>Book a service</span>
            </a>
            <a
              href={contact.phoneHref}
              className={`${styles.btn} ${styles.btnGhost}`}
            >
              <span>Call {contact.phone}</span>
            </a>
          </div>
        </div>
      </div>

      <div data-reveal style={{ marginTop: 64 }}>
        <header className={styles.subSceneHead}>
          <span className={styles.subSceneEyebrow}>{partsContent.eyebrow}</span>
          <h3 className={styles.subSceneTitle}>{partsContent.title}</h3>
          <p className={styles.subSceneLead}>{partsContent.body[0]}</p>
        </header>

        <div className={styles.scenePartsChips}>
          {partsContent.brands.map((brand) => (
            <article key={brand.name} className={styles.scenePartsChip}>
              <span className={styles.scenePanelEyebrow}>Genuine</span>
              <span className={styles.scenePartsChipBrand}>{brand.name}</span>
              <span className={styles.scenePartsChipNote}>{brand.note}</span>
            </article>
          ))}
        </div>

        <div className={styles.sceneCtaRow} style={{ marginTop: 24, justifyContent: "space-between" }}>
          <p className={styles.scenePanelBody} style={{ maxWidth: "60ch" }}>{partsContent.body[1]}</p>
          <a href={partsContent.cta.href} className={`${styles.btn} ${styles.btnPrimary}`}>
            <span>{partsContent.cta.label}</span>
          </a>
        </div>
      </div>
    </SceneShell>
  );
}
