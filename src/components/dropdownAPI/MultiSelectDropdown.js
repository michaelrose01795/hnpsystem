// file location: /src/components/dropdownAPI/MultiSelectDropdown.js
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { dropdownTriggerButtonStyle } from "@/styles/appTheme";

/**
 * MultiSelectDropdownAPI
 *
 * A custom multi-select dropdown that follows the dropdown API style.
 * Supports selecting multiple options with a clean, theme-aware UI.
 *
 * Props:
 * - label: floating label text displayed with the control.
 * - placeholder: text shown when nothing is selected.
 * - options: array of strings | numbers | objects.
 * - value: array of currently selected values.
 * - onChange: callback receiving (selectedValues).
 * - disabled: disables the entire control.
 * - helperText: optional helper/caption text rendered below the control.
 * - className: extra class names for the wrapper.
 * - size: "sm" | "md" for control density tweaks.
 * - id: optional id override for the control button.
 * - emptyState: message shown when no options are available.
 * - maxHeight: maximum height for the dropdown menu (default: "280px").
 */
export default function MultiSelectDropdown({
  label,
  placeholder = "Select departments",
  options = [],
  value = [],
  onChange,
  disabled = false,
  helperText = "",
  className = "",
  size = "md",
  emptyState = "No options available",
  id,
  maxHeight = "280px",
  searchPlaceholder = "Search options",
  noSearchResultsText = "No options match your search",
  ...rest
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const controlInputRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      options.map((option, index) => {
        if (typeof option === "string" || typeof option === "number") {
          return {
            key: String(option),
            label: String(option),
            value: option,
            raw: option,
          };
        }

        if (option && typeof option === "object") {
          const keyCandidate =
            option.key ??
            option.id ??
            option.value ??
            option.name ??
            option.label ??
            index;
          const labelCandidate =
            option.label ??
            option.name ??
            option.title ??
            option.displayName ??
            option.value ??
            `Option ${index + 1}`;

          return {
            key: String(keyCandidate),
            label: labelCandidate,
            value: option.value ?? option.id ?? option.key ?? option.name ?? "",
            raw: option.raw ?? option,
          };
        }

        return {
          key: `option-${index}`,
          label: `Option ${index + 1}`,
          value: option,
          raw: option,
        };
      }),
    [options]
  );

  const selectedOptions = useMemo(() => {
    if (!Array.isArray(value) || value.length === 0) return [];
    return normalizedOptions.filter((option) =>
      value.some(
        (v) =>
          v === option.value ||
          v === option.key ||
          v === option.raw ||
          (typeof v === "object" &&
            option.raw &&
            (v === option.raw || v.id === option.raw.id))
      )
    );
  }, [value, normalizedOptions]);

  const visibleOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const needle = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter((option) => {
      const label = String(option.label || "").toLowerCase();
      const valueText = String(option.value ?? "").toLowerCase();
      return label.includes(needle) || valueText.includes(needle);
    });
  }, [normalizedOptions, searchTerm]);

  const toggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const close = () => setIsOpen(false);

  const handleOptionToggle = (option) => {
    if (disabled) return;

    const isSelected = selectedOptions.some((opt) => opt.key === option.key);
    let newValues;

    if (isSelected) {
      // Remove from selection
      newValues = value.filter((v) => {
        if (typeof v === "object" && typeof option.raw === "object") {
          return v !== option.raw && v.id !== option.raw.id;
        }
        return v !== option.value && v !== option.key && v !== option.raw;
      });
    } else {
      // Add to selection
      newValues = [...value, option.raw ?? option.value];
    }

    onChange?.(newValues);
  };

  const handleRemoveOption = (option, event) => {
    event?.stopPropagation();
    handleOptionToggle(option);
  };

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      return;
    }
    setTimeout(() => controlInputRef.current?.focus(), 0);
  }, [isOpen]);

  const controlPlaceholder =
    selectedOptions.length > 0 && !isOpen
      ? `${selectedOptions.length} selected`
      : searchPlaceholder || placeholder;

  const wrapperClasses = [
    "dropdown-api",
    "multiselect-dropdown-api",
    disabled ? "is-disabled" : "",
    isOpen ? "is-open" : "",
    selectedOptions.length > 0 ? "has-value" : "",
    size === "sm" ? "dropdown-api--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const reactId = useId();
  const controlId = id || `multiselect-dropdown-api-${reactId.replace(/[:]/g, "")}`;

  return (
    <div className={wrapperClasses} ref={dropdownRef} {...rest}>
      {label && (
        <label className="dropdown-api__label" htmlFor={controlId}>
          {label}
        </label>
      )}

      {/* Selected items display */}
      {selectedOptions.length > 0 && (
        <div className="multiselect-dropdown-api__selected-items">
          {selectedOptions.map((option) => (
            <span key={option.key} className="multiselect-dropdown-api__tag">
              {option.label}
              <button
                type="button"
                onClick={(e) => handleRemoveOption(option, e)}
                className="multiselect-dropdown-api__tag-remove"
                aria-label={`Remove ${option.label}`}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Searchable control */}
      <div
        className="dropdown-api__control"
        style={dropdownTriggerButtonStyle}
        onClick={() => controlInputRef.current?.focus()}
      >
        <input
          id={controlId}
          ref={controlInputRef}
          type="search"
          className="dropdown-api__search-input"
          style={{
            border: "none",
            background: "var(--surface)",
            padding: 0,
            boxShadow: "none",
            flex: 1,
          }}
          placeholder={controlPlaceholder}
          value={searchTerm}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          onFocus={open}
          onClick={(event) => {
            event.stopPropagation();
            open();
          }}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            if (!isOpen) open();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              close();
              return;
            }
            if (event.key === "Tab") {
              close();
            }
            if (event.key === "Enter" || event.key === "ArrowDown") {
              open();
            }
          }}
        />
        <button
          type="button"
          className="dropdown-api__chevron"
          style={{
            border: "none",
            background: "var(--surface)",
            padding: 0,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          aria-label={isOpen ? "Close options" : "Open options"}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
            setTimeout(() => controlInputRef.current?.focus(), 0);
          }}
          disabled={disabled}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" role="presentation">
            <path
              d="M4.5 6l3.5 3.5L11.5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      {helperText && <p className="dropdown-api__helper">{helperText}</p>}

      {/* Dropdown menu */}
      <div
        className="dropdown-api__menu"
        role="listbox"
        aria-multiselectable="true"
        hidden={!isOpen}
        ref={menuRef}
        style={{ maxHeight }}
      >
        {normalizedOptions.length === 0 && (
          <div className="dropdown-api__empty">{emptyState}</div>
        )}
        {normalizedOptions.length > 0 && visibleOptions.length === 0 && (
          <div className="dropdown-api__empty">{noSearchResultsText}</div>
        )}
        {visibleOptions.map((option) => {
          const isSelected = selectedOptions.some((opt) => opt.key === option.key);
          return (
            <button
              type="button"
              role="option"
              className={`dropdown-api__option multiselect-dropdown-api__option ${
                isSelected ? "is-selected" : ""
              }`}
              key={option.key}
              id={`${controlId}-${option.key}`}
              aria-selected={isSelected}
              onClick={() => handleOptionToggle(option)}
            >
              <span className="dropdown-api__option-label">{option.label}</span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="multiselect-dropdown-api__checkbox"
                tabIndex={-1}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
