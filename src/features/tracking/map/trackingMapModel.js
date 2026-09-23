// file location: src/features/tracking/map/trackingMapModel.js
//
// Pure vehicle-to-SECTION logic for /tracking -> Key/Parking. No React, no DOM,
// no network — everything is a deterministic function of the tracking entries
// the page has already fetched, so it is unit-tested directly and can be
// memoised safely in the view.
//
// SECTIONS, NOT BAYS
// ------------------
// The previous model placed vehicles in individual, numbered bays from a
// calibrated bay registry. That registry is gone. A vehicle belongs to one of
// the canonical sections (src/lib/tracking/vehicleLocations.js) — Service,
// Sales 1-10, Staff, Trade, Paint, Valet, Workshop, Showroom, Off Site, or N/A —
// and every count, chip, panel and capacity figure is derived from that.
//
// HOW A RECORD IS PLACED
// ----------------------
//   1. Its stored `vehicleLocation` resolves through the registry (canonical
//      label, or a known historical alias such as "Workshop bay 1").
//   2. Anything that resolves to nothing — blank, "N/A", or text the registry
//      does not recognise — is placed in N/A, and flagged `isUnrecognised`
//      when the text was non-empty, so it stays visible and correctable rather
//      than silently vanishing from the totals.
//   3. Departed vehicles (collected / invoiced / archived jobs, per
//      isDepartedEntry in trackingEntryState) are history, not occupancy. The
//      CALLER passes live entries only — otherwise every closed job's last
//      recorded "Service" would count against Service's capacity forever.
//      Off Site is therefore the operational section: a live job whose car is
//      recorded as away (subcontractor, road test, with the customer). It is
//      not a synonym for "departed", and it is never N/A.

import {
  NA_VEHICLE_LOCATION_ID,
  OFF_SITE_VEHICLE_LOCATION_ID,
  getSectionOccupancy,
  normaliseVehicleLocationText,
  resolveVehicleLocation,
} from "@/lib/tracking/vehicleLocations";
import { TRACKING_SECTIONS, TRACKING_SECTION_BY_ID } from "@/features/tracking/map/parkingAreas";

export const ALL_SECTIONS_ID = "all";

// A tracking entry's stable identity. The snapshot is one row per job_id, and
// registration is the last resort only: two records can share a plate in the
// data long before they share a job.
export const getEntryKey = (entry = {}) => {
  if (entry.jobId !== null && entry.jobId !== undefined && entry.jobId !== "") return `job:${entry.jobId}`;
  if (entry.vehicleId !== null && entry.vehicleId !== undefined && entry.vehicleId !== "") {
    return `vehicle:${entry.vehicleId}`;
  }
  if (entry.id !== null && entry.id !== undefined && entry.id !== "") return `entry:${entry.id}`;
  return `reg:${String(entry.reg || entry.vehicleReg || "unknown").trim().toUpperCase()}`;
};

export const normaliseLocation = normaliseVehicleLocationText;

/**
 * Which section does this entry's VEHICLE belong to?
 * Reads `vehicleLocation` only — the key location never places a car.
 */
export function getEntrySection(entry = {}) {
  const raw = String(entry?.vehicleLocation ?? "").trim();
  const resolved = resolveVehicleLocation(raw);
  const section = TRACKING_SECTION_BY_ID.get(resolved?.id || NA_VEHICLE_LOCATION_ID);
  return {
    section,
    // Non-empty text that means nothing in the registry. Grouped under N/A so
    // it is counted, but distinguishable from a deliberate "N/A".
    isUnrecognised: Boolean(raw) && !resolved,
  };
}

export const getEntrySectionId = (entry) => getEntrySection(entry).section.id;

/**
 * Group entries by section and count them.
 *
 * @param {Array} entries
 * @returns {{ bySection: Map<string, Array>, counts: Object<string, number>, unrecognised: Array, total: number }}
 *          `bySection` has a key for EVERY section (empty arrays included), in
 *          display order, so callers never need to guard a missing section.
 */
