// file location: src/components/staff-global/StaffSearchBar.js
// Staff search field with optional clear action.
import React from "react";

export default function StaffSearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search",
  className = "",
  inputClassName = "",
  ...rest
}) {
  return (
    <div className={`staff-search searchbar-api ${className}`.trim()}>
      <span className="staff-search-icon searchbar-api__icon" aria-hidden="true">Search</span>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`staff-search-input searchbar-api__input ${inputClassName}`.trim()}
        {...rest}
      />
      {onClear ? (
        <button
          type="button"
          className="staff-search-clear searchbar-api__clear"
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
