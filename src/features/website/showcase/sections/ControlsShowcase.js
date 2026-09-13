// file location: src/features/website/showcase/sections/ControlsShowcase.js
//
// /website/dev — @family controls (form side) and @family banner. One example
// per control: every text-like input type shares the same rule, so one text
// box stands for all of them. Native date / time inputs and the raw <select>
// are not shown — customer pages use WebsiteNativeDateTimeInput and
// WebsiteNativeSelect (see Selects and Date & time).

import { useState } from "react";
import { Row, ShowcaseSection } from "../ShowcasePrimitives";

export default function ControlsShowcase({ section }) {
  const [text, setText] = useState("Michael Rose");
  const [notes, setNotes] = useState("I would like to book my car in for its annual service next week.");
  const [tier, setTier] = useState("standard");

  return (
    <ShowcaseSection id="controls" section={section}>
      <Row label="Text box" hint="input · placeholder">
        <div className="website-dev-field">
          <label htmlFor="dev-text">Name</label>
          <input id="dev-text" type="text" value={text} onChange={(event) => setText(event.target.value)} />
          <input type="text" placeholder="Registration" aria-label="Registration" />
        </div>
      </Row>

      <Row label="Textarea" hint="grows by line">
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Tell us about your enquiry"
          aria-label="Enquiry"
          rows={1}
        />
      </Row>

      <Row label="Radio group">
        <div className="website-dev-choice-list">
          {[
            { value: "standard", label: "Standard service" },
            { value: "premium", label: "Premium service" },
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

      <Row label="Checkbox" hint=".ws-consent-option">
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
      </Row>

      <Row label="File picker">
        <input type="file" aria-label="Upload a file" />
      </Row>

      <Row label="Banner" hint=".website-banner">
        <div className="website-banner">
          <strong>MOT due 18 June.</strong>
          <span>Book before the deadline.</span>
        </div>
      </Row>
    </ShowcaseSection>
  );
}
