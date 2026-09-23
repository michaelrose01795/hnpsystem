// file location: src/features/tracking/trackingEntryState.js
//
// How a tracking entry is classified, and how the Key/Parking summary is
// counted. Pure functions — no React, no DOM, no network — so the Grid view,
// the Map view and the unit tests all read the same rules.
//
// WHAT WAS WRONG BEFORE
// --------------------
// These rules used to live inline in src/pages/tracking/index.js and produced
// "384 active jobs / 384 cars off-site / 384 overdue movements / 64 customers
// waiting" against a snapshot of 384 vehicles. Every one of those was a
// classification bug, not a data problem:
//
//   off-site   An allow-list of exact location strings decided who was ON site:
//              ["n/a","na","service","workshop","in workshop","ready for
//              release"]. The database actually stores "Service car park",
//              "Workshop bay 1", "MOT bay", "Wash bay" and "Collection row" —
//              none of which are in that list — so all 384 on-site vehicles
//              were counted as off-site.
//
//   overdue    Any entry whose newest event was over 4 hours old. Completed,
//              invoiced, archived and collected vehicles never move again, so
//              every historical record aged into "overdue" and stayed there.
//              Overdue now means a LIVE job whose vehicle is still on site and
//              has not moved — the only case where a movement is actually owed.
//
//   waiting    `status.includes("waiting")`. "Awaiting Workshop" contains
//              "waiting", so all 64 of those were reported as customers
//              waiting in reception. There were zero genuine waiters.
//
// The vehicle's identity is its job, not its registration: the snapshot is one
// row per job_id, and two records can share a plate long before they share a
// job.

const MS_PER_HOUR = 1000 * 60 * 60;

export const TRACKER_OVERDUE_HOURS = 4;

export const normaliseTrackerText = (value = "") => String(value || "").trim().toLowerCase();

// Placeholder location values. These mean "nobody has said", not "a place".
const NON_LOCATIONS = new Set(["", "n/a", "na", "none", "unknown", "unallocated", "pending", "tbc"]);

// Vehicle-tracking statuses that mean the car has left the premises.
const DEPARTED_VEHICLE_STATUSES = new Set([
  "customer collected",
  "collected",
  "delivered",
  "off site",
  "offsite",
  "returned to customer",
]);

// Job statuses that mean the job is finished and its vehicle is not expected
// to move again. A vehicle on one of these is history, not a parking problem.
const CLOSED_JOB_STATUSES = new Set(["archived", "invoiced", "cancelled"]);

// Job statuses where work is still owed, so a stalled vehicle is a real
// problem worth flagging.
const LIVE_JOB_STATUSES = new Set(["open", "booked", "checked in", "in progress", "awaiting parts"]);

export const normalizeKeyLocationLabel = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .replace(/^Keys (received|hung|updated|moved|issued)\s*[-–]\s*/i, "")
    .replace(/^Keys (issued|moved) to\s*/i, "")
    .replace(/^Key location\s*[-:–]\s*/i, "")
    .replace(/^Key locations?\s*[-:–]\s*/i, "");
};

export const getMovementAgeHours = (entry = {}) => {
  const updated = new Date(entry?.updatedAt || 0).getTime();
  if (!updated) return 0;
  return Math.max(0, (Date.now() - updated) / MS_PER_HOUR);
};

/** The car has left site — it must never occupy a parking space on the map. */
export const isDepartedEntry = (entry = {}) =>
  DEPARTED_VEHICLE_STATUSES.has(normaliseTrackerText(entry.status)) ||
  CLOSED_JOB_STATUSES.has(normaliseTrackerText(entry.jobStatus));

/** Work is still owed on this job, so a stalled vehicle matters. */
export const isLiveJob = (entry = {}) => LIVE_JOB_STATUSES.has(normaliseTrackerText(entry.jobStatus));

/**
 * A genuine waiter, not the word "waiting" appearing inside another status.
 * "Awaiting Workshop" is a workshop queue. "Waiting For Collection" is a car
 * ready to go, not a person sitting in reception.
 */
export const isCustomerWaiting = (entry = {}) => {
  const haystack = [entry.status, entry.jobStatus, entry.serviceType].map(normaliseTrackerText).join(" ");
  if (/\bawaiting\b/.test(haystack)) return false;
  if (/waiting\s+(for|on)\b/.test(haystack)) return false; // "waiting for collection/parts"
  if (/\bcustomer\s+waiting\b/.test(haystack)) return true;
  if (/\bwaiter\b/.test(haystack)) return true;
  return Boolean(entry.customerWaiting) || Boolean(entry.maintenanceInfo?.customerWaiting);
};

