// file location: src/components/vhc/IssueAutocomplete.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getIssueSuggestions, resolveIssueSectionKey } from "@/lib/vhc/issueSuggestions";

const DEBOUNCE_MS = 150;
const DISPLAY_LIMIT = 12;

const baseInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  backgroundColor: "var(--surface)",
  fontSize: "14px",
  color: "var(--text-primary)",
  outline: "none",
  boxShadow: "none",
};

const wrapperStyle = {
  position: "relative",
  width: "100%",
};

const dropdownStyle = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  boxShadow: "0 8px 24px rgba(var(--shadow-rgb), 0.12)",
  maxHeight: "220px",
  overflowY: "auto",
  zIndex: 30,
  WebkitOverflowScrolling: "touch",
};

const rowStyle = {
  width: "100%",
  border: "none",
  background: "transparent",
  textAlign: "left",
  padding: "10px 12px",
  fontSize: "13px",
  color: "var(--text-primary)",
  cursor: "pointer",
};

const mutedRowStyle = {
  ...rowStyle,
  color: "var(--text-secondary)",
  cursor: "default",
};

const normaliseText = (value = "") => value.toString().toLowerCase();

const buildHighlightParts = (text = "", query = "") => {
  const source = text.toString();
  const normalizedSource = normaliseText(source);
  const normalizedQuery = normaliseText(query).trim();

  if (!normalizedQuery) {
    return [{ text: source, highlight: false }];
  }

  const directIndex = normalizedSource.indexOf(normalizedQuery);
  if (directIndex >= 0) {
    return [
      { text: source.slice(0, directIndex), highlight: false },
      { text: source.slice(directIndex, directIndex + normalizedQuery.length), highlight: true },
      { text: source.slice(directIndex + normalizedQuery.length), highlight: false },
    ].filter((part) => part.text);
  }

  const queryChars = normalizedQuery.split("");
  const parts = [];
  let queryIndex = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const isHighlight = queryIndex < queryChars.length && normalizedSource[index] === queryChars[queryIndex];
    if (isHighlight) {
      queryIndex += 1;
    }

    const previous = parts[parts.length - 1];
    if (previous && previous.highlight === isHighlight) {
      previous.text += char;
    } else {
      parts.push({ text: char, highlight: isHighlight });
    }
  }

  if (queryIndex !== queryChars.length) {
    return [{ text: source, highlight: false }];
  }

  return parts;
};

export default function IssueAutocomplete({
  sectionKey,
  value,
  onChange,
  onSelect,
  disabled = false,
  placeholder = "Describe the issue...",
  inputStyle,
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [results, setResults] = useState([]);

  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const query = value || "";
  const resolvedSectionKey = useMemo(() => resolveIssueSectionKey(sectionKey || ""), [sectionKey]);

  useEffect(() => {
    if (!open || disabled) return undefined;
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 1) {
      setResults([]);
      setActiveIndex(-1);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      const nextResults = getIssueSuggestions(resolvedSectionKey, trimmedQuery, DISPLAY_LIMIT);
      setResults(nextResults);
      setActiveIndex(nextResults.length > 0 ? 0 : -1);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, disabled, query, resolvedSectionKey]);

  useEffect(() => {
    const handleOutsideMouseDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
      setActiveIndex(-1);
    };

    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, []);

  const isDropdownVisible = open && !disabled && query.trim().length >= 1;

  const handleSelect = (selection) => {
    if (typeof onChange === "function") {
      onChange(selection);
    }
    if (typeof onSelect === "function") {
      onSelect(selection);
    }
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={rootRef} style={wrapperStyle}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => {
          if (typeof onChange === "function") {
            onChange(event.target.value);
          }
          if (!disabled) {
            setOpen(true);
          }
        }}
        onFocus={() => {
          if (disabled) return;
          if ((value || "").trim().length >= 1) {
            setOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (!isDropdownVisible) return;

          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((previous) => (previous + 1) % results.length);
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            if (results.length === 0) return;
            setActiveIndex((previous) => (previous <= 0 ? results.length - 1 : previous - 1));
            return;
          }

          if (event.key === "Enter") {
            if (activeIndex < 0 || activeIndex >= results.length) return;
            event.preventDefault();
            handleSelect(results[activeIndex]);
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        readOnly={disabled}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        style={{ ...baseInputStyle, ...(inputStyle || {}) }}
      />

      {isDropdownVisible ? (
        <div style={dropdownStyle}>
          {loading ? (
            <div style={mutedRowStyle}>Loading suggestions...</div>
          ) : results.length === 0 ? (
            <div style={mutedRowStyle}>No suggestions</div>
          ) : (
            results.map((suggestion, index) => {
              const isActive = index === activeIndex;
              const parts = buildHighlightParts(suggestion, query);

              return (
                <button
                  key={`${suggestion}-${index}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    ...rowStyle,
                    backgroundColor: isActive ? "var(--accent-purple-surface)" : "transparent",
                  }}
                >
                  {parts.map((part, partIndex) =>
                    part.highlight ? (
                      <strong key={`${suggestion}-part-${partIndex}`}>{part.text}</strong>
                    ) : (
                      <span key={`${suggestion}-part-${partIndex}`}>{part.text}</span>
                    ),
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
