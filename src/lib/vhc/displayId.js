// file location: src/lib/vhc/displayId.js
// Shared helpers for computing stable VHC display IDs.
// Used by both the save path (saveVhcItem.js) and the read path (VhcDetailsPanel.js)
// to ensure the same item always gets the same display_id.

export const normalizeText = (value = "") => value.toString().toLowerCase();

export const hashString = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const LOCATION_TOKENS = [
  { key: "front_left", terms: ["front left", "nearside front", "nsf", "left front"] },
  { key: "front_right", terms: ["front right", "offside front", "osf", "right front"] },
  { key: "rear_left", terms: ["rear left", "nearside rear", "nsr", "left rear"] },
  { key: "rear_right", terms: ["rear right", "offside rear", "osr", "right rear"] },
  { key: "front", terms: ["front"] },
  { key: "rear", terms: ["rear"] },
];

export const resolveLocationKey = (item = {}) => {
  const haystack = normalizeText(
    `${item.label || ""} ${item.issue_title || ""} ${item.notes || item.issue_description || ""}`
  );
  for (const token of LOCATION_TOKENS) {
    if (token.terms.some((term) => haystack.includes(term))) {
      return token.key;
    }
  }
  return null;
};

export const formatMeasurement = (value) => {
  if (!value && value !== 0) return null;
  if (Array.isArray(value)) {
    const merged = value.filter(Boolean).map((item) => item.toString().trim()).join(" / ");
    return merged || null;
  }
  if (typeof value === "object") {
    const merged = Object.values(value)
      .filter(Boolean)
      .map((item) => item.toString().trim())
      .join(" / ");
    return merged || null;
  }
  return value.toString();
};

export const buildStableDisplayId = (sectionName, item = {}, index = 0) => {
  const heading =
    item.heading || item.label || item.issue_title || item.name || item.title || sectionName || "";
  const primaryConcern =
    Array.isArray(item.concerns) && item.concerns.length > 0
      ? item.concerns[0]?.text || item.concerns[0]?.issue || item.concerns[0]?.description || ""
      : "";
  const rowText = Array.isArray(item.rows)
    ? item.rows.map((row) => row.toString().trim()).filter(Boolean).join("|")
    : "";
  const measurement = formatMeasurement(item.measurement) || "";
  const locationKey = resolveLocationKey(item) || "";
  const wheelKey = item.wheelKey || "";
  const rawKey = `${sectionName}|${heading}|${primaryConcern}|${rowText}|${measurement}|${locationKey}|${wheelKey}`;
  const hashed = hashString(normalizeText(rawKey));
  if (hashed) {
    return `vhc-${hashed}`;
  }
  return `vhc-${normalizeText(sectionName).replace(/\s+/g, "-")}-${index}`;
};
