// file location: src/features/website/showcase/ShowcasePrimitives.js
//
// Layout primitives for the /website/dev showcase. They draw the frame AROUND
// the real customer UI (.website-dev-* in the @family showcase block of
// src/styles/custglobal.css) and never style a customer component themselves.
//
// <ShowcaseSection id="..."> is load-bearing: tools/scripts/check-website-design.js
// fails the build if a section registered in src/config/websiteDesignSystem.json
// has no <ShowcaseSection> with that literal id.

// `section` is composed in src/pages/website/dev.js: the page title and span,
// plus the manifest's family data when the id is a registered section.
export function ShowcaseSection({ id, section, children }) {
  const title = section?.title || id;
  const classCount = (section?.families || []).reduce((sum, family) => sum + family.classes.length, 0);
  const full = section?.span !== "half";
  return (
    <section
      id={id}
      className={full ? "website-dev-section website-dev-section--full" : "website-dev-section"}
      aria-labelledby={`${id}-title`}
    >
      <header className="website-dev-section__header">
        <h2 id={`${id}-title`} className="website-dev-section__title">
          {title}
        </h2>
        {classCount ? <span className="website-dev-section__meta">{classCount} classes</span> : null}
      </header>
      <div className="website-dev-section__body">{children}</div>
    </section>
  );
}

// One example tile. Tiles wrap side by side: `sm` (default) for single
// controls, `md` for small compositions, `wide` for full page composites.
const ROW_SIZE_CLASS = {
  sm: "website-dev-row",
  md: "website-dev-row website-dev-row--md",
  wide: "website-dev-row website-dev-row--wide",
};

export function Row({ label, hint, size = "sm", children }) {
  return (
    <div className={ROW_SIZE_CLASS[size] || ROW_SIZE_CLASS.sm}>
      <div className="website-dev-row__label">
        <span className="website-dev-row__title">{label}</span>
        {hint ? <span className="website-dev-row__hint">{hint}</span> : null}
      </div>
      <div className="website-dev-row__body">{children}</div>
    </div>
  );
}

// A rounded window on the page background. `padded` adds breathing room for
// components that do not carry their own section padding.
export function Frame({ padded = false, children }) {
  return <div className={padded ? "website-dev-frame website-dev-frame--padded" : "website-dev-frame"}>{children}</div>;
}

// A fixed-height window that contains position:fixed customer surfaces.
const STAGE_SIZE_CLASS = {
  default: "website-dev-stage",
  compact: "website-dev-stage website-dev-stage--compact",
  mini: "website-dev-stage website-dev-stage--mini",
};

export function Stage({ size = "default", children }) {
  return <div className={STAGE_SIZE_CLASS[size] || STAGE_SIZE_CLASS.default}>{children}</div>;
}

export function Code({ children }) {
  return <code className="website-dev-code">{children}</code>;
}

// Paints a token, not a value: the chip is `background: var(--website-dev-swatch)`
// and the swatch variable points at the token, so a token change repaints it.
export function Swatch({ token, note }) {
  return (
    <div className="website-dev-swatch" title={token}>
      <span className="website-dev-swatch__chip" style={{ "--website-dev-swatch": `var(${token})` }} />
      <span className="website-dev-swatch__meta">
        <span className="website-dev-swatch__label">{token}</span>
        {note ? <span className="website-dev-swatch__note">{note}</span> : null}
      </span>
    </div>
  );
}
