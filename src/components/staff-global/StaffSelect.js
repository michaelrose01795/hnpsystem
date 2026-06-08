// file location: src/components/staff-global/StaffSelect.js
// Staff select wrapper for native dropdown controls.
import React from "react";

export default function StaffSelect({
  label,
  id,
  options = [],
  children,
  className = "",
  fieldClassName = "",
  ...rest
}) {
  const selectId = id || rest.name;

  return (
    <label className={`staff-field ${fieldClassName}`.trim()} htmlFor={selectId}>
      {label ? <span className="staff-field-label">{label}</span> : null}
      <select id={selectId} className={`staff-select app-input app-input--select ${className}`.trim()} {...rest}>
        {children || options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
