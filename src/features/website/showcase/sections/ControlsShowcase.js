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
        </div>
      </Row>

      <Row
        label="Typing assistant"
        hint="GlobalTypingAssist · click into the Textarea below and type to try it"
        note=".website-typing-assist · __mark--spelling · __mark--grammar · __ghost · __hint · -popover"
        size="wide"
      >
        <div className="website-dev-context-pair">
          <div className="website-typing-assist website-dev-typing-static" aria-hidden="true">
            {"Please "}
            <span className="website-typing-assist__mark website-typing-assist__mark--spelling">recieve</span>
            {" the "}
            <span className="website-typing-assist__mark website-typing-assist__mark--spelling is-active">color</span>
            {" samples for "}
            <span className="website-typing-assist__mark website-typing-assist__mark--grammar">a MOT</span>
            {". Kind "}
            <span className="website-typing-assist__ghost">regards</span>
            <kbd className="website-typing-assist__hint">Tab</kbd>
          </div>
          <div
            role="dialog"
            aria-label="Spelling suggestions"
            className="website-typing-assist-popover website-dev-typing-static is-visible"
          >
            <div className="website-typing-assist-popover__head">
              <span className="website-typing-assist-popover__kind website-typing-assist-popover__kind--spelling">UK spelling</span>
              <span className="website-typing-assist-popover__message">Use the UK English spelling.</span>
            </div>
            <div className="website-typing-assist-popover__suggestions" role="listbox" aria-label="Suggestions">
              <button type="button" role="option" aria-selected="true" className="website-typing-assist-popover__suggestion is-highlighted">
                colour
              </button>
              <button type="button" role="option" aria-selected="false" className="website-typing-assist-popover__suggestion">
                colours
              </button>
            </div>
            <span className="website-typing-assist-popover__empty">No suggestions</span>
            <div className="website-typing-assist-popover__actions">
              <button type="button" className="website-typing-assist-popover__action">
                Ignore
              </button>
              <button type="button" className="website-typing-assist-popover__action">
                Add to dictionary
              </button>
            </div>
          </div>
        </div>
      </Row>

      <Row label="Registration box" hint=".ws-reg-input · text box + plate lettering">
        <div className="website-dev-field">
          <label htmlFor="dev-reg">Registration</label>
          <input id="dev-reg" type="text" className="ws-reg-input" placeholder="AB12 CDE" defaultValue="ab12 cde" />
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

      <Row label="Textarea — one line" hint={'wrap="off" · 44px · scrolls sideways'}>
        <textarea
          rows={1}
          wrap="off"
          defaultValue="Service, MOT, a warning light, a noise from the front when braking at low speed"
          aria-label="What do you need?"
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
