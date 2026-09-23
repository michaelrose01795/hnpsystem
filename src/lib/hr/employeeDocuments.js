// file location: src/lib/hr/employeeDocuments.js
// Business logic for HR employee document records.
//
// The document rows themselves come from `users.documents` (normalised in
// src/lib/database/hr.js -> normalizeDocuments). Everything here is derivation
// only: it turns the stored `status` / `expiresOn` values into the labels the
// HR Employees profile panel shows, so the panel stays presentation-only and
// no second copy of the rules leaks into a component.

// A document inside this window is "Expiring Soon" rather than "Current".
export const DOCUMENT_EXPIRY_WARNING_DAYS = 30;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Statuses a document row may carry explicitly. Anything not listed falls back
// to the expiry date, and then to no status at all.
const EXPLICIT_STATUS_TONES = {
  verified: { label: "Verified", tone: "success" },
  signed: { label: "Signed", tone: "success" },
  approved: { label: "Verified", tone: "success" },
  current: { label: "Current", tone: "success" },
  active: { label: "Current", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  awaiting: { label: "Pending", tone: "warning" },
  unsigned: { label: "Unsigned", tone: "warning" },
  "expiring soon": { label: "Expiring Soon", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  rejected: { label: "Rejected", tone: "danger" },
};

export function toDocumentDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function daysUntilExpiry(value, now = new Date()) {
  const expiry = toDocumentDate(value);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - now.getTime()) / MS_PER_DAY);
}

/**
 * Resolve the status badge for one document.
 * Returns `{ label, tone }` where `tone` is a StatusTag tone, or `null` when the
 * record carries neither an explicit status nor an expiry date to derive one from.
 */
export function resolveDocumentStatus(doc, now = new Date()) {
  const explicit = String(doc?.status || "").trim().toLowerCase();
  if (explicit && EXPLICIT_STATUS_TONES[explicit]) {
    return EXPLICIT_STATUS_TONES[explicit];
  }
  if (explicit) {
    // Unknown but present — show it rather than dropping information.
    return { label: explicit.replace(/\b\w/g, (char) => char.toUpperCase()), tone: "default" };
  }

  const days = daysUntilExpiry(doc?.expiresOn, now);
  if (days === null) return null;
  if (days < 0) return { label: "Expired", tone: "danger" };
  if (days <= DOCUMENT_EXPIRY_WARNING_DAYS) return { label: "Expiring Soon", tone: "warning" };
  return { label: "Current", tone: "success" };
}

// `category` is optional in the stored payload; fall back to the legacy `type`
// field so existing records keep showing something meaningful.
export function resolveDocumentCategory(doc) {
  const category = String(doc?.category || doc?.type || "").trim();
  if (!category) return "";
  if (category === category.toLowerCase()) {
    return category.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return category;
}
