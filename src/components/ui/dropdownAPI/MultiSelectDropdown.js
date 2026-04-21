// file location: src/components/ui/dropdownAPI/MultiSelectDropdown.js
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { dropdownTriggerButtonStyle } from "@/styles/appTheme";
import {
  normalizeOptions,
  filterOptionsBySearch,
  useOutsideClick,
  DropdownChevron,
} from "./_internal";

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

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);

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

  const visibleOptions = useMemo(
    () => filterOptionsBySearch(normalizedOptions, searchTerm, ["label", "value"]),
    [normalizedOptions, searchTerm]
  );

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

  const open = () => {
    if (disabled) return;
    setIsOpen(true);
  };

  useOutsideClick(dropdownRef, () => setIsOpen(false), isOpen);

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

      {/* Container = search bar only. Selections are surfaced via the
          row-level checkmarks in the dropdown list and the "N selected"
          placeholder text (see controlPlaceholder). */}

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
          className="dropdown-api__search-input multiselect-dropdown-api__search-input"
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
          className="dropdown-api__chevron multiselect-dropdown-api__chevron"
          aria-label={isOpen ? "Close options" : "Open options"}
          onClick={(event) => {
            event.stopPropagation();
            toggle();
            setTimeout(() => controlInputRef.current?.focus(), 0);
          }}
          disabled={disabled}
        >
          <DropdownChevron />
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
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="multiselect-dropdown-api__checkbox"
                tabIndex={-1}
                aria-hidden="true"
              />
              <span className="dropdown-api__option-label">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
