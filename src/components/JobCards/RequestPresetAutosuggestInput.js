// file location: src/components/JobCards/RequestPresetAutosuggestInput.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useJobRequestPresetSuggestions from "@/hooks/useJobRequestPresetSuggestions";

export default function RequestPresetAutosuggestInput({
  value = "",
  onChange = () => {},
  onPresetSelect = () => {},
  placeholder = "Enter job request",
  disabled = false,
  inputStyle = {},
  containerStyle = {},
  suggestionStyle = {},
  showHours = true,
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
    prevExternalValueRef.current = newValue; // prevent sync loop
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
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
        style={inputStyle}
      />

      {showMenu && menuPosition
        ? createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: `${menuPosition.top + 6}px`,
            left: `${menuPosition.left}px`,
            width: `${menuPosition.width}px`,
            backgroundColor: "var(--control-menu-bg)",
            border: "1px solid var(--surface)",
            borderRadius: "var(--radius-md)",
            maxHeight: "280px",
            overflow: "hidden",
            overflowY: "auto",
            zIndex: 4000,
            ...suggestionStyle,
          }}
        >
          {loading ? (
            <div style={{ padding: "14px 16px", fontSize: "0.85rem", color: "var(--text-1)" }}>Searching presets…</div>
          ) : (
            suggestions.map((suggestion, index) => {
              const active = index === activeIndex || index === hoveredIndex;
              return (
                <button
                  key={`${suggestion.id}-${index}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom:
                      index === suggestions.length - 1
                        ? "none"
                        : "1px solid rgba(var(--primary-rgb), 0.14)",
                    backgroundColor: active ? "rgba(var(--primary-rgb), 0.14)" : "transparent",
                    color: active ? "var(--primary)" : "var(--text-1)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      {renderHighlightedLabel(suggestion.label, query)}
                    </span>
                  </div>
                  {showHours ? (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "4px 8px",
                        borderRadius: "var(--radius-pill)",
                        backgroundColor: active ? "var(--primary)" : "rgba(var(--primary-rgb), 0.12)",
                        color: active ? "var(--text-2)" : "var(--primary-selected)",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {Number(suggestion.defaultHours || 0).toFixed(2)}h
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
