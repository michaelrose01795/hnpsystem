// file location: src/lib/status/statusHelpers.js
// Unified status predicates and Sets built on the canonical catalogs.
// Import these instead of scattering inline status string checks across pages and components.

import { STATUSES as JOB, NORMALIZE as NORMALIZE_JOB } from "@/lib/status/catalog/job";
import { STATUSES as ACCOUNTS } from "@/lib/status/catalog/accounts";
import { normalizeDecision, isAuthorizedLike as vhcIsAuthorizedLike } from "@/lib/vhc/vhcItemState";

// ---------------------------------------------------------------------------
// Job status helpers
// ---------------------------------------------------------------------------

/** Canonical IDs that mean "job is no longer active". */
export const INACTIVE_JOB_IDS = new Set([ // Used for filtering out finished jobs in lists.
  JOB.INVOICED, // "invoiced"
  JOB.RELEASED, // "released"
]);

/** Display-label variants that mean "completed / no longer active" (case-insensitive match via normalizeJobStatus). */
const COMPLETED_JOB_LABELS = new Set([ // All known display labels that map to a terminal state.
  "complete",
  "completed",
  "collected",
  "closed",
  "finished",
  "invoiced",
  "cancelled",
  "released",
]);

/** Returns true when a raw status string resolves to a completed/inactive job. */
export const isInactiveJobStatus = (status) => { // Accepts any casing, legacy or canonical.
  if (!status) return false; // Null guard.
  const lower = String(status).trim().toLowerCase(); // Normalize.
  if (COMPLETED_JOB_LABELS.has(lower)) return true; // Direct display-label hit.
  const normalized = NORMALIZE_JOB(status); // Try catalog normalization.
  return normalized === JOB.INVOICED || normalized === JOB.RELEASED; // Canonical terminal states.
};

/** Returns true when a raw status string resolves to a completed/closed job (excludes "invoiced" as a standalone state). */
export const isCompletedJobStatus = (status) => { // Stricter — only "released"-family.
  if (!status) return false; // Null guard.
  const normalized = NORMALIZE_JOB(status); // Resolve through catalog.
  return normalized === JOB.RELEASED; // Only the terminal state.
};

/** Returns true when a status should exclude a job from active clock-on lists. */
export const isClockOffExcluded = (status) => { // Jobs that technicians cannot clock onto.
  return isInactiveJobStatus(status); // Same set — completed jobs are excluded.
};

// ---------------------------------------------------------------------------
// Invoice status helpers
// ---------------------------------------------------------------------------

/** Returns true when payment_status indicates the invoice is paid. */
export const isInvoicePaid = (paymentStatus) => { // Accepts raw DB value.
  if (!paymentStatus && paymentStatus !== false) return false; // Null guard (preserve boolean `false`).
  return String(paymentStatus).trim().toLowerCase() === "paid"; // Simple lowercase compare.
};

/** Returns true when payment_status indicates the invoice is cancelled. */
export const isInvoiceCancelled = (paymentStatus) => { // Accepts raw DB value.
  if (!paymentStatus) return false; // Null guard.
  const lower = String(paymentStatus).trim().toLowerCase(); // Normalize.
  return lower === "cancelled" || lower === "canceled"; // Both spellings.
};

/** Returns true when the invoice is in a terminal state (paid or cancelled). */
export const isInvoiceSettled = (paymentStatus) => { // No further action needed.
  return isInvoicePaid(paymentStatus) || isInvoiceCancelled(paymentStatus); // Either terminal.
};

/** Returns true when an invoice row should be considered paid (checks both `paid` boolean and `payment_status`). */
export const isInvoiceRowPaid = (row) => { // Handles the dual-field pattern in the invoices table.
  if (!row) return false; // Null guard.
  if (row.paid === true) return true; // Boolean field takes priority.
  return isInvoicePaid(row.payment_status); // Fall back to status string.
};

// ---------------------------------------------------------------------------
// VHC decision helpers (re-exports for convenience)
// ---------------------------------------------------------------------------

/** Returns true when a raw VHC decision/approval value means "authorized" (work should proceed). */
export const isAuthorisedDecision = (value) => { // Handles authorised/authorized/approved/completed.
  const decision = normalizeDecision(value); // Canonical normalization from vhcItemState.
  return vhcIsAuthorizedLike(decision); // authorized or completed.
};

/** Returns true when a request_source value indicates VHC authorization. */
export const isVhcAuthorisedSource = (value) => { // For parts/invoice linking.
  const lower = String(value || "").trim().toLowerCase(); // Normalize.
  return lower === "vhc_authorised" || lower === "vhc_authorized"; // Both spellings.
};

// ---------------------------------------------------------------------------
// Invoice status constants (for dropdown/filter use)
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = [ // Ordered list for UI dropdowns.
  ACCOUNTS.INVOICE_DRAFT, // "Draft"
  ACCOUNTS.INVOICE_SENT, // "Sent"
  ACCOUNTS.INVOICE_PAID, // "Paid"
  ACCOUNTS.INVOICE_OVERDUE, // "Overdue"
  ACCOUNTS.INVOICE_CANCELLED, // "Cancelled"
];
