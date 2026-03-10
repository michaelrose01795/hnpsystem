import React, { forwardRef } from "react";

const SearchBar = forwardRef(function SearchBar(
  {
    value,
    onChange,
    placeholder = "Search",
    ariaLabel = "Search",
    className = "",
    inputClassName = "",
    style,
    inputStyle,
    disabled = false,
    onClear,
    ...rest
  },
  ref
) {
  const hasValue = String(value ?? "").length > 0;

  return (
    <div className={["searchbar-api", className].filter(Boolean).join(" ")} style={style}>
      <span className="searchbar-api__icon" aria-hidden="true">
        &#9906;
      </span>
      <input
        {...rest}
        ref={ref}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={["searchbar-api__input", inputClassName].filter(Boolean).join(" ")}
        style={inputStyle}
      />
      {hasValue && (
        <button
          type="button"
          className="searchbar-api__clear"
          onClick={onClear}
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
});

export default SearchBar;
