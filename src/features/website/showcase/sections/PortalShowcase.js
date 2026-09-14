// file location: src/features/website/showcase/sections/PortalShowcase.js
//
// /website/dev — @family portal: the /website/profile customer portal. Static
// markup mirrors src/pages/website/profile.js (the page fetches a bundled
// customer payload and redirects when signed out, so it cannot be imported).
// State is shown through the same attributes the page writes: data-tone,
// data-state, data-author, data-enabled, aria-pressed and aria-checked, plus
// the runtime custom properties --ws-portal-pct / --ws-portal-score /
// --ws-portal-steps. The one primary per view is .app-btn; every other button
// is the raw-<button> secondary.

import { blogPosts } from "@/features/website/data/blogPosts";
import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const NAV_LINKS = ["Summary", "Ownership", "Tracker", "Vehicles", "Jobs", "Messages", "Settings"];
const STAGES = [
  { key: "booked", label: "Booked", state: "done" },
  { key: "checked_in", label: "Checked in", state: "done" },
  { key: "workshop", label: "In workshop", state: "active" },
  { key: "wash", label: "Wash done", state: "todo" },
  { key: "ready", label: "Ready", state: "todo" },
];

function CardHeader({ eyebrow, title, count, action }) {
  return (
    <div className="ws-portal-card__header">
      <div>
        {eyebrow ? <div className="ws-portal-eyebrow">{eyebrow}</div> : null}
        <h2 className="ws-portal-card__title">{title}</h2>
      </div>
      <div className="ws-portal-action-row ws-portal-actions-end">
        {count !== undefined ? <span className="ws-portal-count">{count}</span> : null}
        {action}
      </div>
    </div>
  );
}

function Tracker({ spaced = false }) {
  return (
    <div
      className={spaced ? "ws-portal-tracker ws-portal-spaced" : "ws-portal-tracker"}
      style={{ "--ws-portal-steps": String(STAGES.length) }}
    >
      {STAGES.map((stage) => (
        <div key={stage.key} className="ws-portal-step" data-state={stage.state}>
          <span className="ws-portal-step__dot" />
          <span>{stage.label}</span>
        </div>
      ))}
    </div>
  );
}

function Toggle({ label, checked }) {
  return (
    <div className="ws-portal-toggle" role="switch" aria-checked={checked} tabIndex={0}>
      <span className="ws-portal-toggle__label">{label}</span>
      <span className="ws-portal-toggle__track">
        <span className="ws-portal-toggle__knob" />
      </span>
    </div>
  );
}

