// file location: src/features/tracking/map/trackingMapSite.js
//
// Base geometry for the Humphries & Parks site plan shown on /tracking →
// Key/Parking → Map.
//
// SOURCE
// ------
// Calibrated against the supplied H&P aerial site reference — the labelled
// orthographic render showing London Road / A20, the Access Road, Stock
// Compound, Showroom, Workshop, Front Forecourt, Rear Car Park A, Rear Car
// Park B and the Container / Storage island, with the site boundary drawn in
// red and the neighbouring land desaturated. Every coordinate below was read
// off that image and converted with:
//
//   x% = pixelX / referenceWidth  * 100      (reference 1659 x 933, 16:9)
//   y% = pixelY / referenceHeight * 100
//
// The reference carries a 50 m scale bar: 50 m ≈ 261 px, so 1 m ≈ 5.22 px.
// That is what SPACE_SIZE below is derived from — a real 2.4 m x 4.8 m bay,
// not a guess.
//
// COORDINATE SYSTEM
// ----------------
// Every value here is a percentage of the map stage, for BOTH axes. The stage
// is locked to the reference's 16:9 aspect ratio (see `.tracking-map__frame`
// in trackingMap.css) and the SVG base layer uses
// `viewBox="0 0 100 100" preserveAspectRatio="none"`, so one percent space
// covers the vector base map AND the absolutely-positioned HTML overlay. A
// marker at x=40,y=20 sits exactly on the bay drawn at x=40,y=20.
//
// Because x and y are scaled by different factors, strokes are drawn with
// `vector-effect="non-scaling-stroke"` so they stay uniform, and a bay that
// should look square is authored wider in x than in y.
//
// SWAPPING IN A PHOTOGRAPHIC BACKGROUND
// -------------------------------------
// The vector base is deliberately a separate layer from the parking registry
// (trackingMapSpaces.js) and from the live vehicle overlay. Because this file
// is calibrated to the reference's own pixel grid, dropping that render in as
// an <img> behind the overlay at the same 16:9 aspect ratio lines every bay up
// with the tarmac it was traced from — no parking coordinate and no
// interaction code has to change. The reference is NOT the background today
// because it has vehicles baked into it, and a baked-in car must never be
// mistaken for live database state.

// A 2.4 m x 4.8 m bay expressed in stage percent, via the reference scale bar.
export const SPACE_SIZE = {
  // Nose-in bay in a row that runs left-to-right (car points up/down).
  row: { width: 0.9, height: 3.22, pitch: 0.96 },
  // Nose-in bay in a column that runs top-to-bottom (car points left/right).
  column: { width: 1.81, height: 1.45, pitch: 1.72 },
};

// The red site boundary, traced from the reference.
export const SITE_BOUNDARY =
  "M 7.7,75.7 L 12.9,49.8 L 19.9,32.2 L 20.8,23.0 L 30.1,12.6 L 44.3,10.7 " +
  "L 44.6,9.6 L 62.2,9.6 L 62.7,10.7 L 75.0,10.7 L 75.3,25.7 L 63.9,31.3 " +
  "L 63.6,45.0 L 69.0,49.5 L 69.3,74.0 L 71.7,76.3 L 64.8,78.2 L 46.1,78.0 " +
  "L 41.6,74.0 L 10.8,75.7 Z";

// The internal boundary run that separates the rear lobe (the two rear car
// parks and the container island) from the main site.
export const SITE_BOUNDARY_LINES = ["M 19.9,32.2 L 42.2,31.9 L 42.8,31.1 L 63.9,31.3"];

