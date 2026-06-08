// file location: src/components/staff-global/StaffInput.js
// Staff input wrapper for text-like fields and textareas.
import React from "react";

export default function StaffInput({
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
    <label className={`staff-field ${fieldClassName}`.trim()} htmlFor={inputId}>
      {label ? <span className="staff-field-label">{label}</span> : null}
      <Control
        id={inputId}
        className={`staff-input app-input${textarea ? " app-input--textarea" : ""} ${className}`.trim()}
        {...rest}
      />
    </label>
  );
}
