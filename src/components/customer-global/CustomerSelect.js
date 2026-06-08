// file location: src/components/customer-global/CustomerSelect.js
// Customer select wrapper for native dropdown controls.
import React from "react";

export default function CustomerSelect({
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
    <label className={`customer-field ${fieldClassName}`.trim()} htmlFor={selectId}>
      {label ? <span className="customer-field-label">{label}</span> : null}
      <select id={selectId} className={`customer-select ${className}`.trim()} {...rest}>
        {children || options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
