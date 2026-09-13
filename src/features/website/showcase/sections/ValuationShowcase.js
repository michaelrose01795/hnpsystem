// file location: src/features/website/showcase/sections/ValuationShowcase.js
//
// /website/dev — @family valuation: the /website/valuation wizard. Markup
// mirrors src/features/website/valuation/ValuationPage.js and ValuationChoices.js.

import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

const STEPS = [
  { title: "Your vehicle", state: "done" },
  { title: "About it", state: "current" },
  { title: "Condition", state: "todo" },
  { title: "Estimate", state: "todo" },
];

export default function ValuationShowcase({ section }) {
  return (
    <ShowcaseSection id="valuation" section={section}>
      <Row label="Hero and progress" note=".ws-val-hero · .ws-val-steps · data-state">
        <Frame>
          <div className="ws-page">
            <section className="ws-section ws-val-hero">
              <div className="ws-container ws-val-container">
                <span className="ws-eyebrow">Sell your car</span>
                <h3 className="ws-h1">What is your car worth?</h3>
                <p className="ws-lead">Four quick steps to a guide price.</p>
              </div>
            </section>
            <section className="ws-section ws-val-body">
              <div className="ws-container ws-val-container">
                <div className="ws-val-progress">
                  <ol className="ws-val-steps">
                    {STEPS.map((step, index) => (
                      <li key={step.title} className="ws-val-step" data-state={step.state}>
                        <span className="ws-val-step-n" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="ws-val-step-label">{step.title}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="ws-val-progress-text">Step 2 of 4</p>
                </div>
              </div>
            </section>
          </div>
        </Frame>
      </Row>

      <Row label="Question panel" note=".ws-val-panel · -field · -label · -reg-row · -grid-2 · -manual">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-panel ws-val-panel">
              <h3 className="ws-h3">Your vehicle</h3>
              <p className="ws-val-hint">We look it up with the DVLA.</p>
              <div className="ws-val-field">
                <label className="ws-val-label" htmlFor="dev-val-reg">
                  Registration
                </label>
                <div className="ws-val-reg-row">
                  <input id="dev-val-reg" type="text" className="ws-val-reg" defaultValue="AB12 CDE" />
                  <button type="button" className="ws-btn ws-btn--primary">
                    Look up
                  </button>
                </div>
              </div>
              <div className="ws-val-manual">
                <div className="ws-val-grid-2">
                  <div className="ws-val-field">
                    <label className="ws-val-label" htmlFor="dev-val-make">
                      Make
                    </label>
                    <input id="dev-val-make" type="text" />
                  </div>
                  <div className="ws-val-field">
                    <label className="ws-val-label" htmlFor="dev-val-model">
                      Model <span className="ws-val-optional">optional</span>
                    </label>
                    <input id="dev-val-model" type="text" />
                    <p className="ws-val-hint">Roughly is fine.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Lookup results" note=".ws-val-found · .ws-val-plate · .ws-val-notice · .ws-val-blocked · .ws-val-link">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-val-found" role="status">
              <span className="ws-val-plate">AB12 CDE</span>
              <div className="ws-val-found-body">
                <p className="ws-val-found-title">2019 Suzuki Vitara</p>
                <p className="ws-muted">Petrol · Silver</p>
              </div>
              <button type="button" className="ws-val-link">
                Not your car?
              </button>
            </div>
            <div className="ws-val-notice" role="status">
              <p>We could not find that registration. Enter the details below.</p>
              <button type="button" className="ws-btn ws-btn--ghost">
                Try again
              </button>
            </div>
            <p className="ws-val-blocked" role="alert">
              Please answer the questions above to continue.
            </p>
          </div>
        </Frame>
      </Row>

      <Row label="Answer groups" note=".ws-val-fieldset · .ws-val-options · .ws-val-option (radio and checkbox)">
        <Frame padded>
          <div className="ws-page">
            <fieldset className="ws-val-fieldset">
              <legend className="ws-val-legend">Service history</legend>
              <p className="ws-val-hint">Choose the closest.</p>
              <div className="ws-val-options" data-columns="two">
                <label className="ws-val-option" data-selected="true">
                  <input type="radio" name="dev-val-history" defaultChecked />
                  <span className="ws-val-option-body">
                    <span className="ws-val-option-label">Full dealer history</span>
                    <span className="ws-val-option-hint">Every service stamped</span>
                  </span>
                </label>
                <label className="ws-val-option" data-selected="false">
                  <input type="radio" name="dev-val-history" />
                  <span className="ws-val-option-body">
                    <span className="ws-val-option-label">Partial history</span>
                  </span>
                </label>
                <label className="ws-val-option" data-selected="true">
                  <input type="checkbox" defaultChecked />
                  <span className="ws-val-option-body">
                    <span className="ws-val-option-label">Warning lights on</span>
                    <span className="ws-val-option-hint">Several can be ticked</span>
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="ws-val-nav">
              <button type="button" className="ws-btn ws-btn--ghost">
                Back
              </button>
              <button type="button" className="ws-btn ws-btn--primary">
                Next
              </button>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Estimate" note=".ws-val-figure · -disclaimer · -cta · -working · -hours · -smallprint">
        <Frame padded>
          <div className="ws-page">
            <div className="ws-card ws-panel ws-val-panel">
              <span className="ws-eyebrow">Your estimate</span>
              <h3 className="ws-h2 ws-val-figure">
                £9,200 <span className="ws-sr-only">to</span> – £10,400
              </h3>
              <p className="ws-val-figure-sub">Guide price, subject to inspection.</p>
              <div className="ws-val-disclaimer">
                <p>
                  <strong>This is not an offer.</strong> We confirm the price when we see the car.
                </p>
              </div>
              <div className="ws-val-cta">
                <a href="#contact" className="ws-btn ws-btn--primary">
                  Book an appraisal
                </a>
                <a href="tel:01732870711" className="ws-btn ws-btn--ghost">
                  Call us
                </a>
              </div>
              <p className="ws-val-cta-note">No obligation.</p>
              <div>
                <h4 className="ws-val-working-title">What moved your estimate</h4>
                <ul className="ws-val-working-list">
                  <li data-direction="up">
                    <span className="ws-val-working-label">
                      Full service history
                      <span className="ws-val-working-detail">Dealer stamped</span>
                    </span>
                    <span className="ws-val-working-effect">+£400</span>
                  </li>
                  <li data-direction="down">
                    <span className="ws-val-working-label">
                      Above-average mileage
                      <span className="ws-val-working-detail">68,000 miles</span>
                    </span>
                    <span className="ws-val-working-effect">−£650</span>
                  </li>
                </ul>
              </div>
              <ul className="ws-ticks ws-val-notes">
                <li>Bring the V5C and both keys.</li>
              </ul>
              <div className="ws-val-visit">
                <h4 className="ws-val-working-title">Where to find us</h4>
                <ul className="ws-val-hours">
                  <li>
                    <span>Monday – Friday</span>
                    <span>8:30am – 5:30pm</span>
                  </li>
                </ul>
              </div>
              <p className="ws-val-foot">
                Questions? <a href="#contact">Contact the sales team</a>.
              </p>
            </div>
            <p className="ws-val-smallprint">Estimates use market data and your answers.</p>
          </div>
        </Frame>
      </Row>
    </ShowcaseSection>
  );
}
