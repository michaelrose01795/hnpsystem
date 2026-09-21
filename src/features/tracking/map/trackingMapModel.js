// file location: src/features/tracking/map/trackingMapModel.js
//
// Pure vehicle-to-space logic for the /tracking site map. No React, no DOM, no
// network — everything here is a deterministic function of the tracking
// entries the page has already fetched, so it is unit-tested directly and can
// be memoised safely in the view.
//
// A VEHICLE ONLY APPEARS ON THE MAP WHEN ITS RECORD NAMES A BAY
// -------------------------------------------------------------
// The previous version dealt every vehicle whose location merely matched an
// AREA into that area's bays in order, then piled the remainder onto the last
// bay as a numbered stack. That is where "54", "65", "72" and "73" in red
// boxes came from: 77 cars recorded as "Workshop bay 1" became 12 invented
// positions plus a cluster of 65. None of those positions were real, so nobody
// could tell which car was where — the exact thing the map exists to answer.
//
// Now placement is only ever claimed, never inferred:
//
//   1. EXACT   "Front forecourt · FF-012" names a bay in the registry. That
//              vehicle is drawn in that bay. This is the form the map writes
//              when a vehicle is moved or assigned, so placements round-trip.
//   2. BROAD   "Workshop bay 1", "Service car park", "Sales 3" resolve to an
//              area but not to a bay. The vehicle goes to `unmapped` with the
//              area it belongs to, so staff can assign it a real space. It is
//              NEVER dropped into the first free bay of that area.
//   3. NONE    Blank, "N/A" or text the map does not know also goes to
//              `unmapped`, with no area.
//   4. GONE    A departed vehicle (collected, invoiced, archived) is excluded
//              entirely — it is off site and cannot occupy a space.
//
// When two live records genuinely claim the same bay, the bay gets ONE
// conflict marker listing them; it never stacks markers on top of each other.

import { SPACE_LOCATION_SEPARATOR } from "@/features/tracking/map/trackingMapSite";
import {
  normaliseLocationText,
  TRACKING_MAP_AREA_BY_LOCATION,
  TRACKING_MAP_SPACE_BY_ID,
  TRACKING_MAP_SPACES,
} from "@/features/tracking/map/trackingMapSpaces";

// Values that explicitly mean "we do not know", not a place.
const NON_LOCATIONS = new Set(["", "n a", "na", "none", "unknown", "unallocated", "pending", "tbc"]);

// Longest alias first, so "rear car park a" is preferred over "rear car park".
const ALIASES_BY_LENGTH = [...TRACKING_MAP_AREA_BY_LOCATION.keys()].sort((a, b) => b.length - a.length);

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

export const normaliseLocation = normaliseLocationText;

const matchArea = (text) => {
  if (!text || NON_LOCATIONS.has(text)) return null;
  const direct = TRACKING_MAP_AREA_BY_LOCATION.get(text);
  if (direct) return direct;
  // "Workshop bay 1" / "Sales 3" style: an alias plus a number.
  const numbered = TRACKING_MAP_AREA_BY_LOCATION.get(text.replace(/\s+\d+$/, ""));
  if (numbered) return numbered;
  // Last resort: the longest alias contained in the text.
  const contained = ALIASES_BY_LENGTH.find((alias) => alias.length > 3 && text.includes(alias));
  return contained ? TRACKING_MAP_AREA_BY_LOCATION.get(contained) : null;
};

/**
 * Resolve a stored location string.
 *
 * `space` is non-null ONLY when the value names a real, enabled bay of that
 * area — i.e. the canonical "Area · SPACE-ID" form the map writes. An area
 * name on its own never yields a space, however specific it reads: 77 records
 * all saying "Workshop bay 1" are 77 unplaced cars, not 77 positions.
 */
export function parseLocation(value) {
  const raw = String(value || "");
  const separatorIndex = raw.indexOf(SPACE_LOCATION_SEPARATOR.trim());
  const areaText = separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw;
  const spaceText = separatorIndex >= 0 ? raw.slice(separatorIndex + 1).trim().toUpperCase() : "";

  const area = matchArea(normaliseLocationText(areaText));
  if (!area) return { area: null, space: null };

  const space = spaceText ? TRACKING_MAP_SPACE_BY_ID.get(spaceText) : null;
  return { area, space: space && space.areaId === area.id && space.enabled ? space : null };
}

export const findAreaForLocation = (value) => parseLocation(value).area;

/** The exact location string to persist when a vehicle is put in a bay. */
export const buildSpaceLocationValue = (space) => space?.locationValue || "";

// Marker status. Colour is only ever half the signal — every status also
// carries a glyph used by the legend and the detail panel.
export const MARKER_STATUSES = [
  { id: "conflict", label: "Space conflict", glyph: "!" },
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

const byStableKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.index - b.index);

