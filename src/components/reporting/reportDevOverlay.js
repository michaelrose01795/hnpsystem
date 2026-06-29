// file location: src/components/reporting/reportDevOverlay.js
//
// Small helpers for stable dev-overlay keys in the shared reporting UI. Keys
// are route-local, so they only need to be deterministic within one report page.

export const sanitizeReportDevKey = (value, fallback = "report-section") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || fallback;
};

export const reportDevKey = (prefix, value, fallback = "item") =>
  sanitizeReportDevKey(`${prefix}-${value || fallback}`, `${prefix}-${fallback}`);
