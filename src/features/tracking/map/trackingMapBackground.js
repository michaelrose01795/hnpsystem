// file location: src/features/tracking/map/trackingMapBackground.js
//
// The visible base layer of the /tracking site map.
//
// THE MAP IS IMAGE-FIRST. The supplied Humphries & Parks aerial render is the
// base layer; the vector plan in trackingMapSite.js is only a fallback for
// when that file is missing, and is never drawn over the photograph.
//
// A NOTE ON THE OTHER FILE IN THIS FOLDER
// ---------------------------------------
// public/images/tracking/site-map-background.png is NOT the H&P site. It is a
// 1313x1070 render of a different, unlabelled industrial estate — no London
// Road frontage, no forecourt, no containers, no Rear Car Park A/B — and,
// despite the extension, its bytes are a JPEG. Nothing references it any more.
// It is what the map used to draw, and it is why the plan never matched the
// reference. Safe to delete.

export const TRACKING_MAP_REFERENCE = {
  // The supplied H&P aerial render. Correct extension for its real format,
  // unlike the legacy asset above.
  src: "/images/tracking/hnp-site-aerial.jpg",
  // The reference's native size. The stage is locked to this ratio and the
  // image is drawn with object-fit: contain, so nothing is ever cropped and
  // the percentage coordinates in trackingMapSite.js stay true.
  width: 1672,
  height: 941,
  alt: "Humphries & Parks site plan — London Road, showing the access road, stock compound, showroom, workshop, front forecourt, rear car parks and container storage",
};

export const TRACKING_MAP_ASPECT_RATIO = `${TRACKING_MAP_REFERENCE.width} / ${TRACKING_MAP_REFERENCE.height}`;

// Shown in place of the photo when the reference is missing, so the gap is
// obvious and actionable rather than silently falling back for ever.
export const MISSING_REFERENCE_MESSAGE =
  `Site photo not found. Save the Humphries & Parks aerial render to public${TRACKING_MAP_REFERENCE.src} ` +
  `(${TRACKING_MAP_REFERENCE.width}×${TRACKING_MAP_REFERENCE.height}) and it becomes the map base automatically. ` +
  `Parking positions are already calibrated to it — the outline plan below is a stand-in.`;
