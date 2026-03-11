import React, { forwardRef } from "react";

const pickStyleKeys = (style, keys) => {
  if (!style) return undefined;
  return keys.reduce((acc, key) => {
    if (style[key] !== undefined) {
      acc[key] = style[key];
    }
    return acc;
  }, {});
};

const WRAPPER_STYLE_KEYS = [
  "width",
  "minWidth",
  "maxWidth",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "alignSelf",
  "justifySelf",
];

const INPUT_LAYOUT_STYLE_KEYS = ["textAlign"];

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
  const wrapperStyle = pickStyleKeys(style, WRAPPER_STYLE_KEYS);
  const mergedInputStyle = pickStyleKeys(inputStyle, INPUT_LAYOUT_STYLE_KEYS);

  return (
    <div className={["searchbar-api", className].filter(Boolean).join(" ")} style={wrapperStyle}>
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
        style={mergedInputStyle}
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
