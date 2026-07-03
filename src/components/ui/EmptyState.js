// file location: src/components/ui/EmptyState.js
// Canonical empty-state primitive (Frontend Feedback System, Phase 7).
//
// THE standard for every "there is nothing here" surface: empty lists, tables,
// dashboards, search/filter with no matches, permission-denied panels, archived
// or offline views, and data that could not load. One component so every empty
// screen reads as intentional (a title + next step) instead of a bare
// "No results" string or — worse — plausible mock rows.
//
// Styling is 100% the `.app-empty-state` family in
// src/styles/families/empty-states.css (staffglobal.css tokens only) — this file
// adds NO inline colours/borders/backgrounds, so it stays clear of the border
// and layer guards.
//
// Props:
//   icon            – small glyph/emoji/SVG shown above the title (decorative,
//                     aria-hidden). Use for compact/inline states.
//   illustration    – larger illustration node (img/svg) for page-level states.
//   title           – short headline ("No jobs in this status group").
//   description      – one-line explanation / next step.
//   action          – primary action node (e.g. a <Button>).
//   secondaryAction  – optional secondary action node.
//   variant         – "inline" (default, compact card), "page" (tall, page-level),
//                     or "bare" (no own background/padding — for embedding inside
//                     an existing surface, card, or table cell).
//   role            – pass "status" for search/filter results so the change is
//                     announced to assistive tech; omit for static empties.
//
// Accessibility: the icon is decorative; the title renders as a styled paragraph
// (not a heading) so dropping an empty state into an arbitrary list never breaks
// heading order. Responsiveness comes from the family CSS (centred flex column,
// description capped at 46ch).
import React from "react";

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
  secondaryAction,
  variant = "inline",
  className = "",
  role,
  ...rest
}) {
  const classes = ["app-empty-state", `app-empty-state--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} role={role} {...rest}>
      {illustration && <div className="app-empty-state__illustration">{illustration}</div>}
      {icon && (
        <span className="app-empty-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      {(title || description) && (
        <div className="app-empty-state__copy">
          {title && <p className="app-empty-state__title">{title}</p>}
          {description && <p className="app-empty-state__description">{description}</p>}
        </div>
      )}
      {(action || secondaryAction) && (
        <div className="app-empty-state__actions">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
