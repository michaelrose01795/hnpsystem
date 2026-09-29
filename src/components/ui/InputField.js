// file location: src/components/ui/InputField.js
// Standard input component using the .app-input class.
// Supports label, placeholder, and all native input props.
//
// Phase 8: accessible validation is built in. Pass `error` (a string) to render
// an inline <FieldError> and wire aria-invalid + aria-describedby automatically;
// pass `hint` for help text. `data-valid="true"` (from the form hook's
// getFieldProps) paints the success ring. forwardRef exposes the inner <input>
// so useFormValidation can focus the first invalid field.
//
// type="search" folds into a search button on a portrait phone, like SearchBar
// (see searchBarAPI/PhoneSearchCollapse). Pass phoneCollapse={false} to opt out.
import React from "react";
import FieldError from "./FieldError";
import PhoneSearchCollapse from "./searchBarAPI/PhoneSearchCollapse";

const InputField = React.forwardRef(function InputField(
  { label, id, className = "", style, error, hint, required, phoneCollapse = true, ...rest },
  ref
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const errorId = inputId ? `${inputId}-error` : undefined;
  const hintId = inputId && hint ? `${inputId}-hint` : undefined;

  // Merge any caller-supplied aria-describedby (e.g. from getFieldProps) with the
  // hint id, and always point at the error id when there is an error.
  const describedBy = [error ? errorId : null, hintId, rest["aria-describedby"]]
    .filter(Boolean)
    .join(" ") || undefined;

  const input = (
    <input
      ref={ref}
      {...rest}
      id={inputId}
      className={`app-input ${className}`.trim()}
      aria-invalid={error ? "true" : rest["aria-invalid"]}
      aria-describedby={describedBy}
      aria-required={required ? "true" : rest["aria-required"]}
    />
  );

  const renderField = (inOverlay) =>
    // In the phone search overlay only the input shows; the label becomes its
    // accessible name so the bar stays one row.
    inOverlay ? (
      React.cloneElement(input, { "aria-label": rest["aria-label"] || label })
    ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)", ...style }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: "var(--text-label)",
              fontWeight: "var(--control-label-weight)",
              color: "var(--text-1)",
              textTransform: "uppercase",
              letterSpacing: "var(--tracking-caps)",
            }}
          >
            {label}
            {required && (
              <span className="app-field-required" aria-hidden="true">
                {" *"}
              </span>
            )}
          </label>
        )}
        {input}
        {hint && !error && (
          <p id={hintId} className="app-field-hint">
            {hint}
          </p>
        )}
        <FieldError id={errorId}>{error}</FieldError>
      </div>
    );

  return (
    <PhoneSearchCollapse
      enabled={phoneCollapse && rest.type === "search"}
      renderField={renderField}
      label={rest["aria-label"] || label || rest.placeholder || "Search"}
      hasValue={String(rest.value ?? "").length > 0}
      disabled={Boolean(rest.disabled)}
    />
  );
});

export default InputField;
