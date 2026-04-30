// file location: src/components/ui/InputField.js
// Standard input component using the .app-input class.
// Supports label, placeholder, and all native input props.
import React from "react";

export default function InputField({
  label,
  id,
  className = "",
  style,
  ...rest
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
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
        </label>
      )}
      <input
        id={inputId}
        className={`app-input ${className}`}
        {...rest}
      />
    </div>
  );
}