/**
 * Place tracking entries on the map.
 *
 * @param {Array} entries              rows to consider (already filtered by the page)
 * @param {Object} options
 * @param {Function} options.getFlags  the page's getTrackerLocationFlags
 * @param {Function} options.isDeparted  predicate for "this car has left site"
 * @param {Array}  options.spaces      registry override, for tests
 * @returns {{ bySpaceId: Map, markers: Array, unmapped: Array, departed: Array, conflicts: Array, counts: Object }}
 */
export function buildMapAssignments(entries = [], options = {}) {
  const spaces = options.spaces || TRACKING_MAP_SPACES;
  const getFlags = typeof options.getFlags === "function" ? options.getFlags : () => ({});
  const isDeparted =
    typeof options.isDeparted === "function" ? options.isDeparted : (entry) => Boolean(getFlags(entry)?.isDeparted);

  const bySpaceId = new Map();
  const markers = [];
  const unmapped = [];
  const departed = [];

  // Pass 1 — collect claims. Sorted by stable key so the same data always
  // resolves the same bay to the same vehicle.
  const claims = [];
  entries.forEach((entry, index) => {
    if (isDeparted(entry)) {
      departed.push(entry);
      return;
    }
    const { area, space } = parseLocation(entry?.vehicleLocation);
    if (!space) {
      // Broad or unknown. Carry the area so the correction list can say where
      // the car is said to be, but never invent a bay for it.
      unmapped.push({ entry, area: area || null });
      return;
    }
    claims.push({ entry, space, key: getEntryKey(entry), index });
  });
  claims.sort(byStableKey);

  // Pass 2 — one marker per bay. A second claim on the same bay does not get
  // its own marker; it joins that bay's conflict list.
  const enabled = new Set(spaces.filter((space) => space.enabled).map((space) => space.id));
  for (const claim of claims) {
    if (!enabled.has(claim.space.id)) {
      unmapped.push({ entry: claim.entry, area: null });
      continue;
    }
    const existing = bySpaceId.get(claim.space.id);
    if (existing) {
      existing.conflicts.push(claim.entry);
      existing.status = MARKER_STATUS_BY_ID.get("conflict");
      continue;
    }
    const flags = getFlags(claim.entry) || {};
    const marker = {
      key: claim.key,
      entry: claim.entry,
      space: claim.space,
      flags,
      status: getMarkerStatus(flags),
      conflicts: [],
    };
    bySpaceId.set(claim.space.id, marker);
    markers.push(marker);
  }

  const conflicts = markers.filter((marker) => marker.conflicts.length > 0);
  const totalSpaces = enabled.size;
  const occupied = bySpaceId.size;

  return {
    bySpaceId,
    markers,
    unmapped,
    departed,
    conflicts,
    counts: {
      totalSpaces,
      occupiedSpaces: occupied,
      availableSpaces: Math.max(0, totalSpaces - occupied),
      mapped: occupied,
      unmapped: unmapped.length,
      departed: departed.length,
      conflicts: conflicts.reduce((total, marker) => total + marker.conflicts.length, 0),
      attention: markers.filter((marker) => marker.status.id === "attention" || marker.status.id === "conflict").length,
    },
  };
}

/**
 * Which spaces may a vehicle be moved into?
 *
 * Only registry bays, so a car can never be dropped on a building, a road, the
 * container island, a tree belt or the neighbouring property — those are not
 * in the registry at all. Occupied bays and the vehicle's own bay are excluded.
 */
export function getMoveTargets({
  spaces = TRACKING_MAP_SPACES,
  bySpaceId = new Map(),
  currentSpaceId = null,
  areaId = null,
} = {}) {
  const valid = new Set();
  for (const space of spaces) {
    if (!space.enabled) continue;
    if (space.id === currentSpaceId) continue;
    if (bySpaceId.has(space.id)) continue;
    if (areaId && space.areaId !== areaId) continue;
    valid.add(space.id);
  }
  return valid;
}

/** The sentence shown in the move confirmation, built from real record values. */
export function describeMove({ entry = {}, fromSpace = null, toSpace = null } = {}) {
  const reg = String(entry.reg || entry.vehicleReg || "Unknown registration").toUpperCase();
  const from = fromSpace
    ? `${fromSpace.siteArea}${SPACE_LOCATION_SEPARATOR}${fromSpace.label}`
    : String(entry.vehicleLocation || "").trim() || "Unknown location";
  const to = toSpace ? `${toSpace.siteArea}${SPACE_LOCATION_SEPARATOR}${toSpace.label}` : "Unknown destination";
  return { reg, from, to, destinationLocation: buildSpaceLocationValue(toSpace) };
}
