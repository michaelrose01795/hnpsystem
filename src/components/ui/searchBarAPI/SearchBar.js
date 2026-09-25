import React, { forwardRef, useRef } from "react";
import PhoneSearchCollapse from "./PhoneSearchCollapse";

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
  "height",
  "minHeight",
  "maxHeight",
  "minWidth",
  "maxWidth",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderRadius",
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
    type = "text",
    // Portrait phone: fold into a search button that opens the global-search
    // style overlay (PhoneSearchCollapse). Pass false where the field must
    // stay inline.
    phoneCollapse = true,
    // Fold into the search button at every width, not only on a portrait phone.
    alwaysCollapse = false,
    ...rest
  },
  ref
) {
  const inputRef = useRef(null);
  const hasValue = String(value ?? "").length > 0;
  const wrapperStyle = pickStyleKeys(style, WRAPPER_STYLE_KEYS);
  const mergedInputStyle = pickStyleKeys(inputStyle, INPUT_LAYOUT_STYLE_KEYS);

  const assignInputRef = (node) => {
    inputRef.current = node;
    if (typeof ref === "function") {
      ref(node);
      return;
    }
    if (ref) {
      ref.current = node;
    }
  };

  const handleClearPointerDown = (event) => {
    event.preventDefault();
  };

  const handleClear = () => {
    if (typeof onClear === "function") {
      onClear();
    }
    if (inputRef.current) {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  };

  // In the phone overlay the host's wrapper sizing is dropped so the field
  // fills the bar.
  const renderField = (inOverlay) => (
    <div className={["searchbar-api", className].filter(Boolean).join(" ")} style={inOverlay ? undefined : wrapperStyle} data-draft-ignore="true">
      <input
        {...rest}
        ref={assignInputRef}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={["searchbar-api__input", inputClassName].filter(Boolean).join(" ")}
        style={mergedInputStyle}
      />
      <button
        type="button"
        className="searchbar-api__clear"
        onMouseDown={handleClearPointerDown}
        onPointerDown={handleClearPointerDown}
        onClick={handleClear}
        aria-label="Clear search"
        disabled={!hasValue || disabled}
        aria-hidden={!hasValue}
      >
        &times;
      </button>
    </div>
  );

  return (
    <PhoneSearchCollapse
      enabled={phoneCollapse}
      always={alwaysCollapse}
      renderField={renderField}
      label={ariaLabel !== "Search" ? ariaLabel : placeholder || ariaLabel}
      hasValue={hasValue}
      disabled={disabled}
    />
  );
});

export default SearchBar;
