// file location: src/features/tracking/map/trackingMapSite.js
//
// The parking registry behind the /tracking occupancy figures.
//
// SCOPE
// -----
// This file no longer draws anything. The site plan is vector geometry in
// siteMapGeometry.js, and the map shows logical parking AREAS rather than
// individual bays. What is left here is the bay registry that
// trackingMapSpaces.js expands and trackingMapModel.js matches vehicle
// records against, which is what the Occupied / Available / Mapped /
// Unmapped tiles on /tracking are counted from.
//
// COORDINATES
// -----------
// The x / y values below are percentages of the old 16:9 reference render,
// kept so a row keeps its identity. They are not used for drawing.

// A 2.4 m x 4.8 m bay expressed in stage percent, via the reference scale bar.
export const SPACE_SIZE = {
  // Nose-in bay in a row that runs left-to-right (car points up/down).
  row: { width: 0.9, height: 3.22, pitch: 0.96 },
  // Nose-in bay in a column that runs top-to-bottom (car points left/right).
  column: { width: 1.81, height: 1.45, pitch: 1.72 },
};

// The old outline plan (SITE_BOUNDARY / SITE_SHAPES) that used to live here
// has gone: the map is now drawn from siteMapGeometry.js, in its own
// coordinate system. What remains below is the parking registry, which the
// /tracking summary tiles still read through trackingMapModel.js.