export default function PortalShowcase({ section }) {
  const photo = blogPosts.find((post) => post.image)?.image;

  return (
    <ShowcaseSection id="portal" section={section}>
      <Row label="Portal top bar" note=".ws-nav.ws-portal-navbar · .ws-portal-topbar — jump-to links and greeting in the sticky bar">
        <Frame>
          <div className="ws-page">
            <header className="ws-nav ws-portal-navbar">
              <div className="ws-nav-inner">
                <nav className="ws-nav-links" aria-label="Showcase account sections">
                  <span className="ws-portal-nav__heading">Jump to</span>
                  {NAV_LINKS.map((label, index) => (
                    <a key={label} href="#portal" className={index === 0 ? "ws-nav-link ws-nav-link--active" : "ws-nav-link"}>
                      {label}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="ws-portal-topbar">
                <div>
                  <span className="ws-portal-eyebrow">Customer portal</span>
                  <h1 className="ws-portal-title">Hello, Jordan Reyes</h1>
                  <p className="ws-portal-subtitle">
                    Your vehicles, jobs, invoices, messages and account settings — all in one place.
                  </p>
                </div>
                <div className="ws-portal-header__actions">
                  <button type="button">Theme: Dark</button>
                  <a href="#portal" role="button">
                    Back to site
                  </a>
                  <button type="button" className="app-btn ws-portal-action-start">
                    Log out
                  </button>
                </div>
              </div>
            </header>
          </div>
        </Frame>
      </Row>

      <Row label="Portal page" note=".ws-portal-shell · .ws-portal-stack · .ws-portal-banner">
        <Frame padded>
          <div className="ws-portal-shell">
            <main className="ws-portal-main">
              <div>
                <div className="ws-portal-stack">
                  <div className="ws-portal-split">
                    <section className="website-banner ws-portal-banner">
                      <div className="ws-portal-flow">
                        <span className="ws-portal-banner__title">MOT due in 12 days — AB12 CDE</span>
                        <span className="ws-portal-banner__meta">Expires 25 Sep 2026</span>
                      </div>
                      <button type="button">Book MOT</button>
                      <p className="ws-portal-flash">MOT request sent — we&apos;ll confirm by email.</p>
                    </section>

                    <section className="ws-portal-card ws-portal-card--wide">
                      <CardHeader
                        eyebrow="Live job"
                        title="Live status - JOB-1042"
                        action={<span className="ws-portal-badge">In workshop</span>}
                      />
                      <p className="ws-portal-hint">AB12 CDE · Ford Focus</p>
                      <div className="ws-portal-action-row">
                        <span className="ws-portal-tag" data-tone="accent">
                          Mobile visit · TN15 6AA
                        </span>
                        <span className="ws-portal-tag" data-tone="default">
                          ETA 16 Sep 2026
                        </span>
                        <span className="ws-portal-tag" data-tone="ok">
                          Authorised £240.00
                        </span>
                      </div>
                      <Tracker spaced />
                    </section>
                  </div>
                  <p className="ws-portal-status">Loading your account…</p>
                  <p className="ws-portal-status">
                    Could not load your account.{" "}
                    <a href="#portal" className="ws-portal-link">
                      Sign in again
                    </a>
                    .
                  </p>
                </div>
              </div>
            </main>
          </div>
        </Frame>
      </Row>

      <Row label="Cards, lists & badges" note=".ws-portal-card · .ws-portal-row · .ws-portal-badge[data-tone] · .ws-portal-light[data-tone] · .ws-portal-todo">
        <Frame padded>
          <div className="ws-portal-split">
            <section className="ws-portal-card">
              <CardHeader eyebrow="Workshop" title="Jobs & service history" count={3} />
              <ul className="ws-portal-list">
                <li className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">JOB-1042 · Service</div>
                    <div className="ws-portal-item-meta">AB12 CDE · Ford Focus · 02 Sep 2026</div>
                    <div className="ws-portal-item-meta ws-portal-item-meta--spaced">
                      MOT due 25 Sep 2026 · Warranty until 01 Mar 2027
                    </div>
                    <div className="ws-portal-action-row">
                      <span className="ws-portal-light" data-tone="red">
                        <span className="ws-portal-light__dot" />2
                      </span>
                      <span className="ws-portal-light" data-tone="amber">
                        <span className="ws-portal-light__dot" />3
                      </span>
                      <span className="ws-portal-light" data-tone="green">
                        <span className="ws-portal-light__dot" />
                        18
                      </span>
                    </div>
                  </div>
                  <span className="ws-portal-badge">In progress</span>
                </li>
                <li className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">INV-2231 · JOB-0998</div>
                    <div className="ws-portal-item-meta">14 Aug 2026 · £182.40</div>
                  </div>
                  <span className="ws-portal-badge" data-tone="ok">
                    Paid
                  </span>
                </li>
                <li className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">Brake pads</div>
                    <div className="ws-portal-item-meta">Qty 1 · ETA 18 Sep 2026</div>
                  </div>
                  <span className="ws-portal-badge" data-tone="open">
                    Pending
                  </span>
                </li>
                <li className="ws-portal-row">
                  <div>
                    <div className="ws-portal-item-title">Checked in</div>
                  </div>
                  <span className="ws-portal-when">03 Sep 2026, 08:14</span>
                </li>
                <li className="ws-portal-row ws-portal-row--single">
                  <div>
                    <div className="ws-portal-item-title">AB12 CDE · Ford Focus</div>
                    <div className="ws-portal-item-meta">2019 · Blue · Petrol · Manual · 48,250 mi</div>
                  </div>
                </li>
              </ul>
            </section>

            <section className="ws-portal-card">
              <CardHeader
                eyebrow="Files"
                title="Documents centre"
                action={
                  <a className="app-btn" href="#portal">
                    Request upload
                  </a>
                }
              />
              <div className="ws-portal-todo">
                <span className="ws-portal-subhead">TODO · Upload endpoint not wired yet</span>
                <p className="ws-portal-empty">Invoices and VHC media are live.</p>
              </div>
              <div className="ws-portal-tile">
                <h3 className="ws-portal-subhead">Upload zone</h3>
                <div className="ws-portal-upload ws-portal-upload--auto">
                  Customer uploads will appear here once the upload endpoint is connected.
                </div>
                <div className="ws-portal-split">
                  <div className="ws-portal-upload">Upload connection required</div>
                </div>
              </div>
              <div className="ws-portal-tile">
                <p className="ws-portal-lead">Send us photos of scuffs, scratches or dents.</p>
                <div>
                  <h3 className="ws-portal-subhead">Service notes</h3>
                  <p className="ws-portal-note">Timing belt replaced at 45,000 miles.</p>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Health, progress & details" note=".ws-portal-score · .ws-portal-progress · .ws-portal-notify[data-enabled] · .ws-portal-details · .ws-portal-tracker">
        <Frame padded>
          <section className="ws-portal-card">
            <CardHeader eyebrow="Ownership hub" title="Vehicle health overview" count="1 vehicle" />
            <div className="ws-portal-tile">
              <div className="ws-portal-action-row">
                <div className="ws-portal-score" style={{ "--ws-portal-score": `${80 * 3.6}deg` }}>
                  <div className="ws-portal-score__inner">
                    <span className="ws-portal-score__value">80</span>
                    <span className="ws-portal-score__label">health</span>
                  </div>
                </div>
                <div className="website-dev-stack">
                  <span className="ws-portal-item-title">Ford Focus</span>
                  <span className="ws-portal-badge">AB12 CDE</span>
                </div>
              </div>
              <div className="ws-portal-progress">
                <div className="ws-portal-progress__fill" style={{ "--ws-portal-pct": "67%" }} />
              </div>
              <div className="ws-portal-details">
                <div className="ws-portal-detail">
                  <span className="ws-portal-label">MOT due</span>
                  <span className="ws-portal-detail__value">25 Sep 2026</span>
                </div>
                <div className="ws-portal-detail">
                  <span className="ws-portal-label">Mileage</span>
                  <span className="ws-portal-detail__value">48,250 miles</span>
                </div>
              </div>
              <div className="ws-portal-action-row">
                <span className="ws-portal-notify" data-enabled="true">
                  <span className="ws-portal-notify__dot" />
                  SMS
                </span>
                <span className="ws-portal-notify" data-enabled="false">
                  <span className="ws-portal-notify__dot" />
                  Push
                </span>
              </div>
              <Tracker />
            </div>
          </section>
        </Frame>
      </Row>

      <Row label="Money & mileage" note=".ws-portal-balance · .ws-portal-ledger · .ws-portal-ledger__amount[data-tone] · .ws-portal-chip__* · .ws-portal-mileage">
        <Frame padded>
          <div className="ws-portal-split">
            <section className="ws-portal-card">
              <CardHeader eyebrow="Billing" title="Invoices" count={4} />
              <div className="ws-portal-balance">
                <span className="ws-portal-balance__figure">£182.40</span>
                <span className="ws-portal-hint">Outstanding across 1 invoice</span>
              </div>
              <div className="ws-portal-ledger">
                <div className="ws-portal-ledger__row">
                  <span className="ws-portal-ledger__meta">14 Aug 2026</span>
                  <span>
                    <div>Annual service</div>
                    <div className="ws-portal-ledger__meta">JOB-0998 · Card</div>
                  </span>
                  <span className="ws-portal-ledger__amount" data-tone="debit">
                    £182.40
                  </span>
                </div>
                <div className="ws-portal-ledger__row">
                  <span className="ws-portal-ledger__meta">20 Aug 2026</span>
                  <span>
                    <div>Payment received</div>
                  </span>
                  <span className="ws-portal-ledger__amount" data-tone="credit">
                    −£182.40
                  </span>
                </div>
              </div>
              <ul className="ws-portal-list">
                <li className="ws-portal-detail">
                  <span className="ws-portal-chip__brand">Visa · Default</span>
                  <span className="ws-portal-chip__line">•••• 4242 · expires 08/28</span>
                </li>
              </ul>
            </section>

            <section className="ws-portal-card">
              <CardHeader eyebrow="Mileage" title="Mileage history" />
              <div className="ws-portal-mileage">
                {[
                  { date: "02 Sep 2026", miles: "48,250", pct: 100 },
                  { date: "11 Sep 2025", miles: "39,120", pct: 81 },
                ].map((row) => (
                  <div key={row.date} className="ws-portal-mileage__row">
                    <span>{row.date}</span>
                    <span className="ws-portal-mileage__bar">
                      <span className="ws-portal-mileage__fill" style={{ "--ws-portal-pct": `${row.pct}%` }} />
                    </span>
                    <span className="ws-portal-mileage__value">{row.miles} mi</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Media, timeline & messages" note=".ws-portal-media · .ws-portal-thumb · .ws-portal-timeline · .ws-portal-bubble[data-author]">
        <Frame padded>
          <div className="ws-portal-split">
            <section className="ws-portal-card">
              <CardHeader eyebrow="Inspection" title="Inspection photos & video" count={2} />
              <div className="ws-portal-media-grid">
                <a href="#portal" className="ws-portal-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photo ? <img src={photo} alt="Front brake disc" className="ws-portal-media__fill" /> : null}
                  <span className="ws-portal-media__tag">Photo</span>
                  <span className="ws-portal-media__caption">Front brake disc</span>
                </a>
              </div>
              <div className="ws-portal-action-row">
                <div className="ws-portal-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photo ? <img src={photo} alt="" className="ws-portal-media__fill" /> : null}
                </div>
              </div>
              <div className="ws-portal-timeline">
                <div className="ws-portal-timeline__row">
                  <span className="ws-portal-when">02 Sep 2026</span>
                  <span className="ws-portal-timeline__what">Booked in for annual service</span>
                </div>
              </div>
            </section>

            <section className="ws-portal-card ws-portal-card--wide">
              <CardHeader eyebrow="Inbox" title="Messages" count={2} />
              <div className="ws-portal-thread">
                <div className="ws-portal-bubble" data-author="staff">
                  Your car is ready for collection.
                  <span className="ws-portal-bubble__meta">Humphries &amp; Parks · 03 Sep 2026, 16:02</span>
                </div>
                <div className="ws-portal-bubble" data-author="customer">
                  Thanks, I&apos;ll be there at 5.
                  <span className="ws-portal-bubble__meta">You · 03 Sep 2026, 16:10</span>
                </div>
              </div>
              <div className="ws-portal-compose">
                <textarea className="ws-portal-grow" placeholder="Type a message…" />
                <button type="button" className="app-btn">
                  Send
                </button>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Forms, services & settings" note=".ws-portal-form · .ws-portal-services · button.ws-portal-service[aria-pressed] · .ws-portal-toggle[aria-checked]">
        <Frame padded>
          <section className="ws-portal-card ws-portal-card--wide">
            <CardHeader eyebrow="Requests" title="Our services" />
            <p className="ws-portal-hint">Pick what you need and we&apos;ll come back to you with a quote.</p>
            <div className="ws-portal-services">
              <button type="button" className="ws-portal-service" aria-pressed="true">
                <span className="ws-portal-service__title">Body work</span>
                <span className="ws-portal-service__hint">Dents, scratches, panel repair, paint.</span>
              </button>
              <button type="button" className="ws-portal-service" aria-pressed="false">
                <span className="ws-portal-service__title">Valet</span>
                <span className="ws-portal-service__hint">Mini, full or deep-clean valet packages.</span>
              </button>
            </div>

            <div className="ws-portal-settings-row">
              <div className="ws-portal-card__header">
                <div>
                  <div className="ws-portal-item-title">Add a vehicle</div>
                  <p className="ws-portal-hint">We&apos;ll add this to your account straight away.</p>
                </div>
              </div>
              <form className="ws-portal-form" onSubmit={(event) => event.preventDefault()}>
                <p className="ws-portal-error">Please enter a registration number</p>
                <div className="ws-portal-form-row">
                  <div className="ws-portal-field">
                    <label className="ws-portal-label" htmlFor="dev-portal-reg">
                      Registration
                    </label>
                    <div className="ws-portal-action-row">
                      <input id="dev-portal-reg" type="text" placeholder="e.g. AB12 CDE" className="ws-portal-reg-input" />
                      <button type="button">Search</button>
                    </div>
                  </div>
                  <div className="ws-portal-field">
                    <label className="ws-portal-label" htmlFor="dev-portal-make">
                      Make &amp; model
                    </label>
                    <input id="dev-portal-make" type="text" />
                  </div>
                </div>
                <button type="submit" className="app-btn">
                  Add
                </button>
              </form>
            </div>

            <div className="ws-portal-settings-row">
              <div className="ws-portal-card__header">
                <div>
                  <div className="ws-portal-item-title">Notifications</div>
                  <p className="ws-portal-hint">How and when we contact you.</p>
                </div>
              </div>
              <Toggle label="MOT reminders" checked />
              <Toggle label="Marketing SMS" checked={false} />
            </div>
          </section>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
