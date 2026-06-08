// file location: src/components/customer-global/CustomerSearchBar.js
// Customer search field with optional clear action.
import React from "react";

export default function CustomerSearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search",
  className = "",
  inputClassName = "",
  ...rest
}) {
  return (
    <div className={`customer-search ${className}`.trim()}>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`customer-search-input ${inputClassName}`.trim()}
        {...rest}
      />
      {onClear ? (
        <button
          type="button"
          className="customer-search-clear"
          onClick={onClear}
          disabled={!value}
          aria-label="Clear search"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