// -----------------------------------------------------------------------------
// Areas
// -----------------------------------------------------------------------------
// WHY AREAS CARRY ALIASES
// -----------------------
// `vehicle_tracking_events.location` is a free-text column, and the database
// does NOT only contain the CAR_LOCATIONS labels the Update-location dropdown
// offers. Live records use operational names — "Workshop bay 1", "Service car
// park", "MOT bay", "Wash bay", "Collection row" — alongside the dropdown's
// "Sales 1"…"Sales 10" / "Staff" / "Trade". Matching on one vocabulary would
// leave every real vehicle unmapped.
//
// So each area declares:
//   location  the canonical name this area writes when a vehicle is moved here
//   aliases   every other real value that means the same physical place
//
// The canonical name is chosen to keep the existing consumers working: it
// still contains the keyword getTrackerLocationFlags / getTrackerGroup in
// src/pages/tracking/index.js match on ("workshop", "collection", "service",
// "valet", "staff"), so a car moved from the map falls into exactly the group
// and filter it would have from the dropdown. Nothing in the schema changes.
//
// `siteArea` is the zone the reference render labels. The rows below are
// traced from the parking actually visible in that image, not invented.
export const MAP_AREAS = [
  {
    id: "rear-car-park-a",
    code: "RA",
    location: "Rear car park A",
    siteArea: "Rear Car Park A",
    label: "Rear car park A",
    aliases: ["rear car park a", "rear a", "rear car park", "overflow", "overflow west fence", "sales 7", "sales 8"],
    rows: [
      { orientation: "row", x: 31.2, y: 13.8, count: 15 },
      { orientation: "row", x: 30.6, y: 20.8, count: 16 },
    ],
  },
  {
    id: "container-storage",
    code: "CS",
    location: "Container storage",
    siteArea: "Container Storage",
    label: "Container / storage",
    aliases: ["container storage", "container", "containers", "storage", "trade", "trade parking"],
    rows: [
      { orientation: "row", x: 46.2, y: 11.2, count: 12 },
      { orientation: "row", x: 46.2, y: 21.6, count: 12 },
    ],
  },
  {
    id: "staff-parking",
    code: "ST",
    location: "Staff parking",
    siteArea: "Rear Car Park B",
    label: "Staff parking",
    aliases: ["staff parking", "staff", "employee parking"],
    rows: [
      { orientation: "column", x: 59, y: 12.4, count: 8 },
    ],
  },
  {
    id: "rear-car-park-b",
    code: "RB",
    location: "Rear car park B",
    siteArea: "Rear Car Park B",
    label: "Rear car park B",
    aliases: ["rear car park b", "rear b", "sales 9", "sales 10"],
    rows: [
      { orientation: "row", x: 62.2, y: 11.8, count: 12 },
      { orientation: "row", x: 66.5, y: 16.2, count: 7 },
      { orientation: "row", x: 62, y: 20.6, count: 12 },
    ],
  },
  {
    id: "stock-compound",
    code: "SC",
    location: "Stock compound",
    siteArea: "Stock Compound",
    label: "Stock compound",
    aliases: ["stock compound", "stock", "compound", "sales 5", "sales 6"],
    rows: [
      { orientation: "row", x: 20, y: 32.6, count: 11 },
      { orientation: "row", x: 17.6, y: 39.6, count: 13 },
      { orientation: "row", x: 18.2, y: 43.8, count: 12 },
      { orientation: "column", x: 12.8, y: 50.5, count: 9 },
      { orientation: "row", x: 20.6, y: 51.4, count: 12 },
      { orientation: "row", x: 19.6, y: 56.4, count: 13 },
      { orientation: "row", x: 19.6, y: 60.4, count: 14 },
      { orientation: "row", x: 19, y: 67.6, count: 20 },
    ],
  },
  {
    id: "workshop-bays",
    code: "WB",
    location: "Workshop bay",
    siteArea: "Workshop",
    label: "Workshop bays",
    aliases: ["workshop", "in workshop", "workshop bay", "workshop bays", "workshop board", "red board", "ramp"],
    rows: [
      { orientation: "row", x: 48.2, y: 34.4, count: 12 },
      { orientation: "row", x: 48.2, y: 39.8, count: 12 },
    ],
  },
  {
    id: "mot-bay",
    code: "MB",
    location: "MOT bay",
    siteArea: "Workshop",
    label: "MOT bay",
    aliases: ["mot bay", "mot", "mot lane", "mot bays"],
    rows: [
      { orientation: "row", x: 42.4, y: 45, count: 5 },
    ],
  },
  {
    id: "wash-bay",
    code: "WV",
    location: "Wash bay",
    siteArea: "Workshop",
    label: "Wash and valet bay",
    aliases: ["wash bay", "wash", "valet", "valet lane", "valeting", "paint", "prep"],
    rows: [
      { orientation: "row", x: 42.4, y: 50.5, count: 5 },
    ],
  },
  {
    id: "showroom",
    code: "SD",
    location: "Showroom",
    siteArea: "Showroom",
    label: "Showroom display",
    aliases: ["showroom", "sales showroom", "sales show room", "service showroom", "handover suite", "sales 1"],
    rows: [
      { orientation: "row", x: 49.4, y: 50, count: 11 },
      { orientation: "row", x: 49.4, y: 56.6, count: 11 },
    ],
  },
  {
    id: "service-car-park",
    code: "SV",
    location: "Service car park",
    siteArea: "Showroom",
    label: "Service car park",
    aliases: ["service car park", "service", "service desk", "customer parking"],
    rows: [
      { orientation: "column", x: 44.4, y: 50.5, count: 7 },
    ],
  },
  {
    id: "collection-row",
    code: "CR",
    location: "Collection row",
    siteArea: "Front Forecourt",
    label: "Collection row",
    aliases: ["collection row", "collection", "handover", "ready for collection", "ready for release", "sales 4"],
    rows: [
      { orientation: "column", x: 62.2, y: 47, count: 12 },
    ],
  },
  {
    id: "front-forecourt",
    code: "FF",
    location: "Front forecourt",
    siteArea: "Front Forecourt",
    label: "Front forecourt",
    aliases: ["front forecourt", "forecourt", "front row", "front row bay a", "sales 2", "sales 3"],
    rows: [
      { orientation: "row", x: 44, y: 64.6, count: 15 },
      { orientation: "row", x: 44.6, y: 68.4, count: 13 },
    ],
  },
];

// Site areas in the order they read on the plan, for the area filter.
export const SITE_AREA_ORDER = [
  "Rear Car Park A",
  "Container Storage",
  "Rear Car Park B",
  "Stock Compound",
  "Workshop",
  "Showroom",
  "Front Forecourt",
];

// The separator between an area's name and a specific bay in a persisted
// location value, e.g. "Rear car park A · RA-A07". Reading strips it; writing
// adds it. Existing records that carry only the area name still match.
export const SPACE_LOCATION_SEPARATOR = " · ";
