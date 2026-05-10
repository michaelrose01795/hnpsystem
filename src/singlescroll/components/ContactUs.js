// file location: src/singlescroll/components/ContactUs.js
// Contact chapter — phone, address, sales/service hours and socials
// presented as a premium scene panel beside an embedded map. Routed
// through the shared SceneShell so it shares the page's master design
// language (huge ghost backdrop, numbered head, premium dark surfaces).

import { siteContent } from "../data/siteContent";
import SceneShell from "./SceneShell";
import styles from "../styles/singlescroll.module.css";

export default function ContactUs() {
  const { contact } = siteContent;

  return (
    <SceneShell
      id="contact"
      number="08"
      eyebrow={contact.eyebrow}
      title={contact.title}
      lead="Pop into the showroom, give us a ring, or drop us a message — we&rsquo;re here to help."
      backdrop="Hello"
      tone="scene"
      ariaLabel="Contact us"
    >
      <div className={styles.sceneSplit} data-reveal>
        <article className={styles.scenePanel} style={{ padding: "32px" }}>
          <div className={styles.sceneInfoBlock}>
            <p className={styles.sceneInfoLabel}>Call us</p>
            <a href={contact.phoneHref} className={styles.sceneInfoPhone}>
              {contact.phone}
            </a>
          </div>

          <div className={styles.sceneInfoBlock}>
            <p className={styles.sceneInfoLabel}>Visit us</p>
            <p className={styles.scenePanelBody}>
              {contact.address.map((line, i) => (
                <span key={i}>{line}<br /></span>
              ))}
            </p>
          </div>

          <div className={styles.sceneInfoBlock}>
            <p className={styles.sceneInfoLabel}>Sales hours</p>
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

          <div className={styles.sceneInfoBlock}>
            <p className={styles.sceneInfoLabel}>Service hours</p>
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
        </article>

        <div className={styles.sceneMapCard} data-reveal>
          <iframe
            title="Humphries & Parks map"
            src={contact.mapEmbed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </SceneShell>
  );
}
