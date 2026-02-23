// file location: /src/components/dropdownAPI/Dropdown.js
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * DropdownAPI
 *
 * A custom dropdown that avoids the native browser select UI in favor of a
 * theme-aware bespoke experience. Options can be strings or objects.
 *
 * Props:
 * - label: floating label text displayed with the control.
 * - placeholder: text shown when nothing is selected.
 * - options: array of strings | numbers | objects.
 * - value: currently selected value (matching option.value or option.key).
 * - onChange: callback receiving (selectedRaw, normalizedOption).
 * - disabled: disables the entire control.
 * - helperText: optional helper/caption text rendered below the control.
 * - className: extra class names for the wrapper.
 * - size: "sm" | "md" for control density tweaks.
 * - id: optional id override for the control button.
 */
export default function Dropdown({
  label,
  placeholder = "Select an option",
  options = [],
  value,
  onChange,
  disabled = false,
  helperText = "",
  className = "",
  size = "md",
  emptyState = "No results found",
  searchable = false,
  searchPlaceholder = "Search options",
  id,
  style,
  controlStyle,
  labelStyle,
  menuStyle,
  optionStyle,
  valueStyle,
  chevronStyle,
  usePortal = true,
  ...rest
}) {
  const extractedControlStyle = style
    ? {
        border: style.border,
        borderColor: style.borderColor,
        borderWidth: style.borderWidth,
        borderStyle: style.borderStyle,
        borderRadius: style.borderRadius,
        background: style.background,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        padding: style.padding,
        fontSize: style.fontSize,
        color: style.color,
        outline: style.outline,
      }
    : undefined;
  const wrapperStyle = style
    ? {
        ...style,
        border: undefined,
        borderColor: undefined,
        borderWidth: undefined,
        borderStyle: undefined,
        borderRadius: undefined,
        background: undefined,
        backgroundColor: undefined,
        boxShadow: undefined,
        padding: undefined,
      }
    : undefined;
  const mergedControlStyle = extractedControlStyle
    ? { ...extractedControlStyle, ...(controlStyle || {}) }
    : controlStyle;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const normalizedOptions = useMemo(
    () =>
      options.map((option, index) => {
        if (typeof option === "string" || typeof option === "number") {
          return {
            key: String(option),
            label: String(option),
            value: option,
            raw: option,
            description: "",
            disabled: false,
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
            option.email ??
            `Option ${index + 1}`;

          return {
            key: String(keyCandidate),
            label: labelCandidate,
            value: option.value ?? option.id ?? option.key ?? option.name ?? "",
            raw: option.raw ?? option,
            description: option.description ?? option.subtitle ?? option.email ?? "",
            meta: option.meta ?? option.tagline ?? "",
            disabled: Boolean(option.disabled),
          };
        }

        return {
          key: `option-${index}`,
          label: `Option ${index + 1}`,
          value: option,
          raw: option,
          description: "",
          disabled: false,
        };
      }),
    [options]
  );

  const selectedOption = useMemo(() => {
    if (value === null || value === undefined) return null;
    return (
      normalizedOptions.find(
        (option) =>
          option.value === value ||
          option.key === value ||
          (typeof value === "object" &&
            option.raw &&
            (option.raw === value ||
              option.raw.id === value.id ||
              option.raw.value === value.value))
      ) ?? null
    );
  }, [value, normalizedOptions]);

  const visibleOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return normalizedOptions;
    const needle = searchTerm.trim().toLowerCase();
    return normalizedOptions.filter((option) => {
      const label = String(option.label ?? "").toLowerCase();
      const description = String(option.description ?? "").toLowerCase();
      const meta = String(option.meta ?? "").toLowerCase();
      return label.includes(needle) || description.includes(needle) || meta.includes(needle);
    });
  }, [normalizedOptions, searchable, searchTerm]);

  const toggle = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  const close = () => setIsOpen(false);

  const handleOptionSelect = (option) => {
    if (disabled || option?.disabled) return;
    onChange?.(option.raw ?? option.value ?? null, option);
    setIsOpen(false);
  };

  const handleControlKeyDown = (event) => {
    if (disabled) return;
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        toggle();
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          close();
        }
        break;
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          return;
        }
        setActiveIndex((prev) => {
          if (visibleOptions.length === 0) return -1;
          const nextIndex = event.key === "ArrowDown" ? prev + 1 : prev - 1;
          if (nextIndex < 0) return visibleOptions.length - 1;
          if (nextIndex >= visibleOptions.length) return 0;
          return nextIndex;
        });
        break;
      case "Tab":
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleOptionKeyDown = (event, option, index) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOptionSelect(option);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const offset = event.key === "ArrowDown" ? 1 : -1;
      if (visibleOptions.length === 0) return;
      const nextIndex = (index + offset + visibleOptions.length) % visibleOptions.length;
      setActiveIndex(nextIndex);
      menuRef.current?.querySelectorAll("[data-option-button]")[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  // Reset active option whenever menu opens
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = selectedOption
        ? visibleOptions.findIndex((option) => option.key === selectedOption.key)
        : -1;
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : visibleOptions.length > 0 ? 0 : -1);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    }
  }, [isOpen, searchable, selectedOption, visibleOptions]);

  useEffect(() => {
    if (!isOpen && searchTerm) {
      setSearchTerm("");
    }
  }, [isOpen, searchTerm]);

  useEffect(() => {
    if (!isOpen) return;
    if (visibleOptions.length === 0) {
      setActiveIndex(-1);
      return;
    }
    if (activeIndex >= visibleOptions.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, isOpen, visibleOptions.length]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event) => {
      if (!dropdownRef.current) return;
      const menuNode = menuRef.current;
      if (!dropdownRef.current.contains(event.target) && !(menuNode && menuNode.contains(event.target))) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return;
    }

    const updateMenuPosition = () => {
      const controlNode = dropdownRef.current?.querySelector(".dropdown-api__control");
      if (!controlNode) return;
      const rect = controlNode.getBoundingClientRect();
      const menuNode = menuRef.current;
      const menuHeight = menuNode?.offsetHeight || 0;
      const gap = 10;
      let top = rect.bottom + gap;
      const left = rect.left;
      const width = rect.width;

      if (menuHeight && top + menuHeight > window.innerHeight - gap) {
        top = Math.max(gap, rect.top - menuHeight - gap);
      }

      setMenuPosition({
        position: "fixed",
        top,
        left,
        width,
        zIndex: 99999,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  // Scroll to focused option
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    const optionNodes = menuRef.current?.querySelectorAll("[data-option-button]");
    const activeNode = optionNodes?.[activeIndex];
    if (activeNode && menuRef.current) {
      const { offsetTop, offsetHeight } = activeNode;
      const { scrollTop, clientHeight } = menuRef.current;
      if (offsetTop < scrollTop) {
        menuRef.current.scrollTop = offsetTop;
      } else if (offsetTop + offsetHeight > scrollTop + clientHeight) {
        menuRef.current.scrollTop = offsetTop - clientHeight + offsetHeight;
      }
    }
  }, [activeIndex, isOpen]);

  const wrapperClasses = [
    "dropdown-api",
    disabled ? "is-disabled" : "",
    isOpen ? "is-open" : "",
    selectedOption ? "has-value" : "",
    size === "sm" ? "dropdown-api--sm" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const reactId = useId();
  const controlId = id || `dropdown-api-${reactId.replace(/[:]/g, "")}`;

  return (
    <div className={wrapperClasses} ref={dropdownRef} style={wrapperStyle} {...rest}>
      {label && (
        <label className="dropdown-api__label" htmlFor={controlId} style={labelStyle}>
          {label}
        </label>
      )}
      <button
        id={controlId}
        type="button"
        className="dropdown-api__control"
        style={mergedControlStyle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={handleControlKeyDown}
        disabled={disabled}
      >
        <span className={`dropdown-api__value ${selectedOption ? "" : "is-placeholder"}`} style={valueStyle}>
          {selectedOption?.label || placeholder}
        </span>
        <span className="dropdown-api__chevron" aria-hidden="true" style={chevronStyle}>
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
        </span>
      </button>
      {helperText && <p className="dropdown-api__helper">{helperText}</p>}

      {isOpen &&
        (() => {
          const menuNode = (
            <div
              className="dropdown-api__menu"
              role="listbox"
              aria-activedescendant={selectedOption ? `${controlId}-${selectedOption.key}` : undefined}
              ref={menuRef}
              style={
                usePortal
                  ? (menuPosition ? { ...(menuStyle || {}), ...menuPosition } : menuStyle)
                  : menuStyle
              }
            >
              {searchable && (
                <div className="dropdown-api__search">
                  <input
                    ref={searchInputRef}
                    type="search"
                    className="dropdown-api__search-input"
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        if (visibleOptions.length === 0) return;
                        setActiveIndex((prev) => {
                          const nextIndex = event.key === "ArrowDown" ? prev + 1 : prev - 1;
                          if (nextIndex < 0) return visibleOptions.length - 1;
                          if (nextIndex >= visibleOptions.length) return 0;
                          return nextIndex;
                        });
                        menuRef.current?.querySelectorAll("[data-option-button]")[0]?.focus();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        close();
                      }
                    }}
                  />
                </div>
              )}
              {visibleOptions.length === 0 && (
                <div className="dropdown-api__empty">{emptyState}</div>
              )}
              {visibleOptions.map((option, index) => {
                const isSelected = selectedOption?.key === option.key;
                return (
                  <button
                    type="button"
                    role="option"
                    data-option-button
                    className={`dropdown-api__option ${isSelected ? "is-selected" : ""} ${
                      option.disabled ? "is-disabled" : ""
                    }`}
                    key={option.key}
                    id={`${controlId}-${option.key}`}
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    disabled={option.disabled}
                    onClick={() => handleOptionSelect(option)}
                    onKeyDown={(event) => handleOptionKeyDown(event, option, index)}
                    style={optionStyle}
                  >
                    <span className="dropdown-api__option-label">{option.label}</span>
                    {(option.description || option.meta) && (
                      <span className="dropdown-api__option-description">
                        {option.description || option.meta}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );

          return usePortal ? createPortal(menuNode, document.body) : menuNode;
        })()}
    </div>
  );
}
