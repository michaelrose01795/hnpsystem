// file location: src/singlescroll/components/ServiceAndParts.js
// Servicing & MOT section — split layout (text + image), service hours, CTA.

import LayerSurface from "@/components/ui/LayerSurface";
import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
import useSmoothScrollTo from "../hooks/useSmoothScrollTo";
import styles from "../styles/singlescroll.module.css";

export default function ServiceAndParts() {
  const scrollTo = useSmoothScrollTo();
  const { serviceAndParts, contact } = siteContent;

  return (
    <section id="service" className={`${styles.section} ${styles.sectionTinted}`}>
      <SectionHeading
        number="04"
        eyebrow={serviceAndParts.eyebrow}
        title={serviceAndParts.title}
      />

      <div className={styles.split} data-reveal>
        <div className={styles.splitMedia}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={serviceAndParts.imageUrl}
            alt="Workshop and waiting area"
            className={styles.splitMediaImg}
            loading="lazy"
          />
        </div>
        <div className={styles.splitBody}>
          {serviceAndParts.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          <LayerSurface padding="20px">
            <p className={styles.contactLabel}>Service hours</p>
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
          </LayerSurface>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href="#contact"
              onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              Book a service
            </a>
            <a
              href={contact.phoneHref}
              className={`${styles.btn} ${styles.btnGhostDark}`}
            >
              Call {contact.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
