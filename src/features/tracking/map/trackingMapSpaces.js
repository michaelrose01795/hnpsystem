// file location: src/features/tracking/map/trackingMapSpaces.js
//
// The calibrated parking / vehicle-holding registry for the /tracking site map.
//
// Every genuine position on the plan is expanded here from the row definitions
// in trackingMapSite.js into a stable, individually addressable space:
//
//   { id, areaId, location, siteArea, label, x, y, width, height, rotation, type, enabled }
//
// `id` is stable for as long as a row's origin and count are unchanged, so a
// space keeps its identity across releases and can be written into a tracking
// record. `location` is the area's canonical name — see the note on MAP_AREAS.
//
// TOTALS ARE COMPUTED, NEVER TYPED. `TRACKING_MAP_SPACE_COUNT` is derived from
// this registry and is the only number the UI is allowed to display.

import {
  MAP_AREAS,
  SITE_AREA_ORDER,
  SPACE_LOCATION_SEPARATOR,
  SPACE_SIZE,
} from "@/features/tracking/map/trackingMapSite";

const buildAreaSpaces = (area) => {
  const spaces = [];
  area.rows.forEach((row, rowIndex) => {
    const geometry = SPACE_SIZE[row.orientation] || SPACE_SIZE.row;
    const rowLetter = String.fromCharCode(65 + rowIndex); // A, B, C…
    for (let index = 0; index < row.count; index += 1) {
      const offset = index * geometry.pitch;
      const id = `${area.code}-${rowLetter}${String(index + 1).padStart(2, "0")}`;
      spaces.push({
        id,
        areaId: area.id,
        location: area.location,
        siteArea: area.siteArea,
        label: id,
        // The exact value written to vehicle_tracking_events.location when a
        // vehicle is moved into this bay.
        locationValue: `${area.location}${SPACE_LOCATION_SEPARATOR}${id}`,
        x: Number((row.orientation === "column" ? row.x : row.x + offset).toFixed(3)),
        y: Number((row.orientation === "column" ? row.y + offset : row.y).toFixed(3)),
        width: geometry.width,
        height: geometry.height,
        rotation: row.rotation || 0,
        type: "parking",
        enabled: row.enabled !== false,
      });
    }
  });
  return spaces;
};

export const TRACKING_MAP_SPACES = MAP_AREAS.flatMap(buildAreaSpaces);

export const TRACKING_MAP_SPACE_COUNT = TRACKING_MAP_SPACES.length;

// areaId -> the area record, plus its own spaces and computed capacity.
export const TRACKING_MAP_AREAS = MAP_AREAS.map((area) => {
  const spaces = TRACKING_MAP_SPACES.filter((space) => space.areaId === area.id);
  return { ...area, spaces, capacity: spaces.length };
});

export const TRACKING_MAP_AREA_BY_ID = new Map(
  TRACKING_MAP_AREAS.map((area) => [area.id, area])
);

// The site-area filter options, ordered as the plan reads, with computed counts.
export const TRACKING_MAP_SITE_AREAS = SITE_AREA_ORDER.filter((siteArea) =>
  TRACKING_MAP_AREAS.some((area) => area.siteArea === siteArea)
).map((siteArea) => {
  const areas = TRACKING_MAP_AREAS.filter((area) => area.siteArea === siteArea);
  return {
    id: siteArea,
    label: siteArea,
    capacity: areas.reduce((total, area) => total + area.capacity, 0),
    locations: areas.map((area) => area.location),
  };
});

// Normalised location text -> the area that owns it. Built once at module load
// so the per-render assignment pass is O(entries), not O(entries × aliases).
export const normaliseLocationText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const aliasIndex = new Map();
for (const area of TRACKING_MAP_AREAS) {
  for (const alias of [area.location, area.label, ...(area.aliases || [])]) {
    const key = normaliseLocationText(alias);
    if (key && !aliasIndex.has(key)) aliasIndex.set(key, area);
  }
}
export const TRACKING_MAP_AREA_BY_LOCATION = aliasIndex;

export const TRACKING_MAP_SPACE_BY_ID = new Map(
  TRACKING_MAP_SPACES.map((space) => [space.id, space])
);

// Where an area's name is drawn on the plan. Computed from the bounding box of
// the area's own bays, so a label can never drift away from the bays it names.
const bboxOf = (spaces) => {
  const left = Math.min(...spaces.map((space) => space.x));
  const right = Math.max(...spaces.map((space) => space.x + space.width));
  const top = Math.min(...spaces.map((space) => space.y));
  return { x: (left + right) / 2, y: top };
};

// A small area cannot carry a legible label at site zoom without colliding
// with its neighbours, so only areas big enough to own their own patch of the
// plan are named on it. Every area is still named in the area filter, in each
// marker's accessible name and in the detail panel.
const LABELLED_AREA_MINIMUM = 8;

export const TRACKING_MAP_AREA_LABELS = TRACKING_MAP_AREAS.filter(
  (area) => area.spaces.length >= LABELLED_AREA_MINIMUM
).map((area) => {
  const box = bboxOf(area.spaces);
  return { id: area.id, label: area.label, x: box.x, y: Math.max(1.6, box.y - 0.6) };
});
