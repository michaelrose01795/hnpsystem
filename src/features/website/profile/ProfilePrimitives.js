// file location: src/features/website/profile/ProfilePrimitives.js
//
// The small shared pieces every /website/profile portal view is built from.
// They render nothing but custglobal.css classes (@family portal), so the
// portal repaints with the customer theme and carries no paint of its own.
//
// Nothing here fetches or derives data — each piece takes what the page has
// already loaded from /api/website/profile and hands presentation back.

import { useState } from "react";

// ── Cards ───────────────────────────────────────────────────────────────

// Header bar shared by the portal card and the settings rows in Account.
export function PortalCardHeader({ eyebrow, title, count, action }) {
  return (
    <div className="ws-portal-card__header">
      <div>
        {eyebrow ? <div className="ws-portal-eyebrow">{eyebrow}</div> : null}
        {title ? <h3 className="ws-portal-card__title">{title}</h3> : null}
      </div>
      <div className="ws-portal-action-row">
        {/* A zero is never worth a badge — the card's empty state already
            says there is nothing there. */}
        {count ? <span className="ws-portal-count">{count}</span> : null}
        {action}
      </div>
    </div>
  );
}

// A card in a portal view. `wide` makes it span the whole grid row.
export function PortalCard({ eyebrow, title, count, action, wide = false, presentation, children }) {
  return (
    <section
      className={wide ? "ws-portal-card ws-portal-card--wide" : "ws-portal-card"}
      data-presentation={presentation}
    >
      {eyebrow || title || action || count ? (
        <PortalCardHeader eyebrow={eyebrow} title={title} count={count} action={action} />
      ) : null}
      {children}
    </section>
  );
}

// The clickable variant: same card material, but a real <button> so keyboard
// and screen-reader users get the same "open this view" affordance the hover
// state promises (§17 of the portal brief).
export function PortalLinkCard({ eyebrow, title, count, onClick, label, presentation, children }) {
  return (
    <button
      type="button"
      className="ws-portal-card ws-profile-card--link"
      onClick={onClick}
      aria-label={label}
      data-presentation={presentation}
    >
      <PortalCardHeader eyebrow={eyebrow} title={title} count={count} />
      {children}
    </button>
  );
}

// View-level heading, above a group of cards inside one portal view.
export function ViewHeading({ eyebrow, title, hint, action }) {
  return (
    <div className="ws-profile-heading">
      <div>
        {eyebrow ? <div className="ws-portal-eyebrow">{eyebrow}</div> : null}
        <h2 className="ws-profile-heading__title">{title}</h2>
        {hint ? <p className="ws-portal-hint">{hint}</p> : null}
      </div>
      {action ? <div className="ws-portal-action-row">{action}</div> : null}
    </div>
  );
}

// ── Facts and figures ───────────────────────────────────────────────────

export function DetailField({ label, value }) {
  return (
    <div className="ws-portal-detail">
      <span className="ws-portal-label">{label}</span>
      <span className="ws-portal-detail__value">{value || "—"}</span>
    </div>
  );
}

export function DetailFieldGrid({ children }) {
  return <div className="ws-portal-details">{children}</div>;
}

// A headline number in the Overview account snapshot. When `onClick` is given
// the tile becomes a button that switches portal view.
export function StatTile({ label, value, onClick, ariaLabel }) {
  if (!onClick) {
    return (
      <div className="ws-profile-stat">
        <span className="ws-profile-stat__value">{value}</span>
        <span className="ws-profile-stat__label">{label}</span>
      </div>
    );
  }
  return (
    <button type="button" className="ws-profile-stat" onClick={onClick} aria-label={ariaLabel || `${label}: ${value}`}>
      <span className="ws-profile-stat__value">{value}</span>
      <span className="ws-profile-stat__label">{label}</span>
    </button>
  );
}

// The ownership score ring on a vehicle header. The angle is the one runtime
// custom property the portal sets inline (--ws-portal-score).
export function ScoreRing({ score = 0 }) {
  return (
    <div className="ws-portal-score" style={{ "--ws-portal-score": `${score * 3.6}deg` }}>
      <div className="ws-portal-score__inner">
        <span className="ws-portal-score__value">{score}</span>
        <span className="ws-portal-score__label">health</span>
      </div>
    </div>
  );
}

export function NotificationDot({ enabled, label }) {
  return (
    <span className="ws-portal-notify" data-enabled={enabled ? "true" : "false"}>
      <span className="ws-portal-notify__dot" />
      {label}
    </span>
  );
}

// ── Navigation ──────────────────────────────────────────────────────────

// Secondary navigation inside a view (vehicle subsections, Money sub-areas,
// Messages / Documents). Real tabs, so arrow keys move between them.
export function SubNav({ label, items, value, onChange, idPrefix }) {
  const onKeyDown = (event) => {
    const index = items.findIndex((item) => item.id === value);
    if (index < 0) return;
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next == null) return;
    event.preventDefault();
    onChange(items[next].id);
    document.getElementById(`${idPrefix}-${items[next].id}`)?.focus();
  };

  return (
    <div className="ws-profile-subtabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`${idPrefix}-${item.id}`}
            type="button"
            role="tab"
            className="ws-profile-subtab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Lists ───────────────────────────────────────────────────────────────

// Long lists show their first few rows and reveal the rest on request, so a
// view opens on what is current rather than on a customer's whole history.
export function ExpandableList({ items, initial = 3, renderItem, emptyText, moreLabel = "View all" }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return <p className="ws-portal-empty">{emptyText}</p>;
  const shown = expanded ? items : items.slice(0, initial);
  return (
    <>
      <ul className="ws-portal-list">{shown.map(renderItem)}</ul>
      {items.length > initial ? (
        <button type="button" className="ws-portal-action-start" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `${moreLabel} (${items.length})`}
        </button>
      ) : null}
    </>
  );
}

// Compact neutral note for an area whose data source is not connected yet.
// Deliberately customer-facing wording — no TODO, no API names.
export function NotAvailableYet({ children }) {
  return <p className="ws-portal-empty">{children}</p>;
}
