// file location: src/features/website/showcase/sections/FoundationShowcase.js
//
// /website/dev — @family foundation and @family theme. Every swatch paints the
// TOKEN (var(--x)), never a copied value, so this section re-themes with the
// theme toggle and follows any token change without an edit here.

import { Row, ShowcaseSection, Swatch } from "../ShowcasePrimitives";

const SHAPES = [
  { key: "pill", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--pill", label: "Pill" },
  { key: "card", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--card", label: "Card" },
  { key: "panel", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--panel", label: "Panel" },
  { key: "tile", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--tile", label: "Tile" },
  { key: "chip", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--chip", label: "Chip" },
  { key: "banner", className: "website-dev-metric__sample website-dev-metric__sample--shape website-dev-metric__sample--banner", label: "Banner" },
];

export default function FoundationShowcase({ section }) {
  return (
    <ShowcaseSection id="foundation" section={section}>
      <Row label="Brand" size="md">
        <div className="website-dev-swatch-grid">
          <Swatch token="--accentMain" note="Fill" />
          <Swatch token="--accentText" note="Text" />
          <Swatch token="--primary-hover" note="Hover" />
          <Swatch token="--primary-pressed" note="Pressed" />
          <Swatch token="--onAccentText" note="On fill" />
        </div>
      </Row>

      <Row label="Surfaces" size="md">
        <div className="website-dev-swatch-grid">
          <Swatch token="--website-page-bg" note="Page" />
          <Swatch token="--surface" note="Solid card" />
          <Swatch token="--website-elev-1" note="Lift 1" />
          <Swatch token="--website-elev-2" note="Glass card" />
          <Swatch token="--website-elev-3" note="Lift 3" />
          <Swatch token="--website-elev-4" note="Soft card" />
        </div>
      </Row>

      <Row label="Control material" size="md">
        <div className="website-dev-swatch-grid">
          <Swatch token="--ws-control-bg" note="Fill" />
          <Swatch token="--ws-control-bg-hover" note="Hover" />
          <Swatch token="--ws-control-ring" note="Ring" />
          <Swatch token="--ws-panel-bg" note="Floating panel" />
          <Swatch token="--website-backdrop" note="Dim" />
        </div>
      </Row>

      <Row label="State & status" size="md">
        <div className="website-dev-swatch-grid">
          <Swatch token="--website-selected-bg" note="Selected row" />
          <Swatch token="--website-option-selected-bg" note="Checked option" />
          <Swatch token="--website-success-ink" note="Positive" />
          <Swatch token="--website-warning-ink" note="Warning" />
          <Swatch token="--website-danger-ink" note="Error" />
          <Swatch token="--website-scrim" note="Scrim" />
        </div>
      </Row>

      <Row label="Ink">
        <div className="website-dev-ink-scale">
          <span className="website-dev-ink--bright">Bright — headings and body</span>
          <span className="website-dev-ink--soft">Soft — leads and support</span>
          <span className="website-dev-ink--mute">Mute — meta and hints</span>
          <span className="website-dev-ink--faint">Faint — decorative only</span>
          <span className="website-dev-ink--soft">
            A raw <a href="#foundation">link</a> inherits ink, no underline
          </span>
        </div>
      </Row>

      <Row label="Metrics" hint="height · gap · radius">
        <div className="website-dev-metric-row">
          <div className="website-dev-metric">
            <span className="website-dev-metric__sample website-dev-metric__sample--height" />
            <span>44 high</span>
          </div>
          <div className="website-dev-metric">
            <span className="website-dev-metric__sample website-dev-metric__sample--gap" />
            <span>Field gap</span>
          </div>
          {SHAPES.map((shape) => (
            <div key={shape.key} className="website-dev-metric">
              <span
                className={shape.className}
              />
              <span>{shape.label}</span>
            </div>
          ))}
        </div>
      </Row>

      <Row label="Page wash">
        <div className="website-dev-wash-preview">
          <span className="website-dev-wash-caption">Brand and cool glows over the page base</span>
        </div>
      </Row>

      <Row label="Scrollbar">
        <div className="website-dev-scroll-host">
          {Array.from({ length: 10 }, (_, index) => (
            <p key={index} className="website-dev-scroll-row">
              Row {index + 1} — scroll to see the brand thumb
            </p>
          ))}
        </div>
      </Row>
    </ShowcaseSection>
  );
}
