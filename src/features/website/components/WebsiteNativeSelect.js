// file location: src/features/website/components/WebsiteNativeSelect.js
// /website select control with a real native <select> kept for form value
// plumbing, plus a custom-rendered list so the opened menu can match the
// customer dark-glass surface.

import { useCallback, useEffect, useId, useRef, useState } from "react";

export default function WebsiteNativeSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  disabled = false,
  className = "",
  id,
  required,
  name,
}) {
  const fallbackId = useId();
  const selectId = id || `website-native-select-${fallbackId}`;
  const listId = `${selectId}-listbox`;
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const selected = options.find((option) => String(option.value) === String(value));
  const displayText = selected?.label || placeholder;

  const commitValue = useCallback((nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  }, [onChange]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocDown = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
    };

    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIdx((current) => Math.min(options.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIdx((current) => Math.max(0, current - 1));
      } else if (event.key === "Enter" && activeIdx >= 0 && options[activeIdx]) {
        event.preventDefault();
        commitValue(options[activeIdx].value);
      }
    };

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [activeIdx, commitValue, open, options]);

  useEffect(() => {
    if (!open) return;
    const selectedIdx = options.findIndex((option) => String(option.value) === String(value));
    setActiveIdx(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, options, value]);

  return (
    <div
      ref={rootRef}
      className="website-native-select"
      data-open={open ? "true" : "false"}
    >
      <select
        id={selectId}
        name={name}
        required={required}
        disabled={disabled}
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
        className="app-btn website-native-select__field"
        tabIndex={-1}
        aria-hidden="true"
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option, idx) => (
          <option key={`${option.value}-${idx}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`website-native-select__trigger ${className}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={
            selected
              ? "website-native-select__value"
              : "website-native-select__placeholder"
          }
        >
          {displayText}
        </span>
        <span className="website-native-select__caret" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={selectId}
          className="website-native-select__menu"
        >
          {options.length === 0 ? (
            <li className="website-native-select__empty">No options</li>
          ) : (
            options.map((option, idx) => {
              const isSelected = String(option.value) === String(value);
              const isActive = idx === activeIdx;
              return (
                <li
                  key={`${option.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`website-native-select__option ${
                    isSelected ? "website-native-select__option--selected" : ""
                  } ${isActive ? "website-native-select__option--active" : ""}`}
                  onMouseEnter={() => setActiveIdx(idx)}
                  onClick={() => commitValue(option.value)}
                >
                  <span className="website-native-select__option-label">{option.label}</span>
                  {option.hint ? (
                    <span className="website-native-select__option-hint">{option.hint}</span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
