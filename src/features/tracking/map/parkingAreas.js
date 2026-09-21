// file location: src/features/tracking/map/parkingAreas.js
//
// The logical parking AREAS of the site map - Service, Sales 1-10, Staff and
// Trade. These are whole areas of the site, not individual bays: the map no
// longer draws bay markings, and an area is the unit a vehicle will be
// assigned to once the clickable-area work lands.
//
// ONE VOCABULARY, NOT TWO
// -----------------------
// The names come from CAR_LOCATIONS in src/lib/jobCards/locations.js - the
// same list the Update-location dropdown offers and the same text stored in
// vehicle_tracking_events.location. Deriving them here means the map can never
// offer an area the rest of the app does not recognise, and adding a location
// to that list adds it here. "N/A" is not a place on the site, so it is
// filtered out.
//
// GEOMETRY IS PROVISIONAL
// -----------------------
// `anchor` is where the area's name is drawn, as a FRACTION of the site-map
// image (0-1 on each axis) rather than as a pixel position, so the anchors
// survive the asset being re-exported at another resolution.
// ParkingSiteMap.js multiplies them by the image's natural size, which is the
// overlay's coordinate system.
//
// These are reference placements over roughly the right part of the site. The
// exact boundaries have not been agreed yet, which is why `shape` is null on
// every area. When they are confirmed, give an area a `shape` (an SVG path in
// natural image pixels) and the interaction layer picks it up - nothing about
// the map itself has to change.

import { CAR_LOCATIONS } from "@/lib/jobCards/locations";

// Where each area's label sits, and which part of the site it belongs to.
// Keyed by the CAR_LOCATIONS id so the two lists stay joined.
const AREA_PLACEMENTS = {
  // East perimeter, alongside the showroom.
  service: { type: "service", zone: "East perimeter", anchor: { x: 0.769, y: 0.648 } },

  // The front forecourt onto the main road.
  "sales-1": { type: "sales", zone: "Front forecourt", anchor: { x: 0.648, y: 0.711 } },

  // The yard between the central units and the showroom.
  "sales-2": { type: "sales", zone: "Service yard", anchor: { x: 0.477, y: 0.631 } },

  // The lower dealership yard - the largest single area on the site.
  "sales-3": { type: "sales", zone: "Lower yard", anchor: { x: 0.243, y: 0.674 } },
  "sales-4": { type: "sales", zone: "Lower yard", anchor: { x: 0.243, y: 0.749 } },
  "sales-5": { type: "sales", zone: "Lower yard", anchor: { x: 0.255, y: 0.593 } },
  "sales-6": { type: "sales", zone: "Lower yard", anchor: { x: 0.269, y: 0.463 } },

  // The container / storage island and the upper compound around it.
  "sales-7": { type: "sales", zone: "Container storage", anchor: { x: 0.570, y: 0.213 } },
  staff: { type: "staff", zone: "Upper compound", anchor: { x: 0.315, y: 0.198 } },

  // The upper-right yard.
  "sales-8": { type: "sales", zone: "Upper-right yard", anchor: { x: 0.739, y: 0.102 } },
  trade: { type: "trade", zone: "Upper-right yard", anchor: { x: 0.907, y: 0.159 } },

  // Sales 9 and Sales 10 are deliberately absent: they are not areas of this
  // site. They remain valid values in CAR_LOCATIONS, so a vehicle already
  // recorded in one keeps its location and the Update-location dropdown still
  // offers it - they simply are not drawn on, or selectable from, the map.
  // Giving either an entry here puts it back.
};

export const PARKING_AREAS = CAR_LOCATIONS.filter((location) => AREA_PLACEMENTS[location.id]).map(
  (location) => {
    const placement = AREA_PLACEMENTS[location.id];
    return {
      id: location.id,
      // The exact text stored against a vehicle, so an area and a record can
      // be matched without a translation table.
      label: location.label,
      type: placement.type,
      zone: placement.zone,
      anchor: placement.anchor,
      // Filled in by the clickable-area task. Null means "named, not yet
      // bounded", and the interaction layer renders nothing for it.
      shape: null,
    };
  }
);

export const PARKING_AREA_BY_ID = new Map(PARKING_AREAS.map((area) => [area.id, area]));

export const PARKING_AREA_COUNT = PARKING_AREAS.length;
