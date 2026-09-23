// file location: src/features/tracking/map/parkingAreas.js
//
// The central SECTION config for the /tracking site map: every canonical
// vehicle-location section, merged with where it sits on the supplied plan.
//
// TWO HALVES, ONE RECORD
// ----------------------
//   What a section IS  -> src/lib/tracking/vehicleLocations.js
//                          id, label, type, capacity, displayOrder,
//                          supportsAutoMovement, isPhysicalMapArea, aliases
//   Where it IS DRAWN  -> MAP_PLACEMENTS below
//                          labelAnchor, region, zone
//
// TRACKING_SECTIONS is the join. Every chip, map label, clickable region and
// panel reads it, so the map can never offer a section the dropdowns do not,
// and editing a capacity or a label in the registry updates all of them.
//
// COORDINATES
// -----------
// Everything is a FRACTION of the site-map image (0-1 on each axis), not a
// pixel position, so placements survive the asset being re-exported at another
// resolution. ParkingSiteMap.js multiplies them by the image's natural size,
// which is the overlay's coordinate system — so labels and regions stay locked
// to the plan through zoom, pan and Fit site.
//
//   labelAnchor  the centre of the section's name pill
//   region       the clickable area: { x0, y0, x1, y1 } fractional bounds
//
// PLACEMENTS ARE PROVISIONAL
// --------------------------
// Buildings (Paint, Valet, Workshop, Showroom) are placed over the building
// footprints visible on the plan, with TIGHT regions that match the roof.
// The yards (Service, Sales 1-8, Staff, Trade) keep their existing reference
// label positions and get a generous region around the label; their true
// boundaries have not been agreed. Off Site sits at the site entrance, where
// the access road meets the main road — it is a destination, not a structure.
// Every value here is meant to be nudged after a visual review.

import { VEHICLE_LOCATIONS } from "@/lib/tracking/vehicleLocations";

const MAP_PLACEMENTS = {
  // ---------------------------------------------------------------- yards
  // East perimeter, alongside the showroom.
  service: { zone: "East perimeter", labelAnchor: { x: 0.769, y: 0.648 }, region: { x0: 0.752, y0: 0.560, x1: 0.812, y1: 0.790 } },

  // The front forecourt onto the main road.
  "sales-1": { zone: "Front forecourt", labelAnchor: { x: 0.648, y: 0.711 }, region: { x0: 0.550, y0: 0.680, x1: 0.735, y1: 0.785 } },

  // The yard between the central units and the showroom.
  "sales-2": { zone: "Service yard", labelAnchor: { x: 0.477, y: 0.631 }, region: { x0: 0.410, y0: 0.560, x1: 0.545, y1: 0.700 } },

  // The lower dealership yard - the largest single area on the site.
  "sales-3": { zone: "Lower yard", labelAnchor: { x: 0.243, y: 0.674 }, region: { x0: 0.110, y0: 0.636, x1: 0.380, y1: 0.712 } },
  "sales-4": { zone: "Lower yard", labelAnchor: { x: 0.243, y: 0.749 }, region: { x0: 0.080, y0: 0.712, x1: 0.460, y1: 0.790 } },
  "sales-5": { zone: "Lower yard", labelAnchor: { x: 0.255, y: 0.593 }, region: { x0: 0.110, y0: 0.540, x1: 0.400, y1: 0.636 } },
  "sales-6": { zone: "Lower yard", labelAnchor: { x: 0.269, y: 0.463 }, region: { x0: 0.130, y0: 0.395, x1: 0.310, y1: 0.540 } },

  // The container / storage island and the upper compound around it.
  "sales-7": { zone: "Container storage", labelAnchor: { x: 0.570, y: 0.213 }, region: { x0: 0.440, y0: 0.160, x1: 0.650, y1: 0.245 } },
  staff: { zone: "Upper compound", labelAnchor: { x: 0.315, y: 0.198 }, region: { x0: 0.200, y0: 0.150, x1: 0.440, y1: 0.245 } },

  // The upper-right yard.
  "sales-8": { zone: "Upper-right yard", labelAnchor: { x: 0.739, y: 0.102 }, region: { x0: 0.650, y0: 0.045, x1: 0.840, y1: 0.160 } },
  trade: { zone: "Upper-right yard", labelAnchor: { x: 0.907, y: 0.159 }, region: { x0: 0.840, y0: 0.060, x1: 0.960, y1: 0.230 } },

  // ------------------------------------------------------------ buildings
  // Regions are the roof footprints on the plan, so a click on the building
  // is a click on the section.
  //
  // The small detached unit on the west side of the central cluster.
  paint: { zone: "Central buildings", labelAnchor: { x: 0.357, y: 0.440 }, region: { x0: 0.318, y0: 0.385, x1: 0.390, y1: 0.500 } },
  // The narrow L-shaped unit between Paint and the workshop.
  valet: { zone: "Central buildings", labelAnchor: { x: 0.460, y: 0.455 }, region: { x0: 0.412, y0: 0.405, x1: 0.528, y1: 0.535 } },
  // The large main workshop building.
  workshop: { zone: "Central buildings", labelAnchor: { x: 0.640, y: 0.440 }, region: { x0: 0.535, y0: 0.385, x1: 0.742, y1: 0.498 } },
  // The glass-fronted showroom building facing the forecourt.
  showroom: { zone: "Showroom", labelAnchor: { x: 0.643, y: 0.600 }, region: { x0: 0.552, y0: 0.550, x1: 0.732, y1: 0.655 } },

  // ------------------------------------------------------------- entrance
  // Off Site is anchored where vehicles leave the site: the access road
  // between the two front verges, at the main road.
  "off-site": { zone: "Site entrance", labelAnchor: { x: 0.493, y: 0.862 }, region: { x0: 0.440, y0: 0.820, x1: 0.546, y1: 0.905 } },
};

