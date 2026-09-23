// file location: src/lib/tracking/vehicleLocations.js
//
// THE canonical VEHICLE-location registry. One list, one vocabulary, one place
// to edit — every dropdown, filter, chip, map label, count and database write
// that names where a CAR is resolves through this file.
//
// VEHICLE LOCATION IS NOT KEY LOCATION
// ------------------------------------
// They are separate domains and stay separate in code and in the database:
//
//   vehicleLocation -> vehicle_tracking_events.location  (this file)
//   keyLocation     -> key_tracking_events.action        (KEY_LOCATION_GROUPS
//                                                         in src/lib/jobCards/locations.js)
//
// Some labels appear in both — "Workshop", "Valet", "Paint" are a place a car
// can be AND a board the keys can hang on. That overlap is cosmetic. Nothing
// here is derived from, or writes to, the key vocabulary, and a vehicle move
// never emits a key event. Do not merge the two lists.
//
// WHY THIS FILE EXISTS
// --------------------
// Before it there were three registries that had already drifted:
//   * CAR_LOCATIONS in src/lib/jobCards/locations.js (the dropdown),
//   * a verbatim copy of the same array inside src/pages/tracking/index.js, and
//   * MAP_AREAS in src/features/tracking/map/trackingMapSite.js — a completely
//     separate set of names ("Rear car park A", "Wash bay", "Collection row")
//     with its own alias table and its own bay geometry.
// The first two are now derived from this file and the third has been deleted;
// its alias knowledge survives as the `aliases` below, which is the only thing
// about it that was load-bearing.
//
// SECTION CONFIG
// --------------
// Each entry is a SECTION — the unit a vehicle is assigned to, shown as a chip
// in the area strip, as a label on the site map and as a panel on the right.
//
//   id                 stable slug; never persisted, used for state and keys
//   label              the EXACT text written to vehicle_tracking_events.location
//   type               logical | service | sales | staff | trade | building | external
//   isPhysicalMapArea  does this section exist as a place on the site plan?
//   capacity           PROVISIONAL — see the capacity note below
//   supportsAutoMovement  may an automatic status rule move a car here?
//                         (the rules themselves live in ./autoMovement.js)
//   displayOrder       the order chips, dropdown options and panels read in
//   aliases            historical free-text seen in vehicle_tracking_events
//                      that means this section. READ-ONLY: aliases are matched
//                      so legacy rows still group and count correctly; they are
//                      never written back.
//
// Map geometry (label anchors, clickable regions) is deliberately NOT here —
// it belongs to the map and lives in src/features/tracking/map/parkingAreas.js,
// which merges these sections with their placements.
//
// CAPACITIES ARE PROVISIONAL
// --------------------------
// Every capacity below is a placeholder chosen to be roughly the right order of
// magnitude, NOT a surveyed space count. They are here so the Capacity /
// Occupied / Available figures in the UI are config-driven from day one and can
// be corrected by editing this one column. Nothing derives a capacity from
// geometry, and nothing counts bays — the old per-bay registry is gone.
// `capacityConfirmed: false` marks every one that still needs the business to
// confirm it; flip it to true as each is measured.

const PROVISIONAL = false; // capacityConfirmed — see the note above.

