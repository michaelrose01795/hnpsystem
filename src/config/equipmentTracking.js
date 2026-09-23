// file location: src/config/equipmentTracking.js
//
// Vocabulary for the Equipment/Tools tracker on /tracking. One list per
// concept, read by the page, the API routes and the reminder sweep, so the
// words a technician picks are the words a report later groups by.
//
// Keys are stored in the database; labels are display-only and can be renamed
// freely. Removing a key does not break old rows — unknown keys render as their
// raw value — but add rather than rename where you can.

/* ------------------------------------------------------------------------ */
/* Categories                                                                */
/* ------------------------------------------------------------------------ */
// The first five keys are the filters the tab already had; existing rows were
// backfilled onto them by the equipment asset migration.
export const EQUIPMENT_CATEGORIES = Object.freeze([
  { key: "workshop-tools", label: "Workshop Tools", defaultIntervalKey: "m6", department: "workshop" },
  { key: "lifts", label: "Lifts & Lifting", defaultIntervalKey: "d1", department: "workshop" },
  { key: "diagnostic", label: "Diagnostic", defaultIntervalKey: "m3", department: "workshop" },
  { key: "mot", label: "MOT Equipment", defaultIntervalKey: "d1", department: "mot", requiresCalibration: true },
  { key: "air-con", label: "Air Conditioning", defaultIntervalKey: "m1", department: "workshop" },
  { key: "battery", label: "Battery Equipment", defaultIntervalKey: "m1", department: "workshop" },
  { key: "tyre", label: "Tyre Equipment", defaultIntervalKey: "d7", department: "workshop" },
  { key: "hand-tools", label: "Hand Tools", defaultIntervalKey: "m6", department: "workshop" },
  { key: "safety", label: "Safety Equipment", defaultIntervalKey: "m1", department: "workshop" },
  { key: "valeting", label: "Valeting Equipment", defaultIntervalKey: "m1", department: "valeting" },
  { key: "calibration", label: "Calibration Equipment", defaultIntervalKey: "m12", department: "workshop", requiresCalibration: true },
]);

/* ------------------------------------------------------------------------ */
/* Departments (areas) and locations                                         */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_DEPARTMENTS = Object.freeze([
  { key: "workshop", label: "Workshop" },
  { key: "mot", label: "MOT" },
  { key: "parts", label: "Parts" },
  { key: "valeting", label: "Valeting" },
  { key: "paint", label: "Paint" },
  { key: "stores", label: "Stores" },
  { key: "reception", label: "Reception" },
]);

const WORKSHOP_BAY_COUNT = 10;

export const EQUIPMENT_LOCATIONS = Object.freeze([
  ...Array.from({ length: WORKSHOP_BAY_COUNT }, (_, index) => ({
    key: `workshop-bay-${index + 1}`,
    label: `Workshop Bay ${index + 1}`,
    department: "workshop",
  })),
  { key: "workshop-floor", label: "Workshop (shared)", department: "workshop" },
  { key: "diagnostic-bench", label: "Diagnostic Bench", department: "workshop" },
  { key: "tyre-bay", label: "Tyre Bay", department: "workshop" },
  { key: "mot-bay", label: "MOT Bay", department: "mot" },
  { key: "mot-office", label: "MOT Office", department: "mot" },
  { key: "parts-counter", label: "Parts Counter", department: "parts" },
  { key: "goods-in", label: "Goods In", department: "parts" },
  { key: "valet-bay", label: "Valet Bay", department: "valeting" },
  { key: "wash-bay", label: "Wash Bay", department: "valeting" },
  { key: "paint-booth", label: "Paint Booth", department: "paint" },
  { key: "paint-prep", label: "Paint Prep Area", department: "paint" },
  { key: "stores", label: "Stores", department: "stores" },
  { key: "tool-store", label: "Tool Store", department: "stores" },
  { key: "service-reception", label: "Service Reception", department: "reception" },
  { key: "sales-reception", label: "Sales Reception", department: "reception" },
]);

