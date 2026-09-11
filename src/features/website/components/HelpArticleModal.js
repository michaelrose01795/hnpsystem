// file location: src/features/website/components/HelpArticleModal.js
//
// The "More info" popup behind the Help & Advice cards on /website (#blog).
// One card's full answer - lead paragraph, headed sections, an optional tick
// list and an optional call to action - read from the `detail` object on the
// entry in src/features/website/data/blogPosts.js.
//
// Rendered once by WebsitePage and handed whichever article is open, so there
// is a single dialog on the page rather than one per card. `article` is null
// when nothing is open and the component renders nothing at all; that keeps
// the long copy of eight articles out of the DOM until it is asked for.
//
// SHAPE: this mirrors the staff popup contract (.popup-backdrop / .popup-card /
// .app-popup-compact-header / .app-modal__body / .app-modal__footer in
// staffglobal.css) - centred card, one clear title, the 44px close circle in
// the top-right of the header with any other action to its left, a scrolling
// body between a pinned header and a pinned footer.
// COLOUR: entirely custglobal - the glass panel, brand red and /website text
// ramp. The geometry is restated as literal values in the .ws-article-* rules
// rather than borrowing staff tokens, so /website stays insulated from the
// staff theme (CLAUDE.md §3.0b rule 6).
//
// Styling: .ws-article-* from custglobal.css (HELP & ADVICE block).

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";

export default function HelpArticleModal({ article, onClose }) {
  const open = Boolean(article);
  const cardRef = useRef(null);
  // The element that had focus when the dialog opened - focus goes back to it
  // on close, so keyboard users return to the card they came from rather than
  // the top of the page.
  const restoreFocusRef = useRef(null);

  // Keep the first and last tabbable elements inside the dialog while it is
  // open: a modal that lets Tab wander into the page behind it is a modal in
  // appearance only.
  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const card = cardRef.current;
      if (!card) return;
      const tabbable = card.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!tabbable.length) return;
      const first = tabbable[0];
      const last = tabbable[tabbable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  // Lock the page behind the dialog, move focus into it, and put both back on
  // close. The scroll position is restored explicitly because `overflow:
  // hidden` on <body> drops it on some mobile browsers.
  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = document.activeElement;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const scrollY = window.scrollY;
    body.style.overflow = "hidden";
    cardRef.current?.focus();
    return () => {
      body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
      const restore = restoreFocusRef.current;
      if (restore && typeof restore.focus === "function") restore.focus();
    };
  }, [open]);

  if (!article) return null;

  const { category, title, date, readTime, excerpt, image, detail } = article;
  const { lead, sections = [], checklist, cta } = detail || {};
  const headingId = `ws-article-title-${article.id}`;
  const meta = [date, readTime].filter(Boolean).join(" · ");
  // next/link owns internal routes so they client-side navigate; anchors,
  // tel: and mailto: stay plain <a>.
  const ctaIsRoute = Boolean(cta && cta.href && cta.href.startsWith("/"));

  return (
    <div
      className="ws-article-backdrop"
      data-presentation="website-help-article-modal"
      onKeyDown={onKeyDown}
    >
      {/* Clicking the dim behind the card closes it. The card is a sibling, so
          nothing inside it needs to stop propagation. */}
      <div className="ws-article-scrim" onClick={onClose} />

      <div
        ref={cardRef}
        className="ws-article-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        {/* Compact header: one clear title, actions pinned top-right with
            Close last — the staff popup convention. */}
        <header className="ws-article-header">
          <h2 id={headingId} className="ws-article-title">
            {title}
          </h2>
          <div className="ws-article-header-actions">
            <button
              type="button"
              className="app-btn ws-article-close"
              onClick={onClose}
              aria-label="Close"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </header>

        <div className="ws-article-body">
          {image ? (
            <div className="ws-article-media">
              <img src={image} alt={title} />
            </div>
          ) : null}

          {category || meta ? (
            <div className="ws-article-meta-row">
              {category ? <span className="ws-chip ws-chip--accent">{category}</span> : null}
              {meta ? <span className="ws-article-meta">{meta}</span> : null}
            </div>
          ) : null}

          <div className="ws-article-prose">
            {lead ? <p className="ws-article-lead">{lead}</p> : null}
            {!lead && excerpt ? <p className="ws-article-lead">{excerpt}</p> : null}

            {sections.map((section) => (
              <section key={section.heading} className="ws-article-section">
                <h3 className="ws-article-h3">{section.heading}</h3>
                {(section.body || []).map((paragraph) => (
                  <p key={paragraph} className="ws-muted">
                    {paragraph}
                  </p>
                ))}
              </section>
            ))}

            {checklist ? (
              <aside className="ws-article-checklist">
                <h3 className="ws-article-h3">{checklist.heading}</h3>
                <ul className="ws-ticks">
                  {(checklist.items || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </div>

        {cta ? (
          <footer className="ws-article-footer">
            {cta.note ? <p className="ws-article-note">{cta.note}</p> : null}
            {ctaIsRoute ? (
              <Link href={cta.href} className="ws-btn ws-btn--primary">
                {cta.label}
              </Link>
            ) : (
              <a href={cta.href} className="ws-btn ws-btn--primary" onClick={onClose}>
                {cta.label}
              </a>
            )}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
