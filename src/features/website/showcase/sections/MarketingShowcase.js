// file location: src/features/website/showcase/sections/MarketingShowcase.js
//
// /website/dev — @family marketing (the .ws-* page behind /website) and
// @family preview (the Live Preview editor outlines). Markup mirrors
// src/features/website/WebsitePage.js; VehicleCard and BrandLogo are the real
// shared components. Every preview sits inside .ws-page, which owns the page
// tokens (--ws-card, --ws-line, --ws-radius, ...). Page CTAs live in Buttons.

/* eslint-disable @next/next/no-img-element */

import BrandLogo from "@/components/BrandLogo";
import VehicleCard from "@/features/website/components/VehicleCard";
import { OfferCard } from "@/features/website/components/OffersSection";
import { offers } from "@/features/website/data/offers";
import BenefitCards from "@/features/website/components/BenefitCards";
import SellValuationPanel from "@/features/website/components/SellValuationPanel";
import WorkshopBookingPanel from "@/features/website/components/WorkshopBookingPanel";
import MotabilityModelCard from "@/features/website/components/MotabilityModelCard";
import WebsiteIcon from "@/features/website/components/WebsiteIcon";
import { vehicles } from "@/features/website/data/vehicles";
import { siteContent } from "@/features/website/data/siteContent";
import { team } from "@/features/website/data/team";
import { timeline } from "@/features/website/data/timeline";
import { brands } from "@/features/website/data/brands";
import { FEATURED_REVIEW_LIMIT, reviews, reviewTopics } from "@/features/website/data/reviews";
import HistoryTimeline from "@/features/website/components/HistoryTimeline";
import ReviewsPanel from "@/features/website/components/ReviewsPanel";
import VisitCta from "@/features/website/components/VisitCta";
import WebsiteFooter from "@/features/website/components/WebsiteFooter";
import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const PHOTO = vehicles.find((vehicle) => vehicle.image)?.image || null;

const HOURS = [
  ["Monday – Friday", "8:30am – 5:30pm"],
  ["Saturday", "9:00am – 1:00pm"],
  ["Sunday", "Closed"],
];

