// file location: src/features/website/showcase/sections/ControlsShowcase.js
//
// /website/dev — @family controls and @family banner: the two button styles and
// every raw element custglobal.css styles. These are intentionally raw elements
// (<button>, <input>, <select>, <textarea>) because that is what the customer
// stylesheet targets.

import { useState } from "react";
import { Row, ShowcaseSection, Stage } from "../ShowcasePrimitives";

export default function ControlsShowcase({ section }) {
  const [text, setText] = useState("Michael Rose");
  const [notes, setNotes] = useState("I would like to book my car in for its annual service next week.");
  const [tier, setTier] = useState("standard");
  const [nativeChoice, setNativeChoice] = useState("mot");

  return (
    <ShowcaseSection id="controls" section={section}>
      <Row label="Primary action" note=".app-btn · the one real action per view">
        <div className="website-dev-cluster">
          <button type="button" className="app-btn">
            Continue
          </button>
          <a href="#controls" className="app-btn">
            Link as primary
          </a>
          <button type="button" className="app-btn" disabled>
            Disabled
          </button>
        </div>
      </Row>

      <Row label="Secondary action" note="raw <button> and [role=button]">
        <div className="website-dev-cluster">
          <button type="button">Reschedule</button>
          <span role="button" tabIndex={0}>
            Role button
          </span>
          <button type="button" disabled>
            Disabled
          </button>
        </div>
      </Row>

      <Row label="Text fields" note="text · email · password · tel · number · search · url">
        <form className="website-dev-form" onSubmit={(event) => event.preventDefault()}>
          <label className="authLabel" htmlFor="dev-text">
            Name
          </label>
          <input id="dev-text" type="text" value={text} onChange={(event) => setText(event.target.value)} />
          <input type="email" placeholder="you@example.com" autoComplete="off" />
          <input type="password" placeholder="Password" />
          <input type="tel" placeholder="Mobile number" />
          <input type="number" placeholder="Mileage" />
          <input type="search" placeholder="Search stock" />
          <input type="url" placeholder="https://" />
        </form>
      </Row>

      <Row label="Native date & time" note='raw input type="date" / "time"'>
        <div className="website-dev-cluster">
          <div className="website-dev-control-width">
            <input type="date" defaultValue="2026-05-21" />
          </div>
          <div className="website-dev-control-width">
            <input type="time" defaultValue="09:30" />
          </div>
        </div>
      </Row>

      <Row label="Textarea" note="grows by line (field-sizing: content)">
        <textarea
          className="website-dev-wide-control"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Tell us about your enquiry"
          rows={1}
        />
      </Row>

      <Row label="Raw select" note="fallback only — live pages use WebsiteNativeSelect (Selects & Dropdowns)">
        <div className="website-dev-control-width">
          <select value={nativeChoice} onChange={(event) => setNativeChoice(event.target.value)}>
            <option value="service">Service booking</option>
            <option value="mot">MOT test</option>
            <option value="valuation">Vehicle valuation</option>
          </select>
        </div>
      </Row>

      <Row label="Radio group" note="the customer surface has no site-wide checkbox">
        <div className="website-dev-choice-list">
          {[
            { value: "standard", label: "Standard service" },
            { value: "premium", label: "Premium service" },
            { value: "motability", label: "Motability service" },
          ].map((option) => (
            <label key={option.value} className="website-dev-choice">
              <input
                type="radio"
                name="dev-tier"
                value={option.value}
                checked={tier === option.value}
                onChange={() => setTier(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </Row>

      <Row label="File input" note="::file-selector-button">
        <div className="website-dev-choice-list">
          <input type="file" />
          <input type="file" multiple />
        </div>
      </Row>

      <Row label="Banner" note=".website-banner · @family banner">
        <div className="website-banner">
          <strong>MOT due 18 June 2026.</strong>
          <span>Book before the deadline to avoid a re-test fee.</span>
        </div>
      </Row>

      <Row label="Cookie consent" note="CookieBanner on /website · .ws-consent (position: fixed) · customise view">
        <Stage>
          <div className="ws-consent" role="dialog" aria-label="Cookie consent preview">
            <h2 className="ws-consent-title">Cookies on this site</h2>
            <p className="ws-consent-text">
              We use essential cookies to make the site work. With your permission we&apos;d also like to use
              other cookies.
            </p>
            <div className="ws-consent-options">
              <label className="ws-consent-option" data-locked="true">
                <input type="checkbox" checked disabled readOnly />
                <span>
                  <span className="ws-consent-option-label">
                    Essential
                    <span className="ws-consent-option-flag">(always on)</span>
                  </span>
                  <span className="ws-consent-option-note">Required for the site to work.</span>
                </span>
              </label>
              <label className="ws-consent-option">
                <input type="checkbox" defaultChecked />
                <span>
                  <span className="ws-consent-option-label">Preferences</span>
                  <span className="ws-consent-option-note">Remember choices like theme.</span>
                </span>
              </label>
            </div>
            <div className="ws-consent-actions">
              <button type="button">Save Choices</button>
              <button type="button">Reject All</button>
              <button type="button" className="app-btn">
                Accept All
              </button>
            </div>
          </div>
        </Stage>
      </Row>

      <Row label="Report a problem" note=".ws-support-launcher (position: fixed, bottom-left) · raw <button>">
        <Stage>
          <div className="ws-support-launcher">
            <button type="button" className="ws-support-launcher__button">
              Report a problem
            </button>
          </div>
        </Stage>
      </Row>
    </ShowcaseSection>
  );
}
