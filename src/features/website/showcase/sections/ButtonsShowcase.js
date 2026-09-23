// file location: src/features/website/showcase/sections/ButtonsShowcase.js
//
// /website/dev — every button shape the customer site uses, in one place.
// Raw <button> is the secondary control and `.app-btn` the primary (@family
// controls); the page CTA, text-link and circle buttons are the page-family
// variants of those same two controls. Each also appears in context in its
// page section.

import { Frame, Row, ShowcaseSection } from "../ShowcasePrimitives";

export default function ButtonsShowcase({ section }) {
  return (
    <ShowcaseSection id="buttons" section={section}>
      <Row label="Primary" hint=".app-btn">
        <div className="website-dev-cluster">
          <button type="button" className="app-btn">
            Continue
          </button>
          <a href="#buttons" className="app-btn">
            As a link
          </a>
          <button type="button" className="app-btn" disabled>
            Disabled
          </button>
        </div>
      </Row>

      <Row label="Secondary" hint="button">
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

      <Row label="Page CTAs" hint=".ws-btn">
        <Frame padded>
          <div className="ws-page">
            <div className="website-dev-cluster">
              <a href="#buttons" className="ws-btn ws-btn--primary">
                Browse cars
              </a>
              <a href="#buttons" className="ws-btn ws-btn--ghost">
                Book a service
              </a>
            </div>
          </div>
        </Frame>
      </Row>

      <Row label="Text links">
        <div className="website-dev-cluster">
          <button type="button" className="ws-catalog-clear">
            Clear search
          </button>
          <button type="button" className="ws-val-link">
            Not your car?
          </button>
        </div>
      </Row>

      <Row label="Icon buttons" hint="44px circles">
        <div className="website-dev-cluster">
          <button type="button" className="ws-cart-close" aria-label="Close">
            ×
          </button>
          <button type="button" className="ws-cart-qty" aria-label="Decrease">
            −
          </button>
          <button type="button" className="ws-cart-qty" aria-label="Increase">
            +
          </button>
          <button type="button" className="website-calendar__nav" aria-label="Next">
            ›
          </button>
        </div>
      </Row>
    </ShowcaseSection>
  );
}