const toSection = (location) => {
  const placement = location.isPhysicalMapArea ? MAP_PLACEMENTS[location.id] || null : null;
  return {
    ...location,
    // Drawn on the plan only when it is a physical place AND has a placement.
    isOnMap: Boolean(placement),
    zone: placement?.zone || null,
    labelAnchor: placement?.labelAnchor || null,
    region: placement?.region || null,
  };
};

/** Every canonical section, in display order, with its map placement (if any). */
export const TRACKING_SECTIONS = VEHICLE_LOCATIONS.map(toSection);

export const TRACKING_SECTION_BY_ID = new Map(TRACKING_SECTIONS.map((section) => [section.id, section]));

/** The sections drawn on the plan. */
export const PARKING_AREAS = TRACKING_SECTIONS.filter((section) => section.isOnMap);

export const PARKING_AREA_BY_ID = new Map(PARKING_AREAS.map((area) => [area.id, area]));

export const PARKING_AREA_COUNT = PARKING_AREAS.length;

// -----------------------------------------------------------------------------
// Overlay geometry
// -----------------------------------------------------------------------------
// Converts a section's fractional placement into the overlay's coordinate
// system (the image's natural pixels). Pure, so the label / region maths is
// unit-tested without rendering the map.

// Label pills are sized from their text rather than measured at runtime: an
// SVG text node cannot report its width before it paints, and a re-measure
// pass would cost a layout on every resize for no visual gain. The numbers are
// a share of the image's smaller dimension, so a label keeps its size relative
// to the plan whatever resolution the asset is exported at.
const LABEL_HEIGHT_RATIO = 0.032;
const LABEL_CHAR_RATIO = 0.0098;
const LABEL_PADDING_RATIO = 0.017;
const COUNT_GAP_RATIO = 0.008;

export function buildSectionGeometry(area, natural, count = 0) {
  const scale = Math.min(natural.width, natural.height);
  const height = scale * LABEL_HEIGHT_RATIO;
  const countText = count > 0 ? String(count) : "";
  const labelWidth = area.label.length * scale * LABEL_CHAR_RATIO;
  const countWidth = countText ? countText.length * scale * LABEL_CHAR_RATIO + scale * COUNT_GAP_RATIO : 0;
  const width = labelWidth + countWidth + scale * LABEL_PADDING_RATIO * 2;
  const centreX = area.labelAnchor.x * natural.width;
  const centreY = area.labelAnchor.y * natural.height;
  const left = centreX - width / 2;
  const region = area.region
    ? {
        x: area.region.x0 * natural.width,
        y: area.region.y0 * natural.height,
        width: (area.region.x1 - area.region.x0) * natural.width,
        height: (area.region.y1 - area.region.y0) * natural.height,
      }
    : null;
  return {
    pill: { x: left, y: centreY - height / 2, width, height, radius: height / 2 },
    text: { x: left + scale * LABEL_PADDING_RATIO + labelWidth / 2, y: centreY, fontSize: height * 0.56 },
    count: countText
      ? { x: left + scale * LABEL_PADDING_RATIO + labelWidth + countWidth / 2 + (scale * COUNT_GAP_RATIO) / 2, y: centreY, text: countText, fontSize: height * 0.5 }
      : null,
    region,
    regionRadius: scale * 0.006,
  };
}

/** Exposed for the placement unit tests only. */
export const MAP_PLACEMENT_IDS = Object.keys(MAP_PLACEMENTS);
