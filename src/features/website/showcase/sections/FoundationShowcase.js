// file location: src/features/website/showcase/sections/FoundationShowcase.js
//
// /website/dev — @family foundation and @family theme. Every swatch paints the
// TOKEN (var(--x)), never a copied value, so this section re-themes with the
// theme button and follows any token change without an edit here.

import { Code, Row, ShowcaseSection, Swatch } from "../ShowcasePrimitives";

export default function FoundationShowcase({ section }) {
  return (
    <ShowcaseSection id="foundation" section={section}>
      <Row label="Brand" note="Change --accentMain and --accentMainRgb together; everything else reads them.">
        <div className="website-dev-swatch-row">
          <Swatch token="--accentMain" note="Solid brand fill" />
          <Swatch token="--accentText" note="Accent as text" />
          <Swatch token="--primary-hover" note="Hover" />
          <Swatch token="--primary-pressed" note="Pressed" />
          <Swatch token="--onAccentText" note="Ink on the brand fill" />
        </div>
      </Row>

      <Row label="Surfaces" note="Page base, the solid card, and the four glass elevations.">
        <div className="website-dev-swatch-row">
          <Swatch token="--website-page-bg" note="Page base" />
          <Swatch token="--surface" note="Solid card" />
          <Swatch token="--website-elev-1" note="Elevation 1" />
          <Swatch token="--website-elev-2" note="Elevation 2 · --ws-card" />
          <Swatch token="--website-elev-3" note="Elevation 3" />
          <Swatch token="--website-elev-4" note="Elevation 4 · --ws-card-soft" />
        </div>
      </Row>

      <Row label="Control material" note="Every secondary control, and the denser fill every floating panel uses.">
        <div className="website-dev-swatch-row">
          <Swatch token="--ws-control-bg" note="Control fill" />
          <Swatch token="--ws-control-bg-hover" note="Control hover / focus" />
          <Swatch token="--ws-control-ring" note="Control hairline" />
          <Swatch token="--ws-panel-bg" note="Floating panel" />
          <Swatch token="--website-backdrop" note="Drawer dim" />
        </div>
      </Row>

      <Row label="Page wash" note="html.website-scope body">
        <div className="website-dev-wash-preview">
          <span className="website-dev-wash-caption">
            Two brand glows (--website-wash-accent) and two cool glows (--website-wash-cool) over
            --website-page-bg. This preview reads the same four tokens as the page body.
          </span>
        </div>
      </Row>

      <Row label="Ink ramp">
        <div className="website-dev-ink-scale">
          <span className="website-dev-ink--bright">--txt-bright · headings, body copy, control labels</span>
          <span className="website-dev-ink--soft">--txt-soft · leads and supporting copy</span>
          <span className="website-dev-ink--mute">--txt-mute · meta lines, labels, hints</span>
          <span className="website-dev-ink--faint">--txt-faint · decorative only</span>
        </div>
      </Row>

      <Row label="State colours">
        <div className="website-dev-swatch-row">
          <Swatch token="--website-selected-bg" note="Selected menu row" />
          <Swatch token="--website-option-selected-bg" note="Native option, checked" />
          <Swatch token="--website-success-ink" note="Positive figure" />
          <Swatch token="--website-warning-ink" note="Low stock" />
          <Swatch token="--website-scrim" note="Scrim" />
          <Swatch token="--website-day-disabled" note="Disabled day" />
        </div>
      </Row>

      <Row label="Control system" note="--website-control-height · every control is a 999px pill · --website-control-radius is the banner only · --website-field-gap">
        <div className="website-dev-metric-row">
          <div className="website-dev-metric">
            <span className="website-dev-metric__sample website-dev-metric__sample--height" />
            <span>Control height</span>
          </div>
          <div className="website-dev-metric">
            <span className="website-dev-metric__sample website-dev-metric__sample--radius" />
            <span>Banner radius</span>
          </div>
          <div className="website-dev-metric">
            <span className="website-dev-metric__sample website-dev-metric__sample--gap" />
            <span>Field gap</span>
          </div>
        </div>
      </Row>

      <Row label="Links" note="html.website-scope a — no underline in either state">
        <p className="website-dev-page-lead">
          Customer links carry no underline. <a href="#foundation">This is a raw link</a> and it
          inherits its colour.
        </p>
      </Row>

      <Row label="Scrollbar" note="--scrollbar-thumb on --website-scrollbar-track">
        <div className="website-dev-scroll-host">
          {Array.from({ length: 16 }, (_, index) => (
            <p key={index} className="website-dev-scroll-row">
              Row {index + 1} — scroll to see the brand thumb.
            </p>
          ))}
        </div>
      </Row>

      <Row label="Theme" note="@family theme">
        <p className="website-dev-page-lead">
          The theme button at the top writes <Code>data-website-theme</Code> on the root element.
          The light block re-points token values only, so every section on this page flips from the
          same place the real pages do.
        </p>
      </Row>
    </ShowcaseSection>
  );
}