/* ------------------------------------------------------------------------ */
/* Operational status (stored) and display status (derived)                  */
/* ------------------------------------------------------------------------ */
// What a manager or a fault sets. "Fault reported", "Due soon" and "Overdue"
// are never stored — they are derived from open faults and dates, so they can
// never drift out of step with the records behind them.
export const EQUIPMENT_OPERATIONAL_STATUSES = Object.freeze([
  { key: "in_service", label: "In service" },
  { key: "awaiting_inspection", label: "Awaiting inspection" },
  { key: "under_repair", label: "Under repair" },
  { key: "out_of_service", label: "Out of service" },
  { key: "retired", label: "Retired" },
]);

// Display statuses, most urgent first. `tone` maps onto the badge family and
// the tracker's status text classes; `rank` drives urgency sorting.
export const EQUIPMENT_STATUSES = Object.freeze([
  { key: "out-of-service", label: "Out of Service", tone: "danger", rank: 0 },
  { key: "overdue", label: "Overdue", tone: "danger", rank: 1 },
  { key: "fault-reported", label: "Fault Reported", tone: "warning", rank: 2 },
  { key: "under-repair", label: "Under Repair", tone: "warning", rank: 3 },
  { key: "awaiting-inspection", label: "Awaiting Inspection", tone: "warning", rank: 4 },
  { key: "due-soon", label: "Due Soon", tone: "warning", rank: 5 },
  { key: "ok", label: "OK", tone: "success", rank: 6 },
  { key: "retired", label: "Retired", tone: "neutral", rank: 7 },
]);

/* ------------------------------------------------------------------------ */
/* Check intervals                                                           */
/* ------------------------------------------------------------------------ */
// Day-based intervals exist because lifts, MOT and tyre equipment carry daily
// or weekly pre-use checks; everything else is month-based like before.
export const EQUIPMENT_INTERVALS = Object.freeze([
  { key: "d1", days: 1, label: "Daily" },
  { key: "d7", days: 7, label: "Weekly" },
  { key: "d14", days: 14, label: "Every 2 weeks" },
  ...Array.from({ length: 11 }, (_, index) => ({
    key: `m${index + 1}`,
    months: index + 1,
    label: `${index + 1} month${index === 0 ? "" : "s"}`,
  })),
  { key: "m12", months: 12, label: "1 year" },
  { key: "m24", months: 24, label: "2 years" },
  { key: "m36", months: 36, label: "3 years" },
]);

// Due Soon is proportional to how often the equipment is checked: a daily
// check is "due soon" the day before, an annual inspection a month out. An
// asset's own due_soon_days overrides this. First matching row wins.
export const EQUIPMENT_DUE_SOON_RULES = Object.freeze([
  { maxIntervalDays: 1, dueSoonDays: 0 },
  { maxIntervalDays: 7, dueSoonDays: 1 },
  { maxIntervalDays: 31, dueSoonDays: 3 },
  { maxIntervalDays: 92, dueSoonDays: 7 },
  { maxIntervalDays: 183, dueSoonDays: 14 },
  { maxIntervalDays: Infinity, dueSoonDays: 30 },
]);

// Overdue backlogs are split into these bands (most overdue first) instead of
// one endless section.
export const EQUIPMENT_OVERDUE_BANDS = Object.freeze([
  { key: "overdue-90", minDays: 91, label: "Overdue more than 90 days" },
  { key: "overdue-30", minDays: 31, label: "Overdue 31–90 days" },
  { key: "overdue-7", minDays: 8, label: "Overdue 8–30 days" },
  { key: "overdue-recent", minDays: 0, label: "Overdue up to 7 days" },
]);

/* ------------------------------------------------------------------------ */
/* Checks and faults                                                         */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_CHECK_TYPES = Object.freeze([
  { key: "routine", label: "Routine check" },
  { key: "inspection", label: "Inspection / thorough examination" },
  { key: "service", label: "Service" },
  { key: "calibration", label: "Calibration" },
]);

