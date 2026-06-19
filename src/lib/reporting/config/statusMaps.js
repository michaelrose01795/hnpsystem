// file location: src/lib/reporting/config/statusMaps.js
//
// PRIORITY 3 — Status normalisation support (Phase-2 §13.2, Risk R3).
//
// Free-text statuses across the system drift (`authorized` vs `authorised`,
// casing, legacy values). Reporting collapses known variants to ONE canonical
// value before any GROUP BY / aggregation so metrics don't fragment.
//
// This is the single place every reporting query/aggregation normalises status.
// CHECK constraints come later (P7); until then this map is the guard.
//
// The maps verify against the live schema (schemaReference.sql):
//   - vhc_checks.approval_status CHECK allows BOTH 'authorized' AND 'authorised'.
//   - parts_job_items.status — 14-value CHECK enum.
//   - invoices.payment_status — free text (default 'Draft').
//   - jobs.status — free text (default 'New').

const clean = (value) =>
  String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

// --- Jobs -----------------------------------------------------------------
// Canonical lifecycle: booked → checked_in → in_progress → invoiced → released.
// (Phase-2 §6.2.1; `cancelled`/`completed` normalise to `released`.)
const JOB_STATUS_MAP = {
  new: "booked",
  booked: "booked",
  booked_in: "checked_in",
  checked_in: "checked_in",
  checkedin: "checked_in",
  arrived: "checked_in",
  in_progress: "in_progress",
  inprogress: "in_progress",
  started: "in_progress",
  working: "in_progress",
  invoiced: "invoiced",
  ready: "invoiced",
  completed: "released",
  complete: "released",
  released: "released",
  collected: "released",
  cancelled: "released",
  canceled: "released",
};

// --- Parts (parts_job_items.status — 14-value enum, already constrained) ---
const PART_STATUS_MAP = {
  pending: "pending",
  waiting_authorisation: "waiting_authorisation",
  waiting_authorization: "waiting_authorisation",
  awaiting_stock: "awaiting_stock",
  on_order: "on_order",
  ordered: "on_order",
  booked: "booked",
  allocated: "allocated",
  pre_picked: "pre_picked",
  prepicked: "pre_picked",
  picked: "picked",
  loaded: "loaded",
  stock: "stock",
  in_stock: "stock",
  fitted: "fitted",
  cancelled: "cancelled",
  canceled: "cancelled",
  removed: "removed",
  unavailable: "unavailable",
};

// --- VHC approval (vhc_checks.approval_status — note dual spelling) --------
const VHC_APPROVAL_MAP = {
  pending: "pending",
  authorized: "authorised",
  authorised: "authorised",
  approved: "authorised",
  declined: "declined",
  rejected: "declined",
  completed: "completed",
  complete: "completed",
  "n/a": "na",
  na: "na",
};

// --- VHC item workflow (derived projection — decision-level canonical) -----
const VHC_ITEM_STATUS_MAP = {
  new: "new",
  awaiting_customer: "awaiting_customer",
  awaiting: "awaiting_customer",
  approved: "approved",
  authorised: "approved",
  authorized: "approved",
  in_progress: "in_progress",
  completed: "completed",
  complete: "completed",
  declined: "declined",
  reopened: "awaiting_customer",
};

// --- Invoice payment_status -----------------------------------------------
const INVOICE_STATUS_MAP = {
  draft: "draft",
  sent: "sent",
  issued: "sent",
  unpaid: "sent",
  overdue: "overdue",
  paid: "paid",
  part_paid: "part_paid",
  partially_paid: "part_paid",
  cancelled: "cancelled",
  canceled: "cancelled",
  voided: "cancelled",
};

// --- Account status -------------------------------------------------------
const ACCOUNT_STATUS_MAP = {
  active: "active",
  frozen: "frozen",
  on_hold: "frozen",
  closed: "closed",
  suspended: "frozen",
};

// --- Appointment status ---------------------------------------------------
const APPOINTMENT_STATUS_MAP = {
  booked: "booked",
  confirmed: "confirmed",
  arrived: "arrived",
  completed: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
  no_show: "no_show",
  noshow: "no_show",
};

// --- MOT result proxy (jobs.completion_status today; mot_tests.result later) -
// Mutually-exclusive buckets prevent the old dashboard's overlapping ILIKE
// counts (e.g. "failed retest" matching both fail and retest). Unknown values
// survive as cleaned raw strings for data-quality visibility.
const MOT_RESULT_MAP = {
  pass: "pass",
  passed: "pass",
  mot_pass: "pass",
  mot_passed: "pass",
  fail: "fail",
  failed: "fail",
  mot_fail: "fail",
  mot_failed: "fail",
  retest: "retest",
  re_test: "retest",
  retest_required: "retest",
  retest_pass: "retest",
  retest_failed: "retest",
  aborted: "aborted",
  cancelled: "cancelled",
  canceled: "cancelled",
};

// Registry keyed by entity type. Add a new entity by adding a map here.
export const STATUS_MAPS = Object.freeze({
  job: JOB_STATUS_MAP,
  part: PART_STATUS_MAP,
  parts_job_item: PART_STATUS_MAP,
  vhc_approval: VHC_APPROVAL_MAP,
  vhc_item: VHC_ITEM_STATUS_MAP,
  invoice: INVOICE_STATUS_MAP,
  account: ACCOUNT_STATUS_MAP,
  appointment: APPOINTMENT_STATUS_MAP,
  mot_result: MOT_RESULT_MAP,
});

// The canonical state machine per entity (Phase-2 §6.2). Used by the data-quality
// layer / status validation to flag out-of-model values (drift detection §13.1).
export const STATUS_MODELS = Object.freeze({
  job: ["booked", "checked_in", "in_progress", "invoiced", "released"],
  part: [
    "pending", "waiting_authorisation", "awaiting_stock", "on_order", "booked",
    "allocated", "pre_picked", "picked", "loaded", "stock", "fitted",
    "cancelled", "removed", "unavailable",
  ],
  vhc_item: ["new", "awaiting_customer", "approved", "in_progress", "completed", "declined"],
  invoice: ["draft", "sent", "overdue", "paid", "part_paid", "cancelled"],
  account: ["active", "frozen", "closed"],
  appointment: ["booked", "confirmed", "arrived", "completed", "cancelled", "no_show"],
  mot_result: ["pass", "fail", "retest", "aborted", "cancelled"],
});

// Normalise a raw status for an entity type. Returns the canonical value, or
// the cleaned raw value when no mapping exists (so unknown values survive for
// drift detection rather than being silently dropped).
export function normaliseStatus(entityType, rawValue) {
  if (rawValue == null || rawValue === "") return null;
  const map = STATUS_MAPS[entityType];
  const key = clean(rawValue);
  if (map && map[key]) return map[key];
  return key;
}

// Is a (normalised) status within the declared model for the entity?
export function isStatusInModel(entityType, normalisedValue) {
  const model = STATUS_MODELS[entityType];
  if (!model) return true; // no model declared → cannot judge → treat as valid
  return model.includes(normalisedValue);
}

export default normaliseStatus;
