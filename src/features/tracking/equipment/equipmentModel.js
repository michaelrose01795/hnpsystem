// file location: src/features/tracking/equipment/equipmentModel.js
//
// The rules of the Equipment/Tools tracker, as pure functions. The page, the
// API routes and the reminder sweep all import from here, so "overdue",
// "due soon" and "fault reported" mean the same thing on a card, in a summary
// tile, in a filter and in a reminder. Every function that depends on the
// current time takes `now` so the tests can pin it.

import { addDays, addMonths } from "date-fns";
import {
  EQUIPMENT_CATEGORY_BY_KEY,
  EQUIPMENT_DEPARTMENT_BY_KEY,
  EQUIPMENT_DUE_SOON_RULES,
  EQUIPMENT_INTERVALS,
  EQUIPMENT_INTERVAL_BY_KEY,
  EQUIPMENT_LOCATION_BY_KEY,
  EQUIPMENT_OVERDUE_BANDS,
  EQUIPMENT_STATUS_BY_KEY,
  labelFor,
} from "@/config/equipmentTracking";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30.4375;
// What the tab used before Due Soon became proportional to the interval. Kept
// for assets whose interval cannot be worked out at all.
const LEGACY_DUE_SOON_DAYS = 14;

/* ------------------------------------------------------------------------ */
/* Dates                                                                     */
/* ------------------------------------------------------------------------ */
export const toDate = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Whole calendar days from `from` to `to`; positive when `to` is later. Rounded
// so a daylight-saving change cannot turn one day into 0.96 of one.
export const calendarDaysBetween = (from, to) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);

export const isSameCalendarDay = (left, right) => {
  const a = toDate(left);
  const b = toDate(right);
  return Boolean(a && b) && calendarDaysBetween(a, b) === 0;
};

const DATE_FORMAT = { day: "2-digit", month: "short", year: "numeric" };
const DATE_TIME_FORMAT = { ...DATE_FORMAT, hour: "2-digit", minute: "2-digit" };

export const formatEquipmentDate = (value, fallback = "—") => {
  const date = toDate(value);
  return date ? date.toLocaleDateString("en-GB", DATE_FORMAT) : fallback;
};

export const formatEquipmentDateTime = (value, fallback = "—") => {
  const date = toDate(value);
  return date ? date.toLocaleString("en-GB", DATE_TIME_FORMAT) : fallback;
};

