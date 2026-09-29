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
//     `- <svg>  the overlay: one selectable group per section
//                 |- region  the clickable area (transparent until hover/selection)
//                 `- label   the section's name pill, with its vehicle count
//
// ALIGNMENT
// ---------
// The overlay's viewBox is the image's OWN natural size, read from the loaded
// file rather than declared here, so the two share one coordinate system. The
// image is letterboxed by `object-fit: contain` and the overlay by
// `preserveAspectRatio="xMidYMid meet"` inside the same box - identical
// ratios, identical box, so a point in the overlay sits exactly over the same
// point of the plan at every size.
//
// SELECTION
// ---------
// Each section is ONE focusable button (role="button", aria-pressed), and the
// label and region inside it are two hit areas for the same control — so a
// click on the pill, a click on the building and Enter/Space on the focused
// section all do the same thing. An optional `shouldIgnoreClick` lets a host
// drop a click; the tracking map is fixed (no pan/zoom) and passes none.

import React, { useState } from "react";
import { PARKING_AREAS, buildSectionGeometry } from "@/features/tracking/map/parkingAreas";
import {
  PARKING_SITE_MAP_ALT,
  PARKING_SITE_MAP_MISSING_MESSAGE,
  PARKING_SITE_MAP_SOURCES,
} from "@/features/tracking/map/parkingSiteMapImage";

const describeCount = (count) => (count === 1 ? "1 vehicle" : `${count} vehicles`);

export default function ParkingSiteMap({
  selectedId = null,
  counts = {},
  onSelect,
  shouldIgnoreClick,
}) {
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

  const select = (id) => {
    if (typeof shouldIgnoreClick === "function" && shouldIgnoreClick()) return;
    if (typeof onSelect === "function") onSelect(id);
  };

  const handleKeyDown = (event, id) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (typeof onSelect === "function") onSelect(id);
    }
  };

  if (!source) {
    return <p className="parking-map__missing">{PARKING_SITE_MAP_MISSING_MESSAGE}</p>;
  }

  // Draw the selected section last so its highlight is never under a neighbour.
  const ordered = selectedId
    ? [...PARKING_AREAS.filter((area) => area.id !== selectedId), ...PARKING_AREAS.filter((area) => area.id === selectedId)]
    : PARKING_AREAS;

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

      {natural && (
        <svg
          className="parking-map__overlay"
          viewBox={`0 0 ${natural.width} ${natural.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Site sections"
        >
          {ordered.map((area) => {
            const count = counts[area.id] || 0;
            const geometry = buildSectionGeometry(area, natural, count);
            const isSelected = area.id === selectedId;
            return (
              <g
                key={area.id}
                className={`parking-map__section${isSelected ? " is-selected" : ""}`}
                data-area-id={area.id}
                data-area-type={area.type}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${area.label}, ${describeCount(count)}`}
                onClick={() => select(area.id)}
                onKeyDown={(event) => handleKeyDown(event, area.id)}
              >
                {geometry.region && (
                  <rect
                    className="parking-map__region"
                    x={geometry.region.x}
                    y={geometry.region.y}
                    width={geometry.region.width}
                    height={geometry.region.height}
                    rx={geometry.regionRadius}
                  />
                )}
                <g className="parking-map__label">
                  <rect
                    className="parking-map__label-pill"
                    x={geometry.pill.x}
                    y={geometry.pill.y}
                    width={geometry.pill.width}
                    height={geometry.pill.height}
                    rx={geometry.pill.radius}
                  />
                  <text
                    className="parking-map__label-text"
                    x={geometry.text.x}
                    y={geometry.text.y}
                    fontSize={geometry.text.fontSize}
                  >
                    {area.label}
                  </text>
                  {geometry.count && (
                    <text
                      className="parking-map__label-count"
                      x={geometry.count.x}
                      y={geometry.count.y}
                      fontSize={geometry.count.fontSize}
                    >
                      {geometry.count.text}
                    </text>
                  )}
                </g>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
