// file location: src/features/website/showcase/sections/MarketingShowcase.js
//
// /website/dev — @family marketing (the .ws-* page behind /website) and
// @family preview (the Live Preview editor outlines). Markup mirrors
// src/features/website/WebsitePage.js; VehicleCard and BrandLogo are the real
// shared components. Every preview sits inside .ws-page, which owns the page
// tokens (--ws-card, --ws-line, --ws-radius, ...).

import BrandLogo from "@/components/BrandLogo";
import VehicleCard from "@/features/website/components/VehicleCard";
import { brands } from "@/features/website/data/brands";
import { vehicles } from "@/features/website/data/vehicles";
import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const PHOTO = vehicles.find((vehicle) => vehicle.image)?.image || null;

const HOURS = [
  ["Monday – Friday", "8:30am – 5:30pm"],
  ["Saturday", "9:00am – 1:00pm"],
  ["Sunday", "Closed"],
];

function Stars({ rating }) {
  return (
    <span className="ws-stars" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "ws-star ws-star--on" : "ws-star"}>
          ★
        </span>
      ))}
    </span>
  );
}

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
  const [firstVehicle, secondVehicle] = vehicles;

  return (
    <ShowcaseSection id="marketing" section={section}>
      <Row label="Navigation" note=".ws-nav · links · phone · account · menu toggle (≤640px)">
        <Frame>
          <div className="ws-page">
            <header className="ws-nav">
              <div className="ws-nav-inner">
                <a href="#marketing" className="ws-brand">
                  <BrandLogo className="ws-logo" alt="Humphries and Parks" />
                </a>
                <nav className="ws-nav-links" aria-label="Showcase primary">
                  <a href="#marketing" className="ws-nav-link ws-nav-link--active">
                    Home
                  </a>
                  <a href="#stock" className="ws-nav-link">
                    Cars
                  </a>
                  <a href="#parts" className="ws-nav-link">
                    Parts
                  </a>
                  <a href="#valuation" className="ws-nav-link">
                    Sell your car
                  </a>
                </nav>
                <button type="button" className="ws-nav-toggle">
                  Menu
                </button>
                <div className="ws-nav-actions">
                  <button type="button" className="ws-nav-account ws-nav-dev">
                    Dev
                  </button>
                  <button type="button" className="ws-nav-account ws-nav-dev ws-nav-dev--on" aria-pressed="true">
                    Overlay
                  </button>
                  <a href="tel:01732870711" className="ws-nav-phone">
                    01732 870711
                  </a>
                  <a href="#auth" className="ws-nav-account ws-nav-account--profile">
                    Account
                  </a>
                </div>
              </div>
            </header>
          </div>
        </Frame>
      </Row>

      <Row label="Mobile menu, open" note=".ws-nav-links--open (drops down at ≤640px)">
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

      <Row label="Shop navigation" note=".ws-nav--shop · .ws-nav-actions">
        <Frame>
          <div className="ws-page">
            <header className="ws-nav ws-nav--shop">
              <div className="ws-nav-inner">
                <a href="#shop" className="ws-brand">
                  <BrandLogo className="ws-logo" alt="Humphries and Parks" />
                </a>
                <nav className="ws-nav-links" aria-label="Showcase shop">
                  <a href="#parts" className="ws-nav-link ws-nav-link--active">
                    Parts catalogue
                  </a>
                  <a href="#shop" className="ws-nav-link">
                    Accessories
                  </a>
                </nav>
                <div className="ws-nav-actions">
                  <button type="button" className="ws-shop-cartbutton">
                    Basket
                    <span className="ws-shop-cartbutton-count">2</span>
                  </button>
                  <a href="#auth" className="ws-nav-account">
                    Sign in
                  </a>
                </div>
              </div>
            </header>
          </div>
        </Frame>
      </Row>

      <Row label="Logo" note="BrandLogo follows data-website-theme — its wordmark text turns white on the dark theme">
        <Frame padded>
          <div className="ws-page">
            <div className="website-dev-cluster">
              <BrandLogo className="ws-logo" alt="Humphries and Parks" />
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Hero and trust bar" note=".ws-hero · .ws-trust">
        <Frame>
          <div className="ws-page">
            <section className="ws-hero">
              <div className="ws-container ws-hero-inner">
                <div>
                  <span className="ws-eyebrow">Since 1947</span>
                  <h3 className="ws-h1">Family-run Suzuki and Mitsubishi dealer</h3>
                  <p className="ws-lead">New and used cars, servicing, MOTs and genuine parts in Kent.</p>
                  <div className="ws-hero-ctas">
                    <a href="#stock" className="ws-btn ws-btn--primary">
                      Browse cars
                    </a>
                    <a href="#contact" className="ws-btn ws-btn--ghost">
                      Book a service
                    </a>
                  </div>
                </div>
                {PHOTO ? (
                  <div className="ws-hero-media">
                    <img src={PHOTO} alt="Forecourt" />
                  </div>
                ) : null}
              </div>
              <div className="ws-container">
                <ul className="ws-trust">
                  <li className="ws-trust-item">
                    <span className="ws-trust-value">4.9</span>
                    <span className="ws-trust-label">Google rating</span>
                  </li>
                  <li className="ws-trust-item">
                    <span className="ws-trust-value">75+</span>
                    <span className="ws-trust-label">Years trading</span>
                  </li>
                  <li className="ws-trust-item">
                    <span className="ws-trust-value">120</span>
                    <span className="ws-trust-label">Cars in stock</span>
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Sections and headings" note=".ws-section · --tint · .ws-head · --center · .ws-subhead">
        <Frame>
          <div className="ws-page">
            <section className="ws-section ws-section--tint">
              <div className="ws-container">
                <header className="ws-head ws-head--center">
                  <span className="ws-eyebrow">Centred head</span>
                  <h3 className="ws-h2">A section heading</h3>
                  <p className="ws-lead">A lead paragraph under the heading, held to a readable measure.</p>
                </header>
                <header className="ws-head">
                  <span className="ws-eyebrow">Left head</span>
                  <h3 className="ws-h2">Left-aligned heading</h3>
                  <p className="ws-muted">Muted body copy for supporting detail.</p>
                </header>
                <div className="ws-subhead">
                  <h4 className="ws-h3">A sub-heading</h4>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Brand strip" note=".ws-brands-inner · -label · -list">
        <Frame>
          <div className="ws-page">
            <section className="ws-section">
              <div className="ws-container ws-brands-inner">
                <span className="ws-brands-label">Authorised retailer for</span>
                <ul className="ws-brands-list">
                  {brands.map((brand) => (
                    <li key={brand.name}>
                      <img src={brand.logo} alt={brand.name} loading="lazy" />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Buttons and tabs" note=".ws-btn--primary · --ghost · .ws-tabs">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-hero-ctas">
              <a href="#marketing" className="ws-btn ws-btn--primary">
                Primary CTA
              </a>
              <a href="#marketing" className="ws-btn ws-btn--ghost">
                Ghost CTA
              </a>
            </div>
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

      <Row label="Card grid" note="VehicleCard (linked and static) · offer · legacy blog media · .ws-badge">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid ws-grid--cards">
              {firstVehicle ? <VehicleCard vehicle={firstVehicle} /> : null}
              {secondVehicle ? <VehicleCard vehicle={{ ...secondVehicle, href: null, badge: "Reduced" }} /> : null}
              <article className="ws-card">
                <div className="ws-offer-media">
                  {PHOTO ? <img src={PHOTO} alt="Offer" /> : null}
                  <span className="ws-badge">Offer</span>
                </div>
                <div className="ws-card-body">
                  <span className="ws-eyebrow">Servicing</span>
                  <h3 className="ws-card-title">Fixed-price service plans</h3>
                  <p className="ws-muted">Spread the cost with a monthly plan.</p>
                </div>
              </article>
              <article className="ws-card">
                <div className="ws-blog-media">{PHOTO ? <img src={PHOTO} alt="Blog" /> : null}</div>
                <div className="ws-card-body">
                  <h3 className="ws-card-title">Legacy blog media</h3>
                  <p className="ws-muted">.ws-blog-media is still read by the single-scroll page.</p>
                </div>
              </article>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Steps and sell panel" note=".ws-grid--steps · .ws-step · .ws-panel · .ws-sell-panel · .ws-ticks">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-grid ws-grid--steps">
              {["Tell us about it", "Get a valuation", "Get paid"].map((title, index) => (
                <article key={title} className="ws-card ws-step">
                  <span className="ws-step-n">{`0${index + 1}`}</span>
                  <h3 className="ws-card-title">{title}</h3>
                  <p className="ws-muted">A short line explaining this step.</p>
                </article>
              ))}
            </div>
            <div className="ws-card ws-panel ws-sell-panel">
              <ul className="ws-ticks">
                <li>Same-day payment</li>
                <li>Settlement handled for you</li>
                <li>No admin fees</li>
              </ul>
              <a href="#valuation" className="ws-btn ws-btn--primary">
                Value my car
              </a>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Split layouts and range" note=".ws-split · --reverse · .ws-split-side · .ws-range · .ws-chips · .ws-price-line">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-split">
              <div className="ws-split-media">{PHOTO ? <img src={PHOTO} alt="Workshop" /> : null}</div>
              <div className="ws-split-text">
                <span className="ws-eyebrow">About us</span>
                <h3 className="ws-h2">Four generations on the same forecourt</h3>
                <p className="ws-muted">The first muted paragraph gets extra top spacing.</p>
                <p className="ws-muted">Following paragraphs keep the standard rhythm.</p>
              </div>
            </div>
            <div className="ws-split ws-split--reverse">
              <div className="ws-split-text">
                <span className="ws-eyebrow">Motability</span>
                <h3 className="ws-h2">Worry-free motoring</h3>
                <p className="ws-price-line">From £0 advance payment</p>
              </div>
              <div className="ws-split-side">
                <div className="ws-card ws-range">
                  <h3 className="ws-card-title">Suzuki</h3>
                  <ul className="ws-chips">
                    <li className="ws-chip">Swift</li>
                    <li className="ws-chip">Vitara</li>
                    <li className="ws-chip">S-Cross</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Timeline" note=".ws-timeline · .ws-milestone">
        <Frame padded>
          <div className="ws-page">
            <ol className="ws-timeline">
              {[
                ["1947", "First forecourt"],
                ["1985", "Suzuki franchise"],
                ["2020", "Mitsubishi joins"],
              ].map(([year, title]) => (
                <li key={year} className="ws-card ws-milestone">
                  <span className="ws-milestone-year">{year}</span>
                  <h4 className="ws-card-title">{title}</h4>
                  <p className="ws-muted">A line of history.</p>
                </li>
              ))}
            </ol>
          </div>
        </Frame>
      </Row>

      <Row label="Reviews" note=".ws-ratings · .ws-rating · .ws-stars · .ws-grid--reviews · .ws-review">
        <Frame padded>
          <div className="ws-page">
            <ul className="ws-ratings">
              <li className="ws-rating">
                <span className="ws-rating-score">4.9</span>
                <Stars rating={5} />
                <span className="ws-muted">Google</span>
              </li>
              <li className="ws-rating">
                <span className="ws-rating-score">4.7</span>
                <Stars rating={4} />
                <span className="ws-muted">AutoTrader</span>
              </li>
            </ul>
            <div className="ws-grid ws-grid--reviews">
              <article className="ws-card ws-review">
                <Stars rating={5} />
                <p className="ws-review-quote">“Friendly, honest and the car was spotless on collection.”</p>
                <div className="ws-review-meta">
                  <span className="ws-review-name">Sarah K.</span>
                  <span className="ws-muted">Swift Hybrid · Google</span>
                </div>
              </article>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Team" note=".ws-team-group · .ws-grid--team · .ws-member · .ws-member-photo">
        <Frame padded>
          <div className="ws-page">
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
        </Frame>
      </Row>

      <Row label="Contact and hours" note=".ws-contact · .ws-contact-* · .ws-hours · .ws-socials">
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
                <div className="ws-contact-block">
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
                  <p className="ws-muted">The live page embeds a map iframe here.</p>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Footer" note=".ws-footer · -inner · -top · -links · -legal · -copy">
        <Frame>
          <div className="ws-page">
            <footer className="ws-footer">
              <div className="ws-container ws-footer-inner">
                <div className="ws-footer-top">
                  <BrandLogo className="ws-logo" alt="Humphries and Parks" />
                  <ul className="ws-footer-links">
                    <li>
                      <a href="#marketing">Privacy</a>
                    </li>
                    <li>
                      <a href="#marketing">Cookies</a>
                    </li>
                  </ul>
                </div>
                <p className="ws-footer-legal">Authorised and regulated by the Financial Conduct Authority.</p>
                <p className="ws-footer-copy">© 2026 Humphries and Parks</p>
              </div>
            </footer>
          </div>
        </Frame>
      </Row>

      <Row label="Live Preview editor" note="@family preview · staff editor iframe only">
        <Frame padded>
          <div className="ws-page">
            <div className="website-dev-choice-list">
              <div className="ws-preview-target">
                <span className="ws-preview-target-label" aria-hidden="true">
                  Hero (hover)
                </span>
                <p className="ws-muted">Hover to see the dashed outline and label.</p>
              </div>
              <div className="ws-preview-target ws-preview-target--selected">
                <span className="ws-preview-target-label" aria-hidden="true">
                  Contact · selected
                </span>
                <p className="ws-muted">The selected region keeps a solid outline.</p>
              </div>
            </div>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
