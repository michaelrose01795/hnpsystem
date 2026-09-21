// file location: src/features/tracking/map/ParkingSiteMap.js
//
// The site map shown by /tracking -> Key/Parking -> Map.
//
// THE SUPPLIED IMAGE IS THE MAP. This component renders that asset and puts
// UI layers over it. It does not draw the site: there is no generated tarmac,
// building, road, kerb, fence, tree or boundary anywhere in this file, and the
// image is never recoloured or filtered for the theme.
//
//   viewport
//     |- <img>  the site plan, object-fit: contain
//     `- <svg>  the overlay: area labels, and the reserved interaction layer
//
// ALIGNMENT
// ---------
// The overlay's viewBox is the image's OWN natural size, read from the loaded
// file rather than declared here, so the two share one coordinate system. The
// image is letterboxed by `object-fit: contain` and the overlay by
// `preserveAspectRatio="xMidYMid meet"` inside the same box - identical
// ratios, identical box, so a point in the overlay sits exactly over the same
// point of the plan at every size. Both live inside the pan/zoom stage, so
// zooming, panning and Fit site move them together.

import React, { useState } from "react";
import { PARKING_AREAS } from "@/features/tracking/map/parkingAreas";
import {
  PARKING_SITE_MAP_ALT,
  PARKING_SITE_MAP_MISSING_MESSAGE,
  PARKING_SITE_MAP_SOURCES,
} from "@/features/tracking/map/parkingSiteMapImage";

// Label pills are sized from their text rather than measured at runtime: an
// SVG text node cannot report its width before it paints, and a re-measure
// pass would cost a layout on every resize for no visual gain. The numbers are
// a share of the image's smaller dimension, so a label keeps its size relative
// to the plan whatever resolution the asset is exported at.
const LABEL_HEIGHT_RATIO = 0.032;
const LABEL_CHAR_RATIO = 0.0098;
const LABEL_PADDING_RATIO = 0.017;

export default function ParkingSiteMap() {
  // The image's natural size, and therefore the overlay's coordinate system.
  const [natural, setNatural] = useState(null);
  // Which candidate filename is being tried; past the end means none loaded.
  const [sourceIndex, setSourceIndex] = useState(0);
  const source = PARKING_SITE_MAP_SOURCES[sourceIndex];

  const handleLoad = (event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!naturalWidth || !naturalHeight) return;
    setNatural((current) =>
      current && current.width === naturalWidth && current.height === naturalHeight
        ? current
        : { width: naturalWidth, height: naturalHeight }
    );
  };

  // Area labels, placed from the fractional anchors in parkingAreas.js. These
  // are provisional positions; the exact ones arrive with the clickable areas.
  const labels = natural
    ? PARKING_AREAS.map((area) => {
        const scale = Math.min(natural.width, natural.height);
        const height = scale * LABEL_HEIGHT_RATIO;
        const width = area.label.length * scale * LABEL_CHAR_RATIO + scale * LABEL_PADDING_RATIO * 2;
        const centreX = area.anchor.x * natural.width;
        const centreY = area.anchor.y * natural.height;
        return {
          id: area.id,
          label: area.label,
          type: area.type,
          x: centreX - width / 2,
          y: centreY - height / 2,
          width,
          height,
          centreX,
          centreY,
          fontSize: height * 0.56,
        };
      })
    : [];

  const interactiveAreas = PARKING_AREAS.filter((area) => area.shape);

  if (!source) {
    return <p className="parking-map__missing">{PARKING_SITE_MAP_MISSING_MESSAGE}</p>;
  }

  return (
    <div className="parking-map__viewport">
      {/* The plan itself, exactly as supplied. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed site-plan asset whose natural size defines the overlay's coordinate system; next/image adds a layout wrapper that would break that alignment. */}
      <img
        className="parking-map__image"
        key={source}
        src={source}
        alt={PARKING_SITE_MAP_ALT}
        onLoad={handleLoad}
        onError={() => setSourceIndex((index) => index + 1)}
        draggable={false}
      />

      {/* The overlay. Decorative for now: every label it carries is also in
          the image's alt text and in the tracking lists, so announcing it
          again would only repeat the same information. It becomes meaningful,
          and focusable, when the areas become selectable. */}
      {natural && (
        <svg
          className="parking-map__overlay"
          viewBox={`0 0 ${natural.width} ${natural.height}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          {/* Parking area names. */}
          <g className="parking-map__labels" id="site-labels">
            {labels.map((label) => (
              <g key={label.id} className="parking-map__label" data-area-id={label.id} data-area-type={label.type}>
                <rect
                  className="parking-map__label-pill"
                  x={label.x}
                  y={label.y}
                  width={label.width}
                  height={label.height}
                  rx={label.height / 2}
                />
                <text
                  className="parking-map__label-text"
                  x={label.centreX}
                  y={label.centreY}
                  fontSize={label.fontSize}
                >
                  {label.label}
                </text>
              </g>
            ))}
          </g>

          {/* Reserved for the clickable parking areas: one
              <path data-area-id="…"/> per area, fed by the `shape` field in
              parkingAreas.js. Empty, and non-interactive, until those
              boundaries are agreed. */}
          <g className="parking-map__interaction-layer" id="site-interaction">
            {interactiveAreas.map((area) => (
              <path key={area.id} className="parking-map__area" data-area-id={area.id} d={area.shape} />
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