// "YYYY-MM-DD" in local time, the value CalendarField reads and writes.
export const toDateInputValue = (value) => {
  const date = toDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const fromDateInputValue = (value) => {
  if (!value || typeof value !== "string") return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Option lists shaped for DropdownField from the config vocabularies.
export const toOptions = (list, { allLabel } = {}) => [
  ...(allLabel ? [{ key: "all", value: "all", label: allLabel }] : []),
  ...list.map((item) => ({ key: item.key, value: item.key, label: item.label, description: item.description })),
];

export const describeDaysUntil = (days) => {
  if (days === null || days === undefined) return "";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days > 1) return `Due in ${days} days`;
  const overdue = Math.abs(days);
  return `Overdue ${overdue} day${overdue === 1 ? "" : "s"}`;
};

/* ------------------------------------------------------------------------ */
/* Intervals                                                                 */
/* ------------------------------------------------------------------------ */
// Resolves the interval key an asset is on ("d1", "m6", ...), or "" when it
// was stored as an arbitrary number of days that matches no preset.
export const getIntervalKey = (asset = {}) => {
  const months = Number(asset.intervalMonths);
  if (Number.isFinite(months) && months > 0) {
    const key = `m${months}`;
    return EQUIPMENT_INTERVAL_BY_KEY[key] ? key : "";
  }
  const days = Number(asset.intervalDays);
  if (Number.isFinite(days) && days > 0) {
    const preset = EQUIPMENT_INTERVALS.find((interval) => interval.days === days);
    if (preset) return preset.key;
    // Legacy rows stored months as days (30.4375 per month).
    const approxMonths = Math.round(days / DAYS_PER_MONTH);
    const monthKey = `m${approxMonths}`;
    if (approxMonths > 0 && Math.abs(approxMonths * DAYS_PER_MONTH - days) <= 2 && EQUIPMENT_INTERVAL_BY_KEY[monthKey]) {
      return monthKey;
    }
  }
  return "";
};

export const getIntervalDays = (asset = {}) => {
  const days = Number(asset.intervalDays);
  if (Number.isFinite(days) && days > 0) return days;
  const months = Number(asset.intervalMonths);
  if (Number.isFinite(months) && months > 0) return Math.max(1, Math.round(months * DAYS_PER_MONTH));
  const last = toDate(asset.lastChecked);
  const next = toDate(asset.nextDue);
  if (last && next && next > last) return Math.max(1, Math.round((next - last) / MS_PER_DAY));
  return null;
};

export const describeInterval = (asset = {}) => {
  const key = getIntervalKey(asset);
  if (key) return EQUIPMENT_INTERVAL_BY_KEY[key].label;
  if (asset.intervalLabel) return asset.intervalLabel;
  const days = getIntervalDays(asset);
  return days ? `${days} day${days === 1 ? "" : "s"}` : "—";
};

// The fields to store for an interval preset.
export const intervalFieldsFromKey = (key) => {
  const preset = EQUIPMENT_INTERVAL_BY_KEY[key];
  if (!preset) return null;
  if (preset.months) {
    return {
      intervalMonths: preset.months,
      intervalDays: Math.max(1, Math.round(preset.months * DAYS_PER_MONTH)),
      intervalLabel: preset.label,
    };
  }
  return { intervalMonths: null, intervalDays: preset.days, intervalLabel: preset.label };
};

// Next due date from a start date and an interval. Month intervals use
// calendar months (31 Jan + 1 month = 28/29 Feb), day intervals add days.
export const computeNextDue = (fromValue, { intervalMonths, intervalDays } = {}) => {
  const from = toDate(fromValue);
  if (!from) return null;
  const months = Number(intervalMonths);
  if (Number.isFinite(months) && months > 0) return addMonths(from, months);
  const days = Number(intervalDays);
  if (Number.isFinite(days) && days > 0) return addDays(from, days);
  return null;
};

export const dueSoonDaysForInterval = (intervalDays) => {
  const days = Number(intervalDays);
  if (!Number.isFinite(days) || days <= 0) return LEGACY_DUE_SOON_DAYS;
  return EQUIPMENT_DUE_SOON_RULES.find((rule) => days <= rule.maxIntervalDays).dueSoonDays;
};

// The asset's own override wins; otherwise the window follows its interval.
export const getDueSoonDays = (asset = {}) => {
  const override = asset.dueSoonDays;
  if (override !== null && override !== undefined && override !== "" && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override));
  }
  return dueSoonDaysForInterval(getIntervalDays(asset));
};

/* ------------------------------------------------------------------------ */
/* Status                                                                    */
/* ------------------------------------------------------------------------ */
const isRetired = (asset) => asset?.operationalStatus === "retired";

export const getOpenFaults = (asset = {}) =>
  (Array.isArray(asset.openFaults) ? asset.openFaults : []).filter((fault) => fault?.status !== "resolved");

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export const getWorstOpenFault = (asset = {}) =>
  [...getOpenFaults(asset)].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  )[0] || null;

// Everything that can fall due on an asset: its routine check, and — where it
// has them — calibration expiry and its next service.
export const getDueItems = (asset = {}, now = new Date()) => {
  const items = [];
  const push = (kind, label, value, dueSoonDays) => {
    const dueAt = toDate(value);
    if (!dueAt) return;
    items.push({ kind, label, dueAt, daysUntil: calendarDaysBetween(now, dueAt), dueSoonDays });
  };
  push("check", "Check", asset.nextDue, getDueSoonDays(asset));
  if (asset.requiresCalibration) {
    const months = Number(asset.calibrationIntervalMonths);
    push(
      "calibration",
      "Calibration",
      asset.calibrationDue,
      dueSoonDaysForInterval(Number.isFinite(months) && months > 0 ? months * DAYS_PER_MONTH : 365)
    );
  }
  const serviceMonths = Number(asset.serviceIntervalMonths);
  push(
    "service",
    "Service",
    asset.nextServiceDue,
    dueSoonDaysForInterval(Number.isFinite(serviceMonths) && serviceMonths > 0 ? serviceMonths * DAYS_PER_MONTH : 183)
  );
  return items;
};