export function groupEntriesBySection(entries = []) {
  const bySection = new Map(TRACKING_SECTIONS.map((section) => [section.id, []]));
  const unrecognised = [];
  for (const entry of entries) {
    const { section, isUnrecognised } = getEntrySection(entry);
    bySection.get(section.id).push(entry);
    if (isUnrecognised) unrecognised.push(entry);
  }
  const counts = Object.fromEntries([...bySection].map(([id, list]) => [id, list.length]));
  return { bySection, counts, unrecognised, total: entries.length };
}

/** Capacity / occupied / available for every section, keyed by id. */
export function buildSectionOccupancy(counts = {}) {
  return Object.fromEntries(
    TRACKING_SECTIONS.map((section) => [section.id, getSectionOccupancy(section, counts[section.id] || 0)])
  );
}

/**
 * The Key/Parking summary tiles' occupancy figures, counted from sections.
 *
 * Occupied / Available are over the BOUNDED physical sections only: N/A is not
 * a place and Off Site has no capacity, so neither can occupy or free a space.
 * "Mapped" is a car recorded in a real on-site section; "Unmapped" is one in
 * N/A (including unrecognised legacy text) — the cars that still need placing.
 */
export function summariseSectionOccupancy(entries = []) {
  const { counts, unrecognised } = groupEntriesBySection(entries);
  let totalSpaces = 0;
  let occupiedSpaces = 0;
  for (const section of TRACKING_SECTIONS) {
    if (!Number.isFinite(section.capacity)) continue;
    totalSpaces += section.capacity;
    occupiedSpaces += counts[section.id] || 0;
  }
  const unmapped = counts[NA_VEHICLE_LOCATION_ID] || 0;
  const offSite = counts[OFF_SITE_VEHICLE_LOCATION_ID] || 0;
  return {
    totalSpaces,
    occupiedSpaces,
    availableSpaces: Math.max(0, totalSpaces - occupiedSpaces),
    mapped: Math.max(0, entries.length - unmapped - offSite),
    unmapped,
    offSiteRecorded: offSite,
    unrecognised: unrecognised.length,
  };
}

/**
 * Chip / strip items: "All" first, then every section in display order.
 * The count on each is the number of entries in it.
 */
export function buildSectionStripItems(entries = []) {
  const { counts, total } = groupEntriesBySection(entries);
  return [
    { id: ALL_SECTIONS_ID, label: "All", count: total, section: null },
    ...TRACKING_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      count: counts[section.id] || 0,
      section,
    })),
  ];
}

/** Entries in one section (or all of them), optionally narrowed by a query. */
export function filterEntriesForSection(entries = [], sectionId = ALL_SECTIONS_ID, query = "") {
  const text = String(query || "").trim().toLowerCase();
  return entries.filter((entry) => {
    if (sectionId && sectionId !== ALL_SECTIONS_ID && getEntrySectionId(entry) !== sectionId) return false;
    if (!text) return true;
    return [entry.reg, entry.vehicleReg, entry.jobNumber, entry.customer, entry.makeModel, entry.vehicleLocation]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text));
  });
}

/**
 * Find vehicles for the map's search box. Matches registration first (with
 * spaces ignored, so "AB12CDE" finds "AB12 CDE"), then job number / customer.
 * Every result carries the section it is in, so selecting it can open that
 * section.
 */
export function searchVehicles(entries = [], query = "", limit = 8) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return [];
  const compact = text.replace(/\s+/g, "");
  const results = [];
  for (const entry of entries) {
    const reg = String(entry.reg || entry.vehicleReg || "").toLowerCase();
    const regHit = reg && reg.replace(/\s+/g, "").includes(compact);
    const otherHit = [entry.jobNumber, entry.customer]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(text));
    if (!regHit && !otherHit) continue;
    results.push({ entry, key: getEntryKey(entry), section: getEntrySection(entry).section, rank: regHit ? 0 : 1 });
  }
  results.sort((a, b) => a.rank - b.rank || String(a.entry.reg || "").localeCompare(String(b.entry.reg || "")));
  return results.slice(0, limit);
}