function HoursTable({ caption }) {
  return (
    <div className="ws-hours">
      <p className="ws-hours-caption">{caption}</p>
      <table className="ws-hours-table">
        <tbody>
          {HOURS.map(([day, hours]) => (
            <tr key={day}>
              <th scope="row">{day}</th>
              <td>{hours}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketingShowcase({ section }) {
  const staticVehicle = vehicles[1] || vehicles[0];

  return (
    <ShowcaseSection id="marketing" section={section}>
      <Row label="Navigation" hint="site · shop" size="wide">
        <div className="website-dev-stack">
          <Frame>
            <div className="ws-page">
              <header className="ws-nav ws-nav--grouped">
                <div className="ws-nav-inner">
                  <a href="#marketing" className="ws-brand">
                    <BrandLogo className="ws-logo" alt="Humphries and Parks" />
                  </a>
                  {/* Mirrors WebsiteNavGroup: an open group holding the active
                      link, and a closed one. */}
                  <nav className="ws-nav-links" aria-label="Showcase primary">
                    <a href="#marketing" className="ws-nav-link">
                      Home
                    </a>
                    <div className="ws-nav-group ws-nav-group--open">
                      <button type="button" className="ws-nav-group-trigger ws-nav-group-trigger--active" aria-expanded="true">
                        Buy a car
                        <WebsiteIcon name="chevron" className="ws-nav-caret" />
                      </button>
                      <div className="ws-nav-menu" role="group" aria-label="Buy a car">
                        <a href="#stock" className="ws-nav-link ws-nav-link--active" aria-current="location">
                          Our Cars
                        </a>
                        <a href="#marketing" className="ws-nav-link">
                          Offers
                        </a>
                        <a href="#marketing" className="ws-nav-link">
                          Motability
                        </a>
                      </div>
                    </div>
                    <a href="#valuation" className="ws-nav-link">
                      Sell your car
                    </a>
                    <div className="ws-nav-group">
                      <button type="button" className="ws-nav-group-trigger" aria-expanded="false">
                        About us
                        <WebsiteIcon name="chevron" className="ws-nav-caret" />
                      </button>
                      <div className="ws-nav-menu" role="group" aria-label="About us">
                        <a href="#marketing" className="ws-nav-link">
                          Reviews
                        </a>
                      </div>
                    </div>
                  </nav>
                  <button type="button" className="ws-nav-toggle">
                    Menu
                  </button>
                  <div className="ws-nav-actions">
                    <span className="ws-nav-dev-group">
                      <button type="button" className="ws-nav-account ws-nav-dev">
                        Dev
                      </button>
                      <button type="button" className="ws-nav-account ws-nav-dev ws-nav-dev--on" aria-pressed="true">
                        Overlay
                      </button>
                    </span>
                    <a href="tel:01732870711" className="ws-nav-phone" aria-label="Call us on 01732 870711">
                      <WebsiteIcon name="phone" className="ws-nav-phone-icon" />
                      <span className="ws-nav-phone-number">01732 870711</span>
                    </a>
                    <a href="#auth" className="ws-nav-account ws-nav-account--profile">
                      Account
                    </a>
                  </div>
                </div>
              </header>
            </div>
          </Frame>
          <Frame>
            <div className="ws-page">
              <header className="ws-nav ws-nav--shop">
                <div className="ws-nav-inner">
                  <a href="#shop" className="ws-brand">
                    <BrandLogo className="ws-logo" alt="Humphries and Parks" />
                  </a>
                  <nav className="ws-nav-links ws-nav-links--balanced ws-nav-links--even" aria-label="Showcase shop">
                    <div className="ws-nav-links__side ws-nav-links__side--start">
                      <a href="#parts" className="ws-nav-link ws-nav-link--active">
                        Parts catalogue
                      </a>
                    </div>
                    <div className="ws-nav-links__side ws-nav-links__side--end">
                      <a href="#shop" className="ws-nav-link">
                        Accessories
                      </a>
                    </div>
                  </nav>
                  <div className="ws-nav-actions">
                    <a href="#shop" className="ws-nav-link">
                      Basket
                    </a>
                    <a href="#auth" className="ws-nav-account">
                      Sign in
                    </a>
                  </div>
                </div>
              </header>
            </div>
          </Frame>
        </div>
      </Row>

      <Row label="Mobile menu" hint="open" size="md">
        <Frame>
          <div className="ws-page">
            <header className="ws-nav">
              <div className="ws-nav-inner">
                <nav className="ws-nav-links ws-nav-links--open" aria-label="Showcase mobile">
                  <a href="#marketing" className="ws-nav-link ws-nav-link--active">
                    Home
                  </a>
                  <a href="#stock" className="ws-nav-link">
                    Cars
                  </a>
                  {/* In the open panel a group opens inline, as an accordion. */}
                  <div className="ws-nav-group ws-nav-group--open">
                    <button type="button" className="ws-nav-group-trigger" aria-expanded="true">
                      About us
                      <WebsiteIcon name="chevron" className="ws-nav-caret" />
                    </button>
                    <div className="ws-nav-menu" role="group" aria-label="About us (menu)">
                      <a href="#marketing" className="ws-nav-link">
                        Reviews
                      </a>
                      <a href="#marketing" className="ws-nav-link">
                        Meet the Team
                      </a>
                    </div>
                  </div>
                  <div className="ws-nav-menu-extras">
                    <a href="tel:01732870711" className="ws-nav-phone">
                      Call us
                    </a>
                    <a href="#auth" className="ws-nav-account">
                      Sign in
                    </a>
                  </div>
                </nav>
              </div>
            </header>
          </div>
        </Frame>
      </Row>

      <Row label="Tabs" hint=".ws-tabs">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-tabs" role="tablist" aria-label="Showcase tabs">
              <button type="button" role="tab" aria-selected="true" className="ws-tab ws-tab--active">
                All cars
              </button>
              <button type="button" role="tab" aria-selected="false" className="ws-tab">
                New
              </button>
              <button type="button" role="tab" aria-selected="false" className="ws-tab">
                Used
              </button>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Live Preview" hint="editor iframe only">
        <Frame padded>
          <div className="ws-page">
            <div className="website-dev-stack">
              <div className="ws-preview-target">
                <span className="ws-preview-target-label" aria-hidden="true">
                  Hero
                </span>
                <p className="ws-muted">Hover for the outline.</p>
              </div>
              <div className="ws-preview-target ws-preview-target--selected">
                <span className="ws-preview-target-label" aria-hidden="true">
                  Contact
                </span>
                <p className="ws-muted">Selected.</p>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Hero & trust bar" size="wide">
        <Frame>
          <div className="ws-page">
            <section className="ws-hero">
              <div className="ws-container ws-hero-inner">
                <div className="ws-hero-copy">
                  <div className="ws-hero-intro">
                    <span className="ws-eyebrow">Suzuki &amp; Mitsubishi · West Malling, Kent</span>
                    <h3 className="ws-h1">Family-run in Kent since 1947</h3>
                    <p className="ws-lead">New and used cars, servicing, MOTs and fair valuations.</p>
                    <div className="ws-hero-ctas">
                      <a href="#stock" className="ws-btn ws-btn--primary">
                        Browse cars
                      </a>
                      <a href="#contact" className="ws-btn ws-btn--ghost">
                        Book a service
                      </a>
                    </div>
                  </div>
                  {/* Mirrors QuickActions: three large choices over the panel. */}
                  <div className="ws-quick">
                    <div className="ws-quick-choices" role="tablist" aria-label="Showcase customer actions">
                      <button type="button" role="tab" aria-selected="true" className="ws-quick-choice ws-quick-choice--active">
                        <span className="ws-icon-badge">
                          <WebsiteIcon name="search" />
                        </span>
                        <span className="ws-quick-choice-text">
                          <span className="ws-quick-choice-label">Find a car</span>
                          <span className="ws-quick-choice-hint">New &amp; used stock</span>
                        </span>
                      </button>
                      <button type="button" role="tab" aria-selected="false" className="ws-quick-choice">
                        <span className="ws-icon-badge">
                          <WebsiteIcon name="wrench" />
                        </span>
                        <span className="ws-quick-choice-text">
                          <span className="ws-quick-choice-label">Book workshop</span>
                          <span className="ws-quick-choice-hint">Service, MOT &amp; repairs</span>
                        </span>
                      </button>
                      <button type="button" role="tab" aria-selected="false" className="ws-quick-choice">
                        <span className="ws-icon-badge">
                          <WebsiteIcon name="pound" />
                        </span>
                        <span className="ws-quick-choice-text">
                          <span className="ws-quick-choice-label">Value my car</span>
                          <span className="ws-quick-choice-hint">Free instant estimate</span>
                        </span>
                      </button>
                    </div>
                    <div className="ws-card ws-panel ws-quick-panel">
                      <div className="ws-quick-view-head">
                        <h4 className="ws-quick-view-title">Search our stock</h4>
                        <p className="ws-quick-view-lead">40 new and used cars ready to view in West Malling.</p>
                      </div>
                      <form className="ws-quick-form" onSubmit={(e) => e.preventDefault()}>
                        <div className="ws-quick-fields">
                          <label className="ws-stock-field">
                            <span className="ws-stock-label">Condition</span>
                            <input type="text" placeholder="New &amp; used" readOnly />
                          </label>
                          <label className="ws-stock-field">
                            <span className="ws-stock-label">Make</span>
                            <input type="text" placeholder="Any make" readOnly />
                          </label>
                          <label className="ws-stock-field">
                            <span className="ws-stock-label">Model</span>
                            <input type="text" placeholder="Any model" readOnly />
                          </label>
                          <label className="ws-stock-field">
                            <span className="ws-stock-label">Price</span>
                            <input type="text" placeholder="Any price" readOnly />
                          </label>
                        </div>
                        <button type="submit" className="ws-btn ws-btn--primary">Search cars</button>
                      </form>
                    </div>
                  </div>
                </div>
                {PHOTO ? (
                  <div className="ws-hero-media">
                    <img src={PHOTO} alt="Forecourt" />
                    <div className="ws-hero-proof">
                      <a href="#marketing" className="ws-hero-proof-item">
                        <span className="ws-icon-badge">
                          <WebsiteIcon name="star" />
                        </span>
                        <span className="ws-hero-proof-text">
                          <span className="ws-hero-proof-title">5.0</span>
                          <span className="ws-hero-proof-note">97 verified reviews</span>
                        </span>
                      </a>
                      <a href="#marketing" className="ws-hero-proof-item">
                        <span className="ws-icon-badge">
                          <WebsiteIcon name="pin" />
                        </span>
                        <span className="ws-hero-proof-text">
                          <span className="ws-hero-proof-title">West Malling, Kent</span>
                          <span className="ws-hero-proof-note">120 London Road · Open Mon–Sat</span>
                        </span>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="ws-container">
                <ul className="ws-trust">
                  <li className="ws-trust-item">
                    <span className="ws-icon-badge">
                      <WebsiteIcon name="family" />
                    </span>
                    <span className="ws-trust-text">
                      <span className="ws-trust-value">Since 1947</span>
                      <span className="ws-trust-label">Family-run in Kent</span>
                    </span>
                  </li>
                  <li className="ws-trust-item">
                    <span className="ws-icon-badge">
                      <WebsiteIcon name="inspect" />
                    </span>
                    <span className="ws-trust-text">
                      <span className="ws-trust-value">120-point</span>
                      <span className="ws-trust-label">Inspection on every car</span>
                    </span>
                  </li>
                  <li className="ws-trust-item">
                    <span className="ws-icon-badge">
                      <WebsiteIcon name="award" />
                    </span>
                    <span className="ws-trust-text">
                      <span className="ws-trust-value">Award-winning</span>
                      <span className="ws-trust-label">AutoTrader Retailer Awards</span>
                    </span>
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Headings" hint="tinted section" size="md">
        <Frame>
          <div className="ws-page">
            <section className="ws-section ws-section--tint">
              <div className="ws-container">
                <header className="ws-head ws-head--center">
                  <span className="ws-eyebrow">Centred</span>
                  <h3 className="ws-h2">A section heading</h3>
                  <p className="ws-lead">A lead paragraph under the heading.</p>
                </header>
                <header className="ws-head">
                  <span className="ws-eyebrow">Left</span>
                  <h3 className="ws-h2">Left-aligned heading</h3>
                  <p className="ws-muted">Muted body copy.</p>
                </header>
                <div className="ws-subhead">
                  <h4 className="ws-h3">A sub-heading</h4>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Quick actions" hint="value my car result" size="wide">
        <Frame>
          <div className="ws-page">
            <section className="ws-section">
              <div className="ws-container">
                {/* The hero trust card as it sits when the hero has no photo. */}
                <div className="ws-hero-proof ws-hero-proof--inline">
                  <a href="#marketing" className="ws-hero-proof-item">
                    <span className="ws-icon-badge">
                      <WebsiteIcon name="pin" />
                    </span>
                    <span className="ws-hero-proof-text">
                      <span className="ws-hero-proof-title">West Malling, Kent</span>
                      <span className="ws-hero-proof-note">Trust card without a photo</span>
                    </span>
                  </a>
                </div>
                <div className="ws-card ws-panel ws-quick-panel">
                  <div className="ws-quick-views">
                    <div className="ws-quick-view" data-active="false" inert>
                      <div className="ws-quick-view-head">
                        <h4 className="ws-quick-view-title">What is my car worth?</h4>
                        <p className="ws-quick-view-lead">Enter your registration for a free rough estimate.</p>
                      </div>
                      <form className="ws-quick-form" onSubmit={(e) => e.preventDefault()}>
                        <label className="ws-stock-field">
                          <span className="ws-stock-label">Registration</span>
                          <input type="text" className="ws-reg-input" placeholder="AB12 CDE" readOnly />
                        </label>
                        <label className="ws-stock-field">
                          <span className="ws-stock-label">Mileage</span>
                          <input type="text" inputMode="numeric" placeholder="e.g. 45,000" readOnly />
                        </label>
                        <button type="submit" className="ws-btn ws-btn--primary">Get estimate</button>
                      </form>
                    </div>
                    <div className="ws-quick-view" data-active="true">
                      <div className="ws-quick-result">
                        <div className="ws-quick-result-head">
                          <span className="ws-val-plate">AB12 CDE</span>
                          <p className="ws-quick-result-range">£6,200 – £7,300</p>
                        </div>
                        <p className="ws-muted">A rough guide for a 2019 Suzuki in good condition with 45,000 miles.</p>
                        <div className="ws-quick-actions">
                          <a href="#top" className="ws-btn ws-btn--ghost">Improve my estimate</a>
                          <button type="button">Value another car</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Card grid" hint="VehicleCard · offer · blog" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid ws-grid--cards">
              {staticVehicle ? <VehicleCard vehicle={{ ...staticVehicle, href: null, badge: "Reduced" }} /> : null}
              {/* The real offer card: photo + badge, manufacturer, title,
                  headline figure, copy, expiry and View offer. */}
              {offers[0] ? <OfferCard offer={offers[0]} /> : null}
              <article className="ws-card">
                <div className="ws-blog-media">{PHOTO ? <img src={PHOTO} alt="Blog" /> : null}</div>
                <div className="ws-card-body">
                  <h3 className="ws-card-title">Legacy blog card</h3>
                  <p className="ws-muted">Still read by the single-scroll page.</p>
                </div>
              </article>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Tick list" hint=".ws-ticks" size="md">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-panel">
              <ul className="ws-ticks">
                <li>Same-day payment</li>
                <li>No admin fees</li>
              </ul>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Sell Your Car" hint="compact steps · valuation lead form · compact benefits" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-sell-layout">
              <div className="ws-sell-intro">
                <header className="ws-head">
                  <span className="ws-eyebrow">Sell Your Car</span>
                  <h3 className="ws-h2">Sell to us in three simple steps</h3>
                </header>
                <ol className="ws-steps-compact">
                  {(siteContent.sellYourCar.steps || []).map((s) => (
                    <li key={s.n} className="ws-step-compact">
                      <span className="ws-step-compact-n" aria-hidden="true">
                        {s.n}
                      </span>
                      <div>
                        <h4 className="ws-card-title">{s.title}</h4>
                        <p className="ws-muted">{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <SellValuationPanel />
            </div>
            <div className="ws-section-block">
              <BenefitCards items={siteContent.sellYourCar.benefitCards} compact headingLevel={4} />
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Service & Parts" hint="action cards · booking panel · highlights" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-service-layout">
              <BenefitCards
                headingLevel={4}
                items={(siteContent.serviceAndParts.services || []).map((s) => ({ ...s, href: s.href || "#marketing" }))}
              />
              <WorkshopBookingPanel services={siteContent.serviceAndParts.services} body="Tell us what you need.">
                <HoursTable caption="Service hours" />
              </WorkshopBookingPanel>
            </div>
            <div className="ws-section-block ws-service-highlights">
              <div className="ws-split-media">{PHOTO ? <img src={PHOTO} alt="Workshop" /> : null}</div>
              <BenefitCards items={siteContent.serviceAndParts.highlights} compact headingLevel={4} />
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Motability" hint="vehicle cards · fallback media · specialist panel" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid ws-grid--models">
              {(siteContent.motability.models || []).slice(0, 3).map((m) => (
                <MotabilityModelCard key={m.id} model={m} />
              ))}
              <MotabilityModelCard
                model={{ brand: "Suzuki", model: "No photo yet", powertrain: "Hybrid", automatic: "Automatic available", advancePayment: "£0" }}
              />
            </div>
            <div className="ws-section-block ws-card ws-panel ws-specialist">
              <ul className="ws-specialist-photos" aria-label="Showcase team">
                {team
                  .filter((m) => m.photo)
                  .slice(0, 4)
                  .map((m) => (
                    <li key={m.id} className="ws-specialist-photo">
                      <img src={m.photo} alt={m.name} />
                    </li>
                  ))}
              </ul>
              <div className="ws-specialist-copy">
                <span className="ws-eyebrow">Motability specialists</span>
                <h4 className="ws-h3">Talk it through with a specialist</h4>
                <p className="ws-muted">.ws-specialist pairs team imagery with the call to action.</p>
                <p className="ws-price-line">From £299 per month</p>
                <div className="ws-specialist-actions">
                  <a href="#marketing" className="ws-btn ws-btn--primary">
                    <WebsiteIcon name="phone" />
                    Speak to a specialist
                  </a>
                  <a href="#marketing" className="ws-btn ws-btn--ghost">
                    Visit the showroom
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Split, hours & chips" size="md">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-split">
              <div className="ws-split-media">{PHOTO ? <img src={PHOTO} alt="Workshop" /> : null}</div>
              <div className="ws-card ws-panel ws-split-text">
                <span className="ws-eyebrow">About us</span>
                <h3 className="ws-h2">Four generations</h3>
                <p className="ws-muted">The first paragraph gets extra top spacing.</p>
                <HoursTable caption="Service hours" />
                <ul className="ws-chips">
                  <li className="ws-chip">Swift</li>
                  <li className="ws-chip">Vitara</li>
                </ul>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="About" hint=".ws-about · compact BenefitCards beside the team photo" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-split ws-about">
              <div className="ws-card ws-panel ws-split-text ws-about-copy">
                <header className="ws-head">
                  <span className="ws-eyebrow">{siteContent.about.eyebrow}</span>
                  <h3 className="ws-h2">{siteContent.about.title}</h3>
                </header>
                <p className="ws-muted">{siteContent.about.body[0]}</p>
                <BenefitCards items={siteContent.about.highlights} compact />
              </div>
              <div className="ws-split-media">
                {siteContent.about.imageUrl ? <img src={siteContent.about.imageUrl} alt="The team" /> : null}
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Timeline" hint="HistoryTimeline · rail on desktop, vertical on a phone" size="wide">
        <Frame padded>
          <div className="ws-page">
            <HistoryTimeline
              milestones={[
                ...timeline.slice(0, 1).map((t) => ({ ...t, image: PHOTO, imageAlt: "Period photograph" })),
                ...timeline.slice(1),
              ]}
            />
          </div>
        </Frame>
      </Row>

      <Row label="Reviews" hint="ReviewsPanel · overall + platforms · filters · carousel" size="wide">
        <Frame padded>
          <div className="ws-page">
            <ReviewsPanel
              ratings={siteContent.ratings}
              reviews={reviews}
              topics={reviewTopics}
              team={team}
              reviewCta={siteContent.reviewCta}
              featuredLimit={FEATURED_REVIEW_LIMIT}
            />
          </div>
        </Frame>
      </Row>

      <Row label="Our promise & visit CTA" hint=".ws-promise · VisitCta" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-promise">
              <div className="ws-promise-head">
                <span className="ws-eyebrow">{siteContent.promise.eyebrow}</span>
                <h3 className="ws-h3">{siteContent.promise.title}</h3>
              </div>
              <BenefitCards items={siteContent.promise.items} headingLevel={4} />
            </div>
            <VisitCta visit={siteContent.contact.visit} />
          </div>
        </Frame>
      </Row>

      <Row label="Team" size="md">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-team-groups">
            <div className="ws-team-group">
              <h3 className="ws-h3">Sales</h3>
              <div className="ws-grid ws-grid--team">
                {["Alex Parks", "Jordan Humphries"].map((name) => (
                  <article key={name} className="ws-card ws-member">
                    <div className="ws-member-photo">{PHOTO ? <img src={PHOTO} alt={name} /> : null}</div>
                    <div className="ws-card-body">
                      <h4 className="ws-card-title">{name}</h4>
                      <span className="ws-muted">Sales executive</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Info cards & page layout" hint=".ws-page-split · .ws-grid--info · .ws-info-list · .ws-jump-links" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-page-split">
              <div className="ws-page-main">
                <div className="ws-card ws-panel ws-info-card">
                  <h3 className="ws-card-title">At a glance</h3>
                  <dl className="ws-info-list">
                    {[
                      ["Data controller", "Humphries & Parks Limited"],
                      ["Do we sell your data?", "Never"],
                      ["Rights requests", "Answered within one month"],
                    ].map(([label, value]) => (
                      <div key={label} className="ws-info-item">
                        <dt className="ws-info-label">{label}</dt>
                        <dd className="ws-info-value">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="ws-grid ws-grid--info">
                  {["Who we are", "Information we collect"].map((title) => (
                    <section key={title} className="ws-card ws-panel ws-info-card">
                      <h3 className="ws-card-title">{title}</h3>
                      <p className="ws-muted">Each topic is its own card, packed across the width.</p>
                    </section>
                  ))}
                  <section className="ws-card ws-panel ws-info-card ws-info-card--wide">
                    <h3 className="ws-card-title">Wide card</h3>
                    <p className="ws-muted">.ws-info-card--wide spans the whole grid row.</p>
                  </section>
                </div>
              </div>
              <aside className="ws-page-aside">
                <nav className="ws-card ws-panel ws-info-card" aria-label="Showcase contents">
                  <h3 className="ws-card-title">On this page</h3>
                  <ul className="ws-jump-links">
                    {["Who we are", "Information we collect", "Your rights"].map((label) => (
                      <li key={label}>
                        <a href="#marketing" className="ws-jump-link">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </aside>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Footer" hint="WebsiteFooter · every /website page" size="wide">
        <Frame>
          <div className="ws-page">
            <WebsiteFooter
              brand={siteContent.brand}
              contact={siteContent.contact}
              footer={siteContent.footer}
              brands={brands}
              links={siteContent.customerLinks}
            />
          </div>
        </Frame>
      </Row>

      <Row label="Contact & hours" size="wide">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-contact">
              <div className="ws-card ws-panel ws-contact-details">
                <div className="ws-contact-block">
                  <span className="ws-eyebrow">Call us</span>
                  <a href="tel:01732870711" className="ws-contact-phone">
                    01732 870711
                  </a>
                </div>
                <div className="ws-contact-block">
                  <span className="ws-eyebrow">Visit us</span>
                  <address className="ws-contact-address">
                    <span>London Road</span>
                    <span>Kent</span>
                  </address>
                </div>
                <div className="ws-contact-block ws-contact-block--wide">
                  <span className="ws-eyebrow">Opening times</span>
                  <div className="ws-contact-hours">
                    <HoursTable caption="Sales" />
                    <HoursTable caption="Service" />
                  </div>
                </div>
                <div className="ws-socials">
                  <a href="#contact" className="ws-btn ws-btn--ghost">
                    Facebook
                  </a>
                  <a href="#contact" className="ws-btn ws-btn--ghost">
                    Instagram
                  </a>
                </div>
              </div>
              <div className="ws-card ws-contact-map">
                <div className="ws-card-body">
                  <p className="ws-muted">The live page embeds a map here.</p>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
