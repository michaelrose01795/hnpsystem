// file location: src/components/page-ui/job-cards/service-history/historyFormat.js
// Shared display formatters for the redesigned Service History tab. Pure,
// token-aware helpers — no React, no side effects.

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("en-GB");

// "—" is the canonical empty marker across the tab.
export const DASH = "—";

export const formatCurrency = (value) =>
  typeof value === "number" && Number.isFinite(value) ? GBP.format(value) : DASH;

export const formatMiles = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${NUM.format(value)} mi`
    : DASH;

export const formatNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? NUM.format(value) : DASH;

export const formatText = (value) => {
  const text = String(value ?? "").trim();
  return text || DASH;
};

// Join a job's request items into a single " | "-separated line.
export const joinRequests = (job) => {
  const items = Array.isArray(job?.combinedRequests) ? job.combinedRequests : [];
  const labels = items
    .map((item) => String(item?.text || item?.description || "").trim())
    .filter(Boolean);
  return labels;
};

// Map a raw job status to one of the approved badge tone classes. Falls back to
// the neutral pill so unknown statuses still render a valid badge.
export const statusBadgeClass = (status) => {
  const value = String(status || "").toLowerCase();
  if (/complete|invoiced|paid|collected|finished/.test(value)) return "app-badge--success";
  if (/cancel|declin|reject|fail/.test(value)) return "app-badge--danger";
  if (/progress|workshop|await|wait|parts|booked|started/.test(value)) return "app-badge--warning";
  return "app-badge--neutral";
};
