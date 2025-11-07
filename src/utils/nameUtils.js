// file location: src/utils/nameUtils.js

/**
 * Normalise a human-readable display name so different variants
 * (case, parentheses, trailing role hints) still match.
 */
export const normalizeDisplayName = (value) => {
  if (!value) return "";

  return String(value)
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // strip parenthetical notes
    .replace(/\s-\s.*$/, "") // strip " - role" suffixes
    .replace(/[^a-z0-9]+/g, " ") // collapse punctuation to spaces
    .trim();
};

/**
 * Convenience helper for comparing two display names using the same normalisation.
 */
export const displayNamesMatch = (a, b) =>
  normalizeDisplayName(a) !== "" &&
  normalizeDisplayName(a) === normalizeDisplayName(b);
