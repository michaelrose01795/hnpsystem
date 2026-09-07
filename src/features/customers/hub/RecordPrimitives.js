// file location: src/features/customers/hub/RecordPrimitives.js
//
// The shared building blocks for a record screen. Reference implementation of
// the "record" family registered in src/components/ui/variants.js and defined
// in src/styles/families/records.css.
//
// Every visual property comes from that family. Inline styles here are
// layout-only (display / gap / grid / width), which is what the design
// governance rules allow (CLAUDE.md §3.0b rule 3).

import React from "react";
import Link from "next/link";
import { EM_DASH } from "@/lib/customers/customerHubModel";

/* One label-above-value pair. `href` turns the value into a link; `copyable`
   adds a small copy affordance for the things staff read down the phone. */
export function RecordField({ label, value, href, external, copyable, onCopy, muted }) {
  const display = value === null || value === undefined || value === "" ? EM_DASH : value;
  const hasValue = display !== EM_DASH;
  const valueClass = ["app-record-field__value", muted ? "app-record-field__value--muted" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app-record-field">
      <span className="app-record-field__label">{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        {href && hasValue ? (
          <a
            className={valueClass}
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
          >
            {display}
          </a>
        ) : (
          <span className={valueClass}>{display}</span>
        )}
        {copyable && hasValue && (
          <button
            type="button"
            className="app-btn app-btn--ghost app-btn--xxs"
            onClick={() => onCopy?.(String(value))}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            Copy
          </button>
        )}
      </div>
    </div>
  );
}

/* Responsive grid of RecordFields. Pass `fields` as {label, value, ...} rows;
   empty rows are dropped so a sparse record does not render a wall of dashes. */
export function RecordFieldGrid({ fields = [], wide = false, keepEmpty = false, children }) {
  const rows = keepEmpty ? fields : fields.filter((field) => field && field.value);
  if (!rows.length && !children) return null;

  return (
    <div className={["app-record-grid", wide ? "app-record-grid--wide" : ""].filter(Boolean).join(" ")}>
      {rows.map((field) => (
        <RecordField key={field.label} {...field} />
      ))}
      {children}
    </div>
  );
}

export function RegistrationPlate({ registration, onTheme = false }) {
  return (
    <span className={["app-record-plate", onTheme ? "app-record-plate--theme" : ""].filter(Boolean).join(" ")}>
      {registration}
    </span>
  );
}

/* Status pill. `tone` maps onto the badge family variants. */
export function StatusBadge({ children, tone = "neutral", uppercase = false }) {
  if (!children) return null;
  return (
    <span
      className={["app-badge", `app-badge--${tone}`, uppercase ? "app-badge--uppercase" : ""]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

export function RecordHeading({ children, actions }) {
  return (
    <div className="app-page-header">
      <div className="app-page-header__text">
        <h3 className="app-record-heading">{children}</h3>
      </div>
      {actions && <div className="app-page-header__actions">{actions}</div>}
    </div>
  );
}

export function RecordRule() {
  return <div className="app-record-rule" aria-hidden="true" />;
}

/* A vertical event timeline. Each entry: {id, tone, title, time, status, meta,
   fields, actions}. `tone` picks the dot colour. */
export function Timeline({ entries = [], renderEntry }) {
  if (!entries.length) return null;

  return (
    <ol className="app-timeline">
      {entries.map((entry) => (
        <li key={entry.id} className="app-timeline__entry">
          <div className="app-timeline__rail" aria-hidden="true">
            <span className={`app-timeline__dot app-timeline__dot--${entry.tone || "neutral"}`} />
          </div>
          <div className="app-timeline__content">{renderEntry(entry)}</div>
        </li>
      ))}
    </ol>
  );
}

export function TimelineHead({ title, time, badge }) {
  return (
    <div className="app-timeline__head">
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
        <p className="app-timeline__title">{title}</p>
        {badge}
      </div>
      {time && <span className="app-timeline__time">{time}</span>}
    </div>
  );
}

/* A route link styled as a button. Next's Link needs the class on itself so the
   whole hit area is the control. */
export function LinkButton({ href, children, variant = "secondary", size = "sm", onMouseEnter, prefetch }) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      onMouseEnter={onMouseEnter}
      className={["app-btn", `app-btn--${variant}`, size ? `app-btn--${size}` : ""].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}