const SECTIONS = [
  {
    id: "na",
    label: "N/A",
    type: "logical",
    // N/A is "nobody has said", not a place. It is never drawn on the plan and
    // it has no capacity — see OFF_SITE below for the section that IS a place.
    isPhysicalMapArea: false,
    capacity: null,
    capacityConfirmed: true,
    supportsAutoMovement: false,
    displayOrder: 10,
    aliases: ["na", "none", "unknown", "unallocated", "pending", "tbc", "not set", "unassigned"],
  },
  {
    id: "service",
    label: "Service",
    type: "service",
    isPhysicalMapArea: true,
    capacity: 24,
    capacityConfirmed: PROVISIONAL,
    supportsAutoMovement: true,
    displayOrder: 20,
    aliases: [
      "service car park",
      "service desk",
      "customer parking",
      "collection row",
      "collection",
      "handover",
      "handover suite",
      "ready for collection",
      "ready for release",
    ],
  },
  { id: "sales-1", label: "Sales 1", type: "sales", isPhysicalMapArea: true, capacity: 18, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 30, aliases: ["front forecourt", "forecourt", "front row"] },
  { id: "sales-2", label: "Sales 2", type: "sales", isPhysicalMapArea: true, capacity: 18, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 40, aliases: ["service yard"] },
  { id: "sales-3", label: "Sales 3", type: "sales", isPhysicalMapArea: true, capacity: 20, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 50, aliases: ["stock compound", "compound"] },
  { id: "sales-4", label: "Sales 4", type: "sales", isPhysicalMapArea: true, capacity: 20, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 60, aliases: [] },
  { id: "sales-5", label: "Sales 5", type: "sales", isPhysicalMapArea: true, capacity: 20, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 70, aliases: [] },
  { id: "sales-6", label: "Sales 6", type: "sales", isPhysicalMapArea: true, capacity: 20, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 80, aliases: [] },
  { id: "sales-7", label: "Sales 7", type: "sales", isPhysicalMapArea: true, capacity: 24, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 90, aliases: ["rear car park a", "rear a", "overflow", "overflow west fence"] },
  { id: "sales-8", label: "Sales 8", type: "sales", isPhysicalMapArea: true, capacity: 24, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 100, aliases: ["rear car park b", "rear b"] },
  // Sales 9 and Sales 10 are valid vehicle locations but are NOT areas of this
  // site: nothing on the plan corresponds to them. They appear in the dropdown,
  // the chips, the filters and the counts; they simply have no map label and no
  // clickable region. Giving either a placement in parkingAreas.js draws it.
  { id: "sales-9", label: "Sales 9", type: "sales", isPhysicalMapArea: false, capacity: 12, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 110, aliases: [] },
  { id: "sales-10", label: "Sales 10", type: "sales", isPhysicalMapArea: false, capacity: 12, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 120, aliases: [] },
  { id: "staff", label: "Staff", type: "staff", isPhysicalMapArea: true, capacity: 16, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 130, aliases: ["staff parking", "employee parking"] },
  { id: "trade", label: "Trade", type: "trade", isPhysicalMapArea: true, capacity: 16, capacityConfirmed: PROVISIONAL, supportsAutoMovement: false, displayOrder: 140, aliases: ["trade parking", "container storage", "container", "containers"] },
  {
    id: "paint",
    label: "Paint",
    type: "building",
    isPhysicalMapArea: true,
    capacity: 4,
    capacityConfirmed: PROVISIONAL,
    // Capable of automatic movement, but no job status currently means "in
    // paint" — see PAINT in src/lib/tracking/autoMovement.js.
    supportsAutoMovement: true,
    displayOrder: 150,
    aliases: ["paint shop", "body shop", "bodyshop", "in paint"],
  },
  {
    id: "valet",
    label: "Valet",
    type: "building",
    isPhysicalMapArea: true,
    capacity: 6,
    capacityConfirmed: PROVISIONAL,
    supportsAutoMovement: true,
    displayOrder: 160,
    aliases: ["valet lane", "valeting", "being valeted", "wash", "wash bay", "being washed", "prep"],
  },
  {
    id: "workshop",
    label: "Workshop",
    type: "building",
    isPhysicalMapArea: true,
    capacity: 12,
    capacityConfirmed: PROVISIONAL,
    supportsAutoMovement: true,
    displayOrder: 170,
    aliases: ["in workshop", "workshop bay", "workshop bays", "on ramp", "ramp", "mot", "mot bay", "mot lane", "mot bays"],
  },
  {
    id: "showroom",
    label: "Showroom",
    type: "building",
    isPhysicalMapArea: true,
    capacity: 8,
    capacityConfirmed: PROVISIONAL,
    // Manual only: putting a car in the showroom is a sales decision, and no
    // status in the job model implies it.
    supportsAutoMovement: false,
    displayOrder: 180,
    aliases: ["sales showroom", "sales show room", "service showroom", "display", "showroom display"],
  },
  {
    id: "off-site",
    label: "Off Site",
    type: "external",
    // Off Site is a REAL section, not the absence of one. It is not a building
    // or a yard, so it is drawn at the site entrance rather than over a
    // structure, and it is counted, filtered and selectable like any other.
    // It must never be conflated with N/A: N/A means nobody has recorded a
    // location, Off Site means somebody has recorded that the car is away.
    isPhysicalMapArea: true,
    capacity: null, // Unbounded by definition — there is no limit to "elsewhere".
    capacityConfirmed: true,
    supportsAutoMovement: false,
    displayOrder: 190,
    aliases: ["offsite", "off-site", "away", "external", "with customer", "at customer", "subcontractor", "sublet"],
  },
];

export const VEHICLE_LOCATIONS = [...SECTIONS].sort((a, b) => a.displayOrder - b.displayOrder);

export const NA_VEHICLE_LOCATION_ID = "na";
export const OFF_SITE_VEHICLE_LOCATION_ID = "off-site";

export const NA_VEHICLE_LOCATION_LABEL = "N/A";
export const OFF_SITE_VEHICLE_LOCATION_LABEL = "Off Site";

export const VEHICLE_LOCATION_LABELS = VEHICLE_LOCATIONS.map((section) => section.label);

export const VEHICLE_LOCATION_BY_ID = new Map(VEHICLE_LOCATIONS.map((section) => [section.id, section]));

/** DropdownField option shape. `value` is the persisted label, never the id. */
export const VEHICLE_LOCATION_OPTIONS = VEHICLE_LOCATIONS.map((section) => ({
  key: section.id,
  value: section.label,
  label: section.label,
}));

/** Only the sections that are a place on the plan, in display order. */
export const PHYSICAL_VEHICLE_LOCATIONS = VEHICLE_LOCATIONS.filter((section) => section.isPhysicalMapArea);

