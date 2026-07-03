// file location: src/components/ui/FieldError.js
// Accessible inline field error (Frontend Feedback System, Phase 8).
//
// Renders the single message for one field, wired to the input via a matching
// `id` (the input points at it with aria-describedby). role="alert" +
// aria-live="polite" so the message is announced when it appears/changes.
// Styling is the `.app-field-error` class in families/forms.css — tokens only.
//
// Usually you don't render this directly — <InputField error=…> does it for you.
// Use it standalone for custom controls (a DropdownField, a radio group, etc.):
//   <DropdownField id="role" aria-invalid={!!err} aria-describedby="role-error" … />
//   <FieldError id="role-error">{err}</FieldError>
import React from "react";

export default function FieldError({ id, children, className = "" }) {
  if (!children) return null;
  return (
    <p id={id} className={["app-field-error", className].filter(Boolean).join(" ")} role="alert" aria-live="polite">
      <span className="app-field-error__icon" aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}
