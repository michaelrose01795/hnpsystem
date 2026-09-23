// file location: src/features/tracking/map/parkingSiteMapImage.js
//
// The site-map asset the Map view draws.
//
// THE IMAGE IS THE MAP. The supplied site plan is used exactly as it was
// produced - no recolouring, no theme filter, no vector recreation of its
// buildings, roads, grass, fences or planting. The application's only job is
// to present it and to put UI layers over it.
//
// COORDINATE SYSTEM
// -----------------
// There is no declared pixel size here on purpose. The overlay takes its
// coordinate system from the image's own natural dimensions, read from the
// loaded asset (see ParkingSiteMap.js), so the two can never disagree and a
// later re-export at a different resolution needs no code change. Overlay
// geometry is therefore authored either in natural image pixels or, like the
// area anchors in parkingAreas.js, as fractions of the image.
//
// WHY THERE IS A LIST OF FILENAMES
// --------------------------------
// The plan is a hand-supplied asset, and whoever exports it next should not
// have to match an extension exactly or edit code to change one. The first of
// these that loads becomes the map; the rest are simply not requested. PNG is
// the preferred export - the plan has large flat areas and hard edges, which
// JPEG softens.
export const PARKING_SITE_MAP_SOURCES = [
  "/images/tracking/parking-site-map.png",
  "/images/tracking/parking-site-map.jpg",
  "/images/tracking/parking-site-map.webp",
];

export const PARKING_SITE_MAP_ALT =
  "Site plan of the dealership: the lower yard and front forecourt onto the main road, the workshop and showroom " +
  "buildings in the centre, the upper compound with its container storage, and the upper-right yard, inside the " +
  "fenced boundary.";

// Shown in place of the plan when no candidate loads, so a missing file is
// obvious and actionable instead of an empty grey box.
export const PARKING_SITE_MAP_MISSING_MESSAGE =
  "Site map image not found. Save the supplied site plan to public/images/tracking/ as parking-site-map.png " +
  "(.jpg or .webp also work) and it becomes the map automatically - the overlay reads its size from the file, " +
  "so any resolution works.";