export const EQUIPMENT_CHECK_RESULTS = Object.freeze([
  { key: "pass", label: "Pass", tone: "success" },
  { key: "advisory", label: "Advisory", tone: "warning" },
  { key: "fail", label: "Fail", tone: "danger" },
]);

export const EQUIPMENT_CONDITIONS = Object.freeze([
  { key: "good", label: "Good" },
  { key: "fair", label: "Fair" },
  { key: "poor", label: "Poor" },
  { key: "unsafe", label: "Unsafe" },
]);

export const EQUIPMENT_FAULT_SEVERITIES = Object.freeze([
  { key: "low", label: "Low", tone: "neutral" },
  { key: "medium", label: "Medium", tone: "warning" },
  { key: "high", label: "High", tone: "danger" },
  { key: "critical", label: "Critical", tone: "danger" },
]);

// "unsafe" takes the asset out of service automatically.
export const EQUIPMENT_FAULT_USABILITY = Object.freeze([
  { key: "usable", label: "Usable", description: "Fault noted, safe to keep using" },
  { key: "restricted", label: "Restricted use", description: "Usable with care or for some jobs only" },
  { key: "unsafe", label: "Unsafe — do not use", description: "Marks the asset Out of Service" },
]);

export const EQUIPMENT_FAULT_STATUSES = Object.freeze([
  { key: "open", label: "Open", tone: "danger" },
  { key: "in_repair", label: "In repair", tone: "warning" },
  { key: "resolved", label: "Resolved", tone: "success" },
]);

/* ------------------------------------------------------------------------ */
/* Documents                                                                 */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_DOCUMENT_TYPES = Object.freeze([
  { key: "inspection_certificate", label: "Inspection certificate" },
  { key: "calibration_certificate", label: "Calibration certificate" },
  { key: "loler_report", label: "LOLER report" },
  { key: "service_report", label: "Service report" },
  { key: "repair_invoice", label: "Repair invoice" },
  { key: "warranty", label: "Warranty document" },
  { key: "manual", label: "Manual" },
  { key: "photo", label: "Photo" },
  { key: "other", label: "Other document" },
]);

// Certificates carry an expiry; the reminder sweep watches the latest of each.
export const EQUIPMENT_EXPIRING_DOCUMENT_TYPES = Object.freeze([
  "inspection_certificate",
  "calibration_certificate",
  "loler_report",
  "warranty",
]);

export const EQUIPMENT_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const EQUIPMENT_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

/* ------------------------------------------------------------------------ */
/* Reminders                                                                 */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_REMINDER_WINDOWS = Object.freeze({
  calibrationDays: 30,
  serviceDays: 14,
  documentDays: 30,
  // An unresolved fault is re-announced once a week until it is resolved.
  faultRepeatDays: 7,
});

/* ------------------------------------------------------------------------ */
/* Lookups                                                                   */
/* ------------------------------------------------------------------------ */
const indexBy = (list) => Object.freeze(Object.fromEntries(list.map((item) => [item.key, item])));

export const EQUIPMENT_CATEGORY_BY_KEY = indexBy(EQUIPMENT_CATEGORIES);
export const EQUIPMENT_DEPARTMENT_BY_KEY = indexBy(EQUIPMENT_DEPARTMENTS);
export const EQUIPMENT_LOCATION_BY_KEY = indexBy(EQUIPMENT_LOCATIONS);
export const EQUIPMENT_STATUS_BY_KEY = indexBy(EQUIPMENT_STATUSES);
export const EQUIPMENT_INTERVAL_BY_KEY = indexBy(EQUIPMENT_INTERVALS);
export const EQUIPMENT_DOCUMENT_TYPE_BY_KEY = indexBy(EQUIPMENT_DOCUMENT_TYPES);

export const labelFor = (lookup, key, fallback = "") =>
  (key && lookup[key]?.label) || (key ? String(key) : fallback);
