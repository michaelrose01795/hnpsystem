// file location: src/components/JobCards/RequestPresetAutosuggestInput.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useJobRequestPresetSuggestions from "@/hooks/useJobRequestPresetSuggestions";

const formatBaselineHours = (value) => {
  const hours = Number(value || 0);
  return Number.isInteger(hours) ? `${hours}h` : `${Number(hours.toFixed(2))}h`;
};

export default function RequestPresetAutosuggestInput({
  value = "",
  onChange = () => {},
  onPresetSelect = () => {},
  placeholder = "Enter job request",
  disabled = false,
  inputClassName = "app-input",
  inputStyle = {},
  containerStyle = {},
  suggestionStyle = {},
  showHours = true,
  horizontalSuggestions = false,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  // Local state keeps the input responsive — parent is notified via debounced onChange
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef(null);
  const pendingValueRef = useRef(null);
  const prevExternalValueRef = useRef(value);

  // Sync local state when the external value changes (e.g. preset selection or clear)
  useEffect(() => {
    if (value !== prevExternalValueRef.current) {
      prevExternalValueRef.current = value;
      setLocalValue(value);
    }
  }, [value]);

  const handleLocalChange = (newValue) => {
    setLocalValue(newValue);
    pendingValueRef.current = newValue;
    prevExternalValueRef.current = newValue; // prevent sync loop
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingValueRef.current = null;
      onChange(newValue);
    }, 250);
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const query = useMemo(() => String(localValue || ""), [localValue]);
  const { suggestions, loading } = useJobRequestPresetSuggestions({
    query,
    enabled: isFocused && !disabled,
    limit: 8,
  });

  const hasSuggestions = suggestions.length > 0;

  useEffect(() => {
    setActiveIndex(hasSuggestions ? 0 : -1);
    setHoveredIndex(-1);
  }, [query, hasSuggestions]);

  useEffect(() => {
    const updateMenuPosition = () => {
      const inputNode = inputRef.current;
      if (!inputNode) return;
      const rect = inputNode.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    if (isFocused) {
      updateMenuPosition();
    }

    const handleResizeOrScroll = () => {
      if (!isFocused) return;
      updateMenuPosition();
    };

    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);
    return () => {
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
    };
  }, [isFocused, query, suggestions.length]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!target) return;
      const clickedInputSection = wrapperRef.current?.contains(target);
      const clickedMenu = menuRef.current?.contains(target);
      if (!clickedInputSection && !clickedMenu) {
        setIsFocused(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const selectSuggestion = (suggestion) => {
    if (!suggestion) return;
    clearTimeout(debounceRef.current);
    pendingValueRef.current = null;
    onPresetSelect(suggestion);
    setIsFocused(false);
  };

  const renderHighlightedLabel = (label = "", queryText = "") => {
    const safeLabel = String(label || "");
    const tokens = String(queryText || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (!tokens.length) return safeLabel;

    const bestToken = tokens.find((token) =>
      safeLabel.toLowerCase().includes(token.toLowerCase())
    );
    if (!bestToken) return safeLabel;

    const lowerLabel = safeLabel.toLowerCase();
    const lowerToken = bestToken.toLowerCase();
    const start = lowerLabel.indexOf(lowerToken);
    if (start < 0) return safeLabel;
    const end = start + bestToken.length;

    return (
      <>
        {safeLabel.slice(0, start)}
        <strong>{safeLabel.slice(start, end)}</strong>
        {safeLabel.slice(end)}
      </>
    );
  };

  const showMenu = isFocused && (loading || hasSuggestions) && typeof document !== "undefined";
  return (
    <div ref={wrapperRef} style={{ position: "relative", ...containerStyle }}>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(event) => handleLocalChange(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
        }}
        onBlur={() => {
          if (pendingValueRef.current !== null) {
            clearTimeout(debounceRef.current);
            const pendingValue = pendingValueRef.current;
            pendingValueRef.current = null;
            onChange(pendingValue);
          }
        }}
        onKeyDown={(event) => {
          if (!isFocused || !hasSuggestions) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
            return;
          }

          if (event.key === "Enter") {
            if (activeIndex >= 0 && suggestions[activeIndex]) {
              event.preventDefault();
              selectSuggestion(suggestions[activeIndex]);
            }
            return;
          }

        }}
        placeholder={placeholder}
        disabled={disabled}
        className={inputClassName}
        style={inputStyle}
      />

      {showMenu && menuPosition
        ? createPortal(
        <div
          ref={menuRef}
          className="dropdown-api__menu app-dropdown-menu"
          style={{
            position: "fixed",
            top: `${menuPosition.top + 6}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            maxHeight: "280px",
            overflowY: "auto",
            zIndex: 4000,
            ...suggestionStyle,
          }}
        >
          {loading ? (
            <div className="dropdown-api__helper">Searching presets…</div>
          ) : (
            suggestions.map((suggestion, index) => {
              const active = index === activeIndex || index === hoveredIndex;
              return (
                <button
                  key={suggestion.id || suggestion.catalogKey || `${suggestion.label}-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  className={`dropdown-api__option${active ? " is-selected" : ""}`}
                  style={horizontalSuggestions ? {
                    flexDirection: "row", // Opt-in layout keeps the description and labour hours on one suggestion row.
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-sm)",
                  } : undefined}
                >
                  <div className="dropdown-api__option-label" style={horizontalSuggestions ? {
                    flex: "1 1 auto", // The description owns the available space before the fixed hours badge.
                    minWidth: 0,
                    textAlign: "left",
                  } : undefined}>
                    <span style={horizontalSuggestions ? {
                      minWidth: 0, // Ellipsis prevents a long description from pushing the hours off the right edge.
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    } : undefined}>
                      {renderHighlightedLabel(suggestion.label, query)}
                    </span>
                  </div>
                  {showHours ? (
                    <span
                      className={`app-badge ${active ? "app-badge--accent-strong" : "app-badge--accent-soft"}`}
                      title="Approximate workshop-planning baseline; use vehicle-specific manufacturer time when available"
                      style={horizontalSuggestions ? {
                        marginLeft: "auto", // Keep labour hours aligned at the far-right edge of every suggestion.
                        flexShrink: 0,
                      } : undefined}
                    >
                      ~{formatBaselineHours(suggestion.defaultHours)}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
