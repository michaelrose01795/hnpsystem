// file location: src/features/website/legal/LegalPageBody.js
//
// The body shared by /website/privacy and /website/terms. Full width: an
// "at a glance" card and one card per topic packed across the page, with the
// contents list, contact details and related links in a side column.
//
// Styling is custglobal.css only (.ws-page-split, .ws-grid--info, .ws-info-*,
// .ws-jump-*). No inline visual styling.

import Link from "next/link";

import InfoList from "../components/InfoList";

export default function LegalPageBody({ glance, sections, contact, links }) {
  return (
    <section className="ws-section ws-val-body">
      <div className="ws-container">
        <div className="ws-page-split">
          <div className="ws-page-main">
            <div className="ws-grid ws-grid--info">
              {/* The key facts span the whole row above the topic cards. */}
              {glance?.items?.length ? (
                <div className="ws-card ws-panel ws-info-card ws-info-card--wide">
                  <h2 className="ws-card-title">{glance.title}</h2>
                  <InfoList items={glance.items} />
                </div>
              ) : null}

              {sections.map((s) => (
                <section key={s.id} id={s.id} className="ws-card ws-panel ws-info-card">
                  <h2 className="ws-card-title">{s.heading}</h2>
                  {s.body.map((text) => (
                    <p key={text} className="ws-muted">
                      {text}
                    </p>
                  ))}
                  <InfoList items={s.details} />
                </section>
              ))}
            </div>
          </div>

          <aside className="ws-page-aside">
            <nav className="ws-card ws-panel ws-info-card" aria-label="On this page">
              <h2 className="ws-card-title">On this page</h2>
              <ul className="ws-jump-links">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="ws-jump-link">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {contact?.items?.filter(Boolean).length ? (
              <div className="ws-card ws-panel ws-info-card">
                <h2 className="ws-card-title">{contact.title}</h2>
                {contact.note ? <p className="ws-muted">{contact.note}</p> : null}
                <InfoList items={contact.items} />
              </div>
            ) : null}

            {links?.length ? (
              <nav className="ws-card ws-panel ws-info-card" aria-label="Related pages">
                <h2 className="ws-card-title">More information</h2>
                <ul className="ws-jump-links">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="ws-jump-link">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </aside>
        </div>
      </div>
    </section>
  );
}
