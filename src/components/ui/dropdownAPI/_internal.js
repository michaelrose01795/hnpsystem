// file location: src/components/ui/dropdownAPI/_internal.js
//
// Shared internals for the dropdown family (Dropdown, MultiSelectDropdown,
// DropdownField). Public components import from here so option-shape
// handling, the chevron glyph, and outside-click behaviour have a single
// source of truth.
import React, { useEffect } from "react";

// Normalise a raw option (string | number | object) into the shape the
// dropdown components render against. `opts.includeDescription` enables the
// description/meta fields that the single-select Dropdown uses but the
// MultiSelect does not need.
export function normalizeOption(option, index, opts = {}) {
  const { includeDescription = false } = opts;

  if (typeof option === "string" || typeof option === "number") {
    const base = {
      key: String(option),
      label: String(option),
      value: option,
      raw: option,
      disabled: false,
    };
    return includeDescription ? { ...base, description: "", meta: "" } : base;
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

    const base = {
      key: String(keyCandidate),
      label: labelCandidate,
      value: option.value ?? option.id ?? option.key ?? option.name ?? "",
      raw: option.raw ?? option,
      disabled: Boolean(option.disabled),
    };

    if (includeDescription) {
      return {
        ...base,
        description: option.description ?? option.subtitle ?? option.email ?? "",
        meta: option.meta ?? option.tagline ?? "",
      };
    }
    return base;
  }

  const fallback = {
    key: `option-${index}`,
    label: `Option ${index + 1}`,
    value: option,
    raw: option,
    disabled: false,
  };
  return includeDescription ? { ...fallback, description: "", meta: "" } : fallback;
}

export function normalizeOptions(options, opts) {
  return options.map((option, index) => normalizeOption(option, index, opts));
}

// Filter the normalised options by a search needle. `fields` controls which
// option properties are matched against.
export function filterOptionsBySearch(options, searchTerm, fields = ["label"]) {
  if (!searchTerm || !searchTerm.trim()) return options;
  const needle = searchTerm.trim().toLowerCase();
  return options.filter((option) =>
    fields.some((field) => String(option[field] ?? "").toLowerCase().includes(needle))
  );
}

// Close-on-outside-click hook. Pass an array of refs — any node contained in
// any of them is considered "inside".
export function useOutsideClick(refs, onOutside, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handleClick = (event) => {
      const list = Array.isArray(refs) ? refs : [refs];
      const insideAny = list.some((ref) => ref?.current?.contains(event.target));
      if (!insideAny) onOutside(event);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [enabled, onOutside, refs]);
}

// Shared chevron glyph. Rendered inline so the arrow stays identical across
// dropdown variants.
export function DropdownChevron() {
  return (
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
  );
}
