// file location: src/features/website/showcase/ShowcasePrimitives.js
//
// Layout primitives for the /website/dev showcase. They draw the frame AROUND
// the real customer UI (.website-dev-* in the @family showcase block of
// src/styles/custglobal.css) and never style a customer component themselves.
//
// <ShowcaseSection id="..."> is load-bearing: tools/scripts/check-website-design.js
// fails the build if a section registered in src/config/websiteDesignSystem.json
// has no <ShowcaseSection> with that literal id.

export function ShowcaseSection({ id, section, children }) {
  const families = section?.families || [];
  const classCount = families.reduce((sum, family) => sum + family.classes.length, 0);
  return (
    <section id={id} className="website-dev-section" aria-labelledby={`${id}-title`}>
      <header className="website-dev-section__header">
        <h2 id={`${id}-title`} className="website-dev-section__title">
          {section?.title || id}
        </h2>
        {section?.description ? <p className="website-dev-section__lead">{section.description}</p> : null}
        {families.length ? (
          <p className="website-dev-section__meta">
            {families.map((family) => (
              <code key={family.id} className="website-dev-code">
                @family {family.id}
              </code>
            ))}
            <span>
              {classCount} classes · {families.reduce((sum, family) => sum + family.rules, 0)} rules
            </span>
          </p>
        ) : null}
      </header>
      <div className="website-dev-section__body">{children}</div>
    </section>
  );
}

export function Row({ label, note, children }) {
  return (
    <div className="website-dev-row">
      <div className="website-dev-row__label">
        <span>{label}</span>
        {note ? <span className="website-dev-row__note">{note}</span> : null}
      </div>
      <div className="website-dev-row__body">{children}</div>
    </div>
  );
}

// A rounded window on the page background. `padded` adds breathing room for
// components that do not carry their own section padding.
export function Frame({ padded = false, children }) {
  return <div className={`website-dev-frame${padded ? " website-dev-frame--padded" : ""}`}>{children}</div>;
}

// A fixed-height window that contains position:fixed customer surfaces.
export function Stage({ children }) {
  return <div className="website-dev-stage">{children}</div>;
}

export function Code({ children }) {
  return <code className="website-dev-code">{children}</code>;
}

// Paints a token, not a value: the chip is `background: var(--website-dev-swatch)`
// and the swatch variable points at the token, so a token change repaints it.
export function Swatch({ token, note }) {
  return (
    <div className="website-dev-swatch">
      <span className="website-dev-swatch__chip" style={{ "--website-dev-swatch": `var(${token})` }} />
      <span className="website-dev-swatch__meta">
        <span className="website-dev-swatch__label">{token}</span>
        {note ? <span className="website-dev-swatch__note">{note}</span> : null}
      </span>
    </div>
  );
}
