// file location: src/components/ui/FormErrorSummary.js
// Grouped, accessible validation summary for large forms (Frontend Feedback
// System, Phase 8). Renders at the top (or bottom) of a form after a failed
// submit, listing every invalid field as a link that focuses/scrolls to it.
//
// role="alert" so a screen reader announces "N problems" the moment it appears;
// each link targets the field's error id (`field-<name>-error`) and, on click,
// focuses the field itself via onFocusField (from the hook's focusField).
//
// Usage:
//   {form.summaryErrors.length > 0 && (
//     <FormErrorSummary errors={form.summaryErrors} onFocusField={form.focusField} />
//   )}
import React from "react";

export default function FormErrorSummary({
  errors = [],
  title,
  onFocusField,
  className = "",
}) {
  if (!errors.length) return null;

  const heading =
    title || `Please fix ${errors.length} ${errors.length === 1 ? "problem" : "problems"} before continuing:`;

  return (
    <div className={["app-form-summary", className].filter(Boolean).join(" ")} role="alert" aria-live="assertive">
      <p className="app-form-summary__title">{heading}</p>
      <ul className="app-form-summary__list">
        {errors.map((item) => (
          <li key={item.name}>
            <a
              href={`#${item.id || `field-${item.name}`}`}
              className="app-form-summary__link"
              onClick={(event) => {
                if (onFocusField) {
                  event.preventDefault();
                  onFocusField(item.name);
                }
              }}
            >
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