/**
 * Where may this vehicle be moved? Every canonical section except the one it is
 * already in. Deliberately not capacity-gated: capacities are provisional, and
 * a full section is a warning shown in the panel, not a reason to block a move
 * that reflects where the car physically is.
 */
export function getMoveDestinations(entry = {}) {
  const currentId = getEntrySectionId(entry);
  return TRACKING_SECTIONS.filter((section) => section.id !== currentId);
}

/** Is `label` a valid move destination for this entry? */
export function isValidMoveDestination(entry, label) {
  return getMoveDestinations(entry).some((section) => section.label === label);
}

/** The sentence shown for a move, built from real record values. */
export function describeMove({ entry = {}, toSection = null } = {}) {
  const reg = String(entry.reg || entry.vehicleReg || "Unknown registration").toUpperCase();
  const from = getEntrySection(entry).section.label;
  const to = toSection?.label || "Unknown destination";
  return { reg, from, to, destinationLocation: toSection?.label || "" };
}

// Marker status. Colour is only ever half the signal — every status also
// carries a glyph used in the panel list.
export const MARKER_STATUSES = [
  { id: "attention", label: "Overdue movement", glyph: "!" },
  { id: "waiting", label: "Customer waiting", glyph: "@" },
  { id: "collection", label: "Ready for collection", glyph: "C" },
  { id: "workshop", label: "Workshop / operational", glyph: "W" },
  { id: "occupied", label: "On site", glyph: "•" },
];

const MARKER_STATUS_BY_ID = new Map(MARKER_STATUSES.map((status) => [status.id, status]));

export const getMarkerStatus = (flags = {}) => {
  if (flags.isOverdue) return MARKER_STATUS_BY_ID.get("attention");
  if (flags.isCustomerWaiting) return MARKER_STATUS_BY_ID.get("waiting");
  if (flags.isCollection) return MARKER_STATUS_BY_ID.get("collection");
  if (flags.isWorkshop) return MARKER_STATUS_BY_ID.get("workshop");
  return MARKER_STATUS_BY_ID.get("occupied");
};

// -----------------------------------------------------------------------------
// Selection state
// -----------------------------------------------------------------------------
// The map view has ONE selection, shared by the map labels, the map regions,
// the section strip, the overview table and the find-a-vehicle results. It is
// a reducer so every one of those inputs is the same tested transition rather
// than five hand-written setState sequences.

export const INITIAL_SECTION_SELECTION = Object.freeze({ selectedId: null, highlightKey: null, findQuery: "" });

export function sectionSelectionReducer(state = INITIAL_SECTION_SELECTION, action = {}) {
  switch (action.type) {
    // A label, region, chip or overview row. Unknown ids and "all" clear.
    case "select": {
      const id = action.id && action.id !== ALL_SECTIONS_ID && TRACKING_SECTION_BY_ID.has(action.id) ? action.id : null;
      return { ...state, selectedId: id, highlightKey: null };
    }
    case "clear":
      return { ...state, selectedId: null, highlightKey: null };
    case "find":
      return { ...state, findQuery: String(action.query ?? "") };
    // A search result: open the vehicle's section and highlight it there.
    case "choose-result":
      return {
        ...state,
        selectedId: TRACKING_SECTION_BY_ID.has(action.sectionId) ? action.sectionId : null,
        highlightKey: action.key || null,
        findQuery: "",
      };
    // Escape backs out one step: the find results first, then the selection.
    case "escape":
      if (state.findQuery) return { ...state, findQuery: "" };
      if (state.selectedId) return { ...state, selectedId: null, highlightKey: null };
      return state;
    default:
      return state;
  }
}