export const getTrackerLocationFlags = (entry = {}) => {
  const keyLocation = normaliseTrackerText(normalizeKeyLocationLabel(entry.keyLocation));
  const vehicleLocation = normaliseTrackerText(entry.vehicleLocation);
  const status = normaliseTrackerText(entry.status || entry.jobStatus || entry.serviceType);
  const combined = [keyLocation, vehicleLocation, status].filter(Boolean).join(" ");

  const missingKey = NON_LOCATIONS.has(keyLocation);
  const missingVehicle = NON_LOCATIONS.has(vehicleLocation);
  const departed = isDepartedEntry(entry);

  const isUnknown = !departed && (missingVehicle || combined.includes("unknown"));
  const isWorkshop =
    combined.includes("workshop") ||
    combined.includes("red board") ||
    combined.includes("mot") ||
    combined.includes("wash") ||
    combined.includes("valet") ||
    combined.includes("paint") ||
    combined.includes("prep") ||
    combined.includes("road test");
  const isCollection =
    combined.includes("collection") || combined.includes("ready for release") || combined.includes("handover");

  const keysMoved =
    Boolean(keyLocation) &&
    !NON_LOCATIONS.has(keyLocation) &&
    !keyLocation.includes("service showroom") &&
    !keyLocation.includes("service desk") &&
    !keyLocation.includes("sales show room");

  // Only a live job with its car still on site can owe a movement. Without
  // this every finished record aged into "overdue" and never aged out.
  const isOverdue = !departed && isLiveJob(entry) && getMovementAgeHours(entry) >= TRACKER_OVERDUE_HOURS;

  return {
    isDeparted: departed,
    isOnSite: !departed,
    isUnknown,
    isWorkshop,
    isCollection,
    isCustomerWaiting: isCustomerWaiting(entry),
    keysMoved,
    isOverdue,
    missingKey,
    missingVehicle,
  };
};

export const getTrackerGroup = (entry = {}) => {
  const flags = getTrackerLocationFlags(entry);
  const keyLocation = normaliseTrackerText(normalizeKeyLocationLabel(entry.keyLocation));
  const vehicleLocation = normaliseTrackerText(entry.vehicleLocation);
  const combined = [keyLocation, vehicleLocation].filter(Boolean).join(" ");

  if (flags.isDeparted) return { id: "off-site", label: "Off Site" };
  if (flags.isUnknown) return { id: "unknown", label: "Unknown Location" };
  if (flags.isCollection) return { id: "collection", label: "Collection" };
  if (combined.includes("red board") || combined.includes("cupboard") || keyLocation.includes("workshop")) {
    return { id: "workshop-board", label: "Workshop Board" };
  }
  if (flags.isWorkshop) return { id: "workshop-bays", label: "Workshop Bays" };
  if (combined.includes("service")) return { id: "service-desk", label: "Service Desk" };
  return { id: "other", label: "Other Locations" };
};

export const getTrackerRiskScore = (entry = {}) => {
  const flags = getTrackerLocationFlags(entry);
  const ageHours = getMovementAgeHours(entry);
  // A departed vehicle is not a risk, whatever its age.
  if (flags.isDeparted) return -1;
  return (
    (flags.isUnknown ? 100000 : 0) +
    (flags.keysMoved ? 50000 : 0) +
    (flags.isOverdue ? 20000 : 0) +
    Math.min(19999, Math.round(ageHours * 100))
  );
};

/**
 * The Key/Parking summary, counted from deduplicated current records.
 *
 * @param {Array}  entries  one row per job, as /api/tracking/snapshot returns
 * @param {Object} mapping  { mapped, unmapped, totalSpaces, occupiedSpaces }
 *                          from the map registry, when the caller has it
 */
export function summariseTrackerEntries(entries = [], mapping = null) {
  let onSite = 0;
  let offSite = 0;
  let overdue = 0;
  let waiting = 0;
  let unknown = 0;
  let keysMissing = 0;

  for (const entry of entries) {
    const flags = getTrackerLocationFlags(entry);
    if (flags.isDeparted) offSite += 1;
    else onSite += 1;
    if (flags.isOverdue) overdue += 1;
    if (flags.isCustomerWaiting) waiting += 1;
    if (flags.isUnknown) unknown += 1;
    if (flags.missingKey && !flags.isDeparted) keysMissing += 1;
  }

  const totalSpaces = mapping?.totalSpaces ?? 0;
  const occupied = mapping?.occupiedSpaces ?? 0;

  return {
    activeTracked: onSite,
    offSite,
    overdue,
    customerWaiting: waiting,
    unknownLocation: unknown,
    keysMissing,
    onSiteMapped: mapping?.mapped ?? 0,
    onSiteUnmapped: mapping?.unmapped ?? onSite,
    totalSpaces,
    occupiedSpaces: occupied,
    availableSpaces: Math.max(0, totalSpaces - occupied),
  };
}