// Site regions drawn as the base plan. `kind` selects the fill in
// trackingMap.css. A shape is either a rect ({ x, y, w, h }) or a polygon
// ({ points }) — the access road and the site hardstanding are not rectangles.
export const SITE_SHAPES = [
  // Everything outside the H&P boundary, deliberately greyed out.
  { id: "neighbour-land", kind: "outside", x: 0, y: 0, w: 100, h: 100 },

  // Site hardstanding — the boundary polygon itself.
  {
    id: "site-ground",
    kind: "ground",
    points:
      "7.7,75.7 12.9,49.8 19.9,32.2 20.8,23.0 30.1,12.6 44.3,10.7 44.6,9.6 " +
      "62.2,9.6 62.7,10.7 75.0,10.7 75.3,25.7 63.9,31.3 63.6,45.0 69.0,49.5 " +
      "69.3,74.0 71.7,76.3 64.8,78.2 46.1,78.0 41.6,74.0 10.8,75.7",
  },

  // Landscaping and tree belts.
  { id: "belt-mid", kind: "grass", x: 19.5, y: 26.4, w: 44.5, h: 5.6 },
  { id: "belt-east", kind: "grass", x: 63.6, y: 26.0, w: 5.6, h: 22.5 },
  {
    id: "belt-west",
    kind: "grass",
    points: "8.0,75.4 13.2,49.9 20.2,32.4 21.1,23.4 30.3,13.1 31.6,14.6 22.6,24.3 21.7,33.2 15.0,50.6 9.9,75.5",
  },
  { id: "belt-north", kind: "grass", x: 30.2, y: 10.4, w: 32.0, h: 1.9 },
  { id: "verge-a20", kind: "grass", x: 10.5, y: 74.4, w: 55.0, h: 3.6 },
  { id: "island-forecourt", kind: "grass", x: 44.6, y: 64.6, w: 20.0, h: 1.4 },
  { id: "island-compound", kind: "grass", x: 12.4, y: 62.6, w: 29.0, h: 1.3 },
  { id: "island-showroom", kind: "grass", x: 44.1, y: 49.0, w: 1.1, h: 14.0 },

  // Roads.
  { id: "road-a20", kind: "highway", x: 0, y: 78.0, w: 100, h: 14.6 },
  {
    id: "road-access",
    kind: "road",
    points: "9.6,75.6 14.8,50.4 21.4,33.0 22.4,23.8 30.7,14.1 32.4,15.9 24.4,25.0 23.5,34.0 17.0,50.9 11.9,75.7",
  },
  { id: "road-entrance", kind: "road", x: 66.0, y: 74.0, w: 5.0, h: 5.5 },
  { id: "road-rear-aisle", kind: "road", x: 29.8, y: 17.4, w: 45.2, h: 3.2 },
  { id: "road-spine", kind: "road", x: 40.0, y: 31.5, w: 3.4, h: 43.5 },
  { id: "road-east", kind: "road", x: 63.0, y: 45.4, w: 2.4, h: 30.0 },
  { id: "road-front", kind: "road", x: 11.0, y: 71.0, w: 55.0, h: 3.4 },
  { id: "road-workshop", kind: "road", x: 43.4, y: 45.8, w: 20.0, h: 3.0 },

  // Buildings.
  { id: "building-workshop", kind: "building", x: 47.8, y: 33.5, w: 15.4, h: 12.3, radius: 0.4, label: "Workshop" },
  { id: "building-showroom", kind: "building", x: 48.9, y: 49.1, w: 13.3, h: 15.2, radius: 0.4, label: "Showroom" },
  { id: "building-annexe-a", kind: "building", x: 32.5, y: 35.9, w: 4.9, h: 8.0, radius: 0.3 },
  { id: "building-annexe-b", kind: "building", x: 38.6, y: 34.3, w: 7.8, h: 6.4, radius: 0.3 },
  { id: "building-annexe-c", kind: "building", x: 39.8, y: 41.2, w: 7.8, h: 7.0, radius: 0.3 },
  { id: "building-annexe-d", kind: "building", x: 37.4, y: 48.6, w: 4.8, h: 4.8, radius: 0.3 },
  { id: "building-link", kind: "building", x: 47.6, y: 45.9, w: 8.4, h: 3.3, radius: 0.3 },

  // The four shipping containers on the upper storage island.
  { id: "container-1", kind: "container", x: 49.3, y: 15.0, w: 3.7, h: 4.1 },
  { id: "container-2", kind: "container", x: 53.2, y: 15.0, w: 4.8, h: 4.5 },
  { id: "container-3", kind: "container", x: 49.4, y: 19.3, w: 3.5, h: 4.1 },
  { id: "container-4", kind: "container", x: 53.0, y: 19.3, w: 4.9, h: 4.3 },
];

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
