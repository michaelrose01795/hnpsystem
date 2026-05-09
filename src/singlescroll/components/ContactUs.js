// file location: src/singlescroll/components/ContactUs.js
// Contact section — phone, address, sales/service hours, embedded map, socials.

import LayerSurface from "@/components/ui/LayerSurface";
import { siteContent } from "../data/siteContent";
import SectionHeading from "./SectionHeading";
import styles from "../styles/singlescroll.module.css";

export default function ContactUs() {
  const { contact } = siteContent;

  return (
    <section id="contact" className={`${styles.section} ${styles.sectionTinted}`}>
      <SectionHeading
        number="11"
        eyebrow={contact.eyebrow}
        title={contact.title}
        lead="Pop in to the showroom, give us a ring, or drop us a message — we're here to help."
      />

      <div className={styles.contactGrid}>
        <LayerSurface className={styles.contactCard} padding="0">
          <div className={styles.contactBlock}>
            <p className={styles.contactLabel}>Call us</p>
            <a href={contact.phoneHref} className={styles.contactPhone}>
              {contact.phone}
            </a>
          </div>

          <div className={styles.contactBlock}>
            <p className={styles.contactLabel}>Visit us</p>
            <p className={styles.contactAddress}>
              {contact.address.map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>
          </div>

          <div className={styles.contactBlock}>
            <p className={styles.contactLabel}>Sales hours</p>
            <table className={styles.hoursTable}>
              <tbody>
                {contact.salesHours.map((h) => (
                  <tr key={h.days}>
                    <td>{h.days}</td>
                    <td>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.contactBlock}>
            <p className={styles.contactLabel}>Service hours</p>
            <table className={styles.hoursTable}>
              <tbody>
                {contact.serviceHours.map((h) => (
                  <tr key={h.days}>
                    <td>{h.days}</td>
                    <td>{h.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.socials}>
            {contact.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className={styles.socialLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                {s.label}
              </a>
            ))}
          </div>
        </LayerSurface>

        <div className={styles.mapWrap} data-reveal>
          <iframe
            title="Humphries & Parks map"
            src={contact.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}
