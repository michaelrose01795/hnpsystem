// file location: src/components/customer-global/CustomerInput.js
// Customer input wrapper for text-like fields and textareas.
import React from "react";

export default function CustomerInput({
  label,
  id,
  textarea = false,
  className = "",
  fieldClassName = "",
  ...rest
}) {
  const inputId = id || rest.name;
  const Control = textarea ? "textarea" : "input";

  return (
    <label className={`customer-field ${fieldClassName}`.trim()} htmlFor={inputId}>
      {label ? <span className="customer-field-label">{label}</span> : null}
      <Control
        id={inputId}
        className={`customer-input${textarea ? " customer-input-textarea" : ""} ${className}`.trim()}
        {...rest}
      />
    </label>
  );
}