export const normaliseVehicleLocationText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Normalised text -> section. Built once at module load so resolving a location
// is a hash lookup rather than a scan of every alias of every section.
const LOOKUP = new Map();
for (const section of VEHICLE_LOCATIONS) {
  for (const candidate of [section.label, section.id, ...(section.aliases || [])]) {
    const key = normaliseVehicleLocationText(candidate);
    if (key && !LOOKUP.has(key)) LOOKUP.set(key, section);
  }
}

// Longest first, so "rear car park a" beats "rear car park" on a contains-match.
const LOOKUP_KEYS_BY_LENGTH = [...LOOKUP.keys()].sort((a, b) => b.length - a.length);

/**
 * Resolve any stored location string to a canonical section.
 *
 * Handles, in order: an exact canonical label or id, a known historical alias,
 * an alias with a trailing bay number ("Workshop bay 1"), and finally the
 * longest alias contained in the text ("Overflow - West Fence"). Blank resolves
 * to N/A, because an unset location IS N/A. Anything still unrecognised returns
 * null — the caller decides whether that is a display problem or a write error.
 *
 * @returns {object|null} the section, or null when the text means nothing here
 */
export function resolveVehicleLocation(value) {
  const text = normaliseVehicleLocationText(value);
  if (!text) return VEHICLE_LOCATION_BY_ID.get(NA_VEHICLE_LOCATION_ID);

  const direct = LOOKUP.get(text);
  if (direct) return direct;

  const numbered = LOOKUP.get(text.replace(/\s+\d+$/, ""));
  if (numbered) return numbered;

  const contained = LOOKUP_KEYS_BY_LENGTH.find((key) => key.length > 3 && text.includes(key));
  return contained ? LOOKUP.get(contained) : null;
}

/**
 * The section id a record belongs to for grouping, counting and filtering.
 * Unrecognised legacy text groups under N/A so it stays visible and correctable
 * rather than disappearing from the totals.
 */
export const getVehicleLocationId = (value) =>
  resolveVehicleLocation(value)?.id || NA_VEHICLE_LOCATION_ID;

/** Is this exactly one of the canonical labels? (Aliases are not canonical.) */
export const isCanonicalVehicleLocation = (value) =>
  VEHICLE_LOCATION_LABELS.includes(String(value || "").trim());

/**
 * The label to persist for a location the user or a rule chose.
 *
 * Every WRITE goes through this, so vehicle_tracking_events.location can only
 * ever gain canonical values from here on. Historical rows are untouched — they
 * are read through `resolveVehicleLocation` instead.
 *
 * @returns {string|null} a canonical label, or null when the value is not one
 */
export const coerceVehicleLocationLabel = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return resolveVehicleLocation(trimmed)?.label || null;
};

export const getVehicleLocationSection = (id) => VEHICLE_LOCATION_BY_ID.get(id) || null;

/**
 * Capacity / occupied / available for one section.
 *
 * `capacity: null` (N/A, Off Site) means "not bounded" — those sections report
 * an occupancy but never an availability, because a shortfall is meaningless.
 */
export const getSectionOccupancy = (section, occupied = 0) => {
  const capacity = Number.isFinite(section?.capacity) ? section.capacity : null;
  return {
    capacity,
    occupied,
    available: capacity === null ? null : Math.max(0, capacity - occupied),
    isOverCapacity: capacity !== null && occupied > capacity,
    capacityConfirmed: Boolean(section?.capacityConfirmed),
  };
};

/**
 * The value a vehicle-location DROPDOWN should start on for a stored value.
 *
 * Legacy text that clearly means a section ("Workshop bay 1") opens on that
 * section. Text that means nothing here opens on "" — the dropdown shows its
 * placeholder rather than inventing a free-text option, so a user can only ever
 * save a canonical value. (Key-location dropdowns are a separate domain and are
 * not affected.)
 */
export const toVehicleLocationFormValue = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return NA_VEHICLE_LOCATION_LABEL;
  return coerceVehicleLocationLabel(trimmed) || "";
};

/**
 * Server-side validation for a vehicle-location WRITE.
 *
 *   undefined        -> { ok, value: undefined }  side not addressed, write nothing
 *   null / ""        -> { ok, value: null }       explicit clear (legacy behaviour)
 *   known text       -> { ok, value: <canonical label> }
 *   unknown text     -> { ok: false, error }      rejected — no free-text locations
 */
export const validateVehicleLocationWrite = (value) => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || String(value).trim() === "") return { ok: true, value: null };
  const label = coerceVehicleLocationLabel(value);
  if (!label) {
    return {
      ok: false,
      error: {
        message: `"${String(value).trim()}" is not a recognised vehicle location. Choose one of: ${VEHICLE_LOCATION_LABELS.join(", ")}.`,
        code: "INVALID_VEHICLE_LOCATION",
      },
    };
  }
  return { ok: true, value: label };
};

/**
 * How to DISPLAY a stored vehicle location: the canonical label when the text
 * resolves (so "Workshop bay 1" reads "Workshop"), otherwise the raw text as
 * recorded, so an unrecognised legacy value is visible rather than hidden.
 */
export const formatVehicleLocation = (value) => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return NA_VEHICLE_LOCATION_LABEL;
  return resolveVehicleLocation(trimmed)?.label || trimmed;
};