const statusResult = (key, extra = {}) => {
  const base = EQUIPMENT_STATUS_BY_KEY[key];
  return {
    key,
    label: base.label,
    tone: base.tone,
    rank: base.rank,
    detail: base.label,
    dueAt: null,
    daysUntil: null,
    daysOverdue: 0,
    dueKind: null,
    ...extra,
  };
};

// The single status an asset shows. Stored operational states win, then the
// most overdue date, then open faults, then inspection, then Due Soon.
export const deriveEquipmentStatus = (asset = {}, now = new Date()) => {
  if (isRetired(asset)) return statusResult("retired", { detail: "Retired" });

  if (asset.operationalStatus === "out_of_service") {
    const fault = getWorstOpenFault(asset);
    return statusResult("out-of-service", {
      detail: asset.statusReason || (fault ? `Fault: ${fault.description}` : "Out of service"),
    });
  }
  if (asset.operationalStatus === "under_repair") {
    return statusResult("under-repair", { detail: asset.statusReason || "Under repair" });
  }

  const dueItems = getDueItems(asset, now);
  const overdue = dueItems
    .filter((item) => item.daysUntil < 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (overdue) {
    const days = Math.abs(overdue.daysUntil);
    return statusResult("overdue", {
      detail: `${overdue.kind === "check" ? "Overdue" : `${overdue.label} overdue`} ${days} day${days === 1 ? "" : "s"}`,
      dueAt: overdue.dueAt,
      daysUntil: overdue.daysUntil,
      daysOverdue: days,
      dueKind: overdue.kind,
    });
  }

  const fault = getWorstOpenFault(asset);
  if (fault) {
    return statusResult("fault-reported", { detail: `Fault reported (${fault.severity || "open"})` });
  }

  if (asset.operationalStatus === "awaiting_inspection") {
    return statusResult("awaiting-inspection", { detail: asset.statusReason || "Awaiting inspection" });
  }
  if (!toDate(asset.nextDue)) {
    return statusResult("awaiting-inspection", { detail: "Schedule pending" });
  }

  const dueSoon = dueItems
    .filter((item) => item.daysUntil >= 0 && item.daysUntil <= item.dueSoonDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)[0];
  if (dueSoon) {
    const when = describeDaysUntil(dueSoon.daysUntil);
    return statusResult("due-soon", {
      detail: dueSoon.kind === "check" ? when : `${dueSoon.label}: ${when.toLowerCase()}`,
      dueAt: dueSoon.dueAt,
      daysUntil: dueSoon.daysUntil,
      dueKind: dueSoon.kind,
    });
  }

  const next = toDate(asset.nextDue);
  return statusResult("ok", {
    detail: "Up to date",
    dueAt: next,
    daysUntil: next ? calendarDaysBetween(now, next) : null,
    dueKind: "check",
  });
};

export const getOverdueBand = (daysOverdue) =>
  EQUIPMENT_OVERDUE_BANDS.find((band) => daysOverdue >= band.minDays) ||
  EQUIPMENT_OVERDUE_BANDS[EQUIPMENT_OVERDUE_BANDS.length - 1];

/* ------------------------------------------------------------------------ */
/* Labels                                                                    */
/* ------------------------------------------------------------------------ */
export const getCategoryLabel = (asset = {}) =>
  labelFor(EQUIPMENT_CATEGORY_BY_KEY, asset.category, "Workshop Tools");

export const getDepartmentKey = (asset = {}) =>
  asset.department || EQUIPMENT_LOCATION_BY_KEY[asset.location]?.department || "";

export const getDepartmentLabel = (asset = {}) =>
  labelFor(EQUIPMENT_DEPARTMENT_BY_KEY, getDepartmentKey(asset), "");

export const getLocationLabel = (asset = {}) => {
  const base = labelFor(EQUIPMENT_LOCATION_BY_KEY, asset.location, "");
  if (base && asset.locationDetail) return `${base} · ${asset.locationDetail}`;
  return base || asset.locationDetail || "";
};

export const getLastCheckedByLabel = (asset = {}) => {
  if (asset.lastCheckedByName) return asset.lastCheckedByName;
  if (asset.lastChecked) return "Not recorded";
  return "—";
};

/* ------------------------------------------------------------------------ */
/* Quick filters and summary                                                 */
/* ------------------------------------------------------------------------ */
// One vocabulary for the summary tiles and the status dropdown, so a tile and
// the dropdown can never disagree about what is selected.
export const EQUIPMENT_QUICK_FILTERS = Object.freeze([
  { key: "active", label: "All active equipment" },
  { key: "due-soon", label: "Due Soon" },
  { key: "overdue", label: "Overdue" },
  { key: "checked-today", label: "Checked Today" },
  { key: "fault-reported", label: "Fault Reported" },
  { key: "out-of-service", label: "Out of Service" },
  { key: "under-repair", label: "Under Repair" },
  { key: "awaiting-inspection", label: "Awaiting Inspection" },
  { key: "ok", label: "OK" },
  { key: "retired", label: "Retired" },
  { key: "all", label: "Everything (incl. retired)" },
]);

export const matchesQuickFilter = (asset, filterKey, now = new Date(), status = null) => {
  if (!filterKey || filterKey === "all") return true;
  if (filterKey === "retired") return isRetired(asset);
  if (isRetired(asset)) return false;
  if (filterKey === "active") return true;
  if (filterKey === "checked-today") return isSameCalendarDay(asset.lastChecked, now);
  if (filterKey === "fault-reported") return getOpenFaults(asset).length > 0;
  if (filterKey === "out-of-service") return asset.operationalStatus === "out_of_service";
  return (status || deriveEquipmentStatus(asset, now)).key === filterKey;
};

export const summariseEquipment = (assets = [], now = new Date()) => {
  const summary = {
    total: 0,
    dueSoon: 0,
    overdue: 0,
    checkedToday: 0,
    faultReported: 0,
    outOfService: 0,
    retired: 0,
  };
  for (const asset of assets) {
    if (isRetired(asset)) {
      summary.retired += 1;
      continue;
    }
    const status = deriveEquipmentStatus(asset, now);
    summary.total += 1;
    if (status.key === "due-soon") summary.dueSoon += 1;
    if (status.key === "overdue") summary.overdue += 1;
    if (isSameCalendarDay(asset.lastChecked, now)) summary.checkedToday += 1;
    if (getOpenFaults(asset).length > 0) summary.faultReported += 1;
    if (asset.operationalStatus === "out_of_service") summary.outOfService += 1;
  }
  return summary;
};

/* ------------------------------------------------------------------------ */
/* Search                                                                    */
/* ------------------------------------------------------------------------ */
export const buildEquipmentSearchText = (asset = {}, status = null) =>
  [
    asset.name,
    asset.assetCode,
    getCategoryLabel(asset),
    getDepartmentLabel(asset),
    getLocationLabel(asset),
    asset.serialNumber,
    asset.manufacturer,
    asset.model,
    status?.label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

// Every word must appear somewhere, in any order: "lift 3 bay" finds
// "2-post lift" in "Workshop Bay 3".
export const matchesEquipmentSearch = (asset, term, status = null) => {
  const tokens = String(term || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = buildEquipmentSearchText(asset, status);
  return tokens.every((token) => haystack.includes(token));
};

/* ------------------------------------------------------------------------ */
/* Sorting and grouping                                                      */
/* ------------------------------------------------------------------------ */
export const EQUIPMENT_SORTS = Object.freeze([
  { key: "urgency", label: "Urgency" },
  { key: "most-overdue", label: "Most overdue" },
  { key: "due-soonest", label: "Due soonest" },
  { key: "recently-checked", label: "Recently checked" },
  { key: "name", label: "Name" },
  { key: "location", label: "Location" },
  { key: "category", label: "Category" },
]);

const byName = (a, b) => String(a.asset.name || "").localeCompare(String(b.asset.name || ""), "en-GB");
const timeOr = (value, fallback) => toDate(value)?.getTime() ?? fallback;
const earliestDue = (entry) =>
  entry.dueItems.reduce((min, item) => Math.min(min, item.dueAt.getTime()), Number.POSITIVE_INFINITY);

const urgencyCompare = (a, b) => {
  if (a.status.rank !== b.status.rank) return a.status.rank - b.status.rank;
  if (a.status.key === "overdue" && a.status.daysOverdue !== b.status.daysOverdue) {
    return b.status.daysOverdue - a.status.daysOverdue;
  }
  const dueA = a.status.daysUntil ?? Number.POSITIVE_INFINITY;
  const dueB = b.status.daysUntil ?? Number.POSITIVE_INFINITY;
  if (dueA !== dueB) return dueA - dueB;
  return byName(a, b);
};

const SORT_COMPARATORS = {
  urgency: urgencyCompare,
  "most-overdue": (a, b) =>
    b.status.daysOverdue - a.status.daysOverdue || urgencyCompare(a, b),
  "due-soonest": (a, b) => earliestDue(a) - earliestDue(b) || byName(a, b),
  "recently-checked": (a, b) =>
    timeOr(b.asset.lastChecked, Number.NEGATIVE_INFINITY) - timeOr(a.asset.lastChecked, Number.NEGATIVE_INFINITY) ||
    byName(a, b),
  name: byName,
  location: (a, b) =>
    (getLocationLabel(a.asset) || "~").localeCompare(getLocationLabel(b.asset) || "~", "en-GB") || byName(a, b),
  category: (a, b) => getCategoryLabel(a.asset).localeCompare(getCategoryLabel(b.asset), "en-GB") || byName(a, b),
};

// Decorate once, then filter / sort / group on the decorated entries, so the
// status of each asset is derived exactly once per render.
export const decorateEquipment = (assets = [], now = new Date()) =>
  assets.map((asset) => ({
    asset,
    status: deriveEquipmentStatus(asset, now),
    dueItems: getDueItems(asset, now),
  }));

export const filterEquipmentEntries = (
  entries = [],
  { search = "", quickFilter = "active", category = "all", department = "all", location = "all" } = {},
  now = new Date()
) =>
  entries.filter(({ asset, status }) => {
    if (category !== "all" && (asset.category || "workshop-tools") !== category) return false;
    if (department !== "all" && getDepartmentKey(asset) !== department) return false;
    if (location !== "all" && asset.location !== location) return false;
    if (!matchesQuickFilter(asset, quickFilter, now, status)) return false;
    return matchesEquipmentSearch(asset, search, status);
  });

export const sortEquipmentEntries = (entries = [], sortKey = "urgency") =>
  [...entries].sort(SORT_COMPARATORS[sortKey] || urgencyCompare);

const URGENCY_GROUP_ORDER = [
  { key: "out-of-service", label: "Out of Service" },
  ...EQUIPMENT_OVERDUE_BANDS.map((band) => ({ key: band.key, label: band.label, overdueBand: true })),
  { key: "fault-reported", label: "Fault Reported" },
  { key: "under-repair", label: "Under Repair" },
  { key: "awaiting-inspection", label: "Awaiting Inspection" },
  { key: "due-soon", label: "Due Soon" },
  { key: "ok", label: "Up To Date" },
  { key: "retired", label: "Retired" },
];

// Urgency view: one section per status, and the overdue backlog split into age
// bands. Any other sort is one flat, ordered list.
export const groupEquipmentEntries = (sortedEntries = [], sortKey = "urgency") => {
  if (sortKey !== "urgency") {
    return sortedEntries.length ? [{ key: "all", label: "", entries: sortedEntries }] : [];
  }
  const groups = new Map(URGENCY_GROUP_ORDER.map((group) => [group.key, { ...group, entries: [] }]));
  for (const entry of sortedEntries) {
    const key = entry.status.key === "overdue" ? getOverdueBand(entry.status.daysOverdue).key : entry.status.key;
    groups.get(key)?.entries.push(entry);
  }
  return [...groups.values()].filter((group) => group.entries.length > 0);
};

/* ------------------------------------------------------------------------ */
/* Checklists                                                                */
/* ------------------------------------------------------------------------ */
const MAX_CHECKLIST_ITEMS = 40;

const toFiniteOrNull = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// Shapes checklist items for storage. Unknown keys are dropped, labels are
// trimmed, ids are made unique, and the list is capped.
export const normaliseChecklistItems = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const label = String(item?.label || "").trim().slice(0, 160);
      if (!label) return null;
      let id = String(item?.id || "").trim().replace(/[^a-z0-9-]/gi, "-").slice(0, 40) || `item-${index + 1}`;
      while (seen.has(id)) id = `${id}-${index + 1}`;
      seen.add(id);
      const kind = item?.kind === "reading" ? "reading" : "check";
      return {
        id,
        label,
        kind,
        required: item?.required !== false,
        ...(kind === "reading"
          ? {
              unit: String(item?.unit || "").trim().slice(0, 16),
              min: toFiniteOrNull(item?.min),
              max: toFiniteOrNull(item?.max),
            }
          : {}),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_CHECKLIST_ITEMS);
};

// Explicit assignment first, then the active checklist for the asset's
// category, then the general one (no category).
export const resolveChecklistForAsset = (asset = {}, checklists = []) => {
  const active = checklists.filter((checklist) => checklist && checklist.isActive !== false);
  return (
    active.find((checklist) => checklist.id === asset.checklistId) ||
    active.find((checklist) => checklist.category && checklist.category === asset.category) ||
    active.find((checklist) => !checklist.category) ||
    null
  );
};

// responses: { [itemId]: { outcome: "pass" | "fail" | "na" } | { reading: "12.4" } }
export const evaluateChecklist = (items = [], responses = {}) => {
  const failed = [];
  const outOfRange = [];
  const missing = [];
  const results = [];
  for (const item of items) {
    const response = responses?.[item.id] || {};
    if (item.kind === "reading") {
      const reading = toFiniteOrNull(response.reading);
      if (reading === null) {
        if (item.required) missing.push(item.label);
        results.push({ id: item.id, label: item.label, kind: "reading", reading: null, unit: item.unit || "" });
        continue;
      }
      const low = item.min !== null && item.min !== undefined && reading < item.min;
      const high = item.max !== null && item.max !== undefined && reading > item.max;
      if (low || high) outOfRange.push(item.label);
      results.push({
        id: item.id,
        label: item.label,
        kind: "reading",
        reading,
        unit: item.unit || "",
        inRange: !(low || high),
      });
      continue;
    }
    const outcome = ["pass", "fail", "na"].includes(response.outcome) ? response.outcome : null;
    if (!outcome && item.required) missing.push(item.label);
    if (outcome === "fail") failed.push(item.label);
    results.push({ id: item.id, label: item.label, kind: "check", outcome });
  }
  const suggestedResult = failed.length ? "fail" : outOfRange.length ? "advisory" : "pass";
  return { failed, outOfRange, missing, results, suggestedResult };
};

/* ------------------------------------------------------------------------ */
/* Timeline                                                                  */
/* ------------------------------------------------------------------------ */
const RESULT_TONE = { pass: "success", advisory: "warning", fail: "danger" };

// Dot colour for a timeline entry. Unknown event types stay neutral.
export const getEventTone = (event = {}) => {
  const detail = event.detail || {};
  switch (event.eventType) {
    case "check":
    case "inspection":
    case "service":
    case "calibration":
      return RESULT_TONE[detail.result] || "neutral";
    case "fault_reported":
      return "danger";
    case "fault_repair_started":
      return "warning";
    case "fault_resolved":
    case "reinstated":
      return "success";
    case "status_changed":
      return detail.to === "out_of_service" ? "danger" : detail.to === "in_service" ? "success" : "warning";
    case "created":
    case "imported":
      return undefined;
    default:
      return "neutral";
  }
};

export const EQUIPMENT_TIMELINE_FILTERS = Object.freeze([
  { key: "all", label: "Everything", types: null },
  { key: "checks", label: "Checks", types: ["check", "inspection"] },
  { key: "faults", label: "Faults & repairs", types: ["fault_reported", "fault_repair_started", "fault_resolved", "fault_updated"] },
  { key: "maintenance", label: "Service & calibration", types: ["service", "calibration"] },
  { key: "status", label: "Status changes", types: ["status_changed", "retired", "reinstated"] },
  { key: "records", label: "Record & documents", types: ["created", "imported", "updated", "document_added", "document_removed"] },
]);

/* ------------------------------------------------------------------------ */
/* Asset codes and deep links                                                */
/* ------------------------------------------------------------------------ */
export const normaliseAssetCode = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9._/-]/g, "")
    .slice(0, 40);

// The short path a QR label encodes; it redirects to the record on /tracking.
export const buildEquipmentRecordPath = (assetCode) =>
  `/tracking/equipment/${encodeURIComponent(normaliseAssetCode(assetCode))}`;
