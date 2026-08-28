// file location: src/components/Deliveries/DeliveryRouteMap.js
//
// The day's route, drawn full-width across the top of the delivery detail
// panel. It replaces the old "Map" view control: the route is now always on
// screen above whichever stop you are looking at, rather than a mode you switch
// to and lose the list for.
//
// There is no map library or tile provider in this project and the brief rules
// out adding a paid one, so this is honest about what it is: stops plotted by
// latitude/longitude on an equirectangular projection, joined in drive order,
// with straight-line-plus-winding-factor distances from
// /api/parts/delivery-diary/route-map (postcodes.io — free, already used by
// /api/location/drive-time).
//
// When postcode lookup is unavailable, or no stop resolves, the panel says so
// instead of drawing an empty grid. It never blocks the detail below it.

import React, { useMemo } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import { deliveryStyles, deliveryText } from "./deliveryStyles";
import { deliveryStatusLabel } from "@/features/deliveries/deliveryStatus";

// The viewBox matches the box's 4:3 aspect ratio so the plot fills the width
// instead of letterboxing a square drawing inside a wide frame.
const VIEW_W = 133;
const VIEW_H = 100;
const PADDING = 13;

/**
 * Project geographic points into the viewBox.
 *
 * Longitude is scaled by cos(latitude) so a Kent-sized route keeps its real
 * proportions instead of being stretched east–west, and both axes share one
 * scale so the shape of the run is not distorted to fill the frame.
 */
function projectPoints(points) {
  if (points.length === 0) return [];
  const meanLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const cosLat = Math.cos((meanLat * Math.PI) / 180) || 1;

  const xs = points.map((p) => p.longitude * cosLat);
  const ys = points.map((p) => p.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // A single stop (or a perfectly straight run) has zero span on an axis; fall
  // back to a nominal span so it lands in the middle rather than at NaN.
  const spanX = maxX - minX || 0.02;
  const spanY = maxY - minY || 0.02;
  const scale = Math.min((VIEW_W - PADDING * 2) / spanX, (VIEW_H - PADDING * 2) / spanY);
  const offsetX = (VIEW_W - spanX * scale) / 2;
  const offsetY = (VIEW_H - spanY * scale) / 2;

  return points.map((point) => ({
    ...point,
    x: offsetX + (point.longitude * cosLat - minX) * scale,
    // SVG y grows downwards; latitude grows north, so it is inverted.
    y: VIEW_H - (offsetY + (point.latitude - minY) * scale),
  }));
}

export default function DeliveryRouteMap({ map, loading, error, selectedId, onSelectStop }) {
  const projected = useMemo(() => {
    if (!map?.available) return { origin: null, stops: [] };
    const located = (map.stops || []).filter((stop) => stop.located);
    const all = projectPoints([{ ...map.origin, id: "origin" }, ...located]);
    return { origin: all[0] || null, stops: all.slice(1) };
  }, [map]);

  const unplotted = (map?.stops || []).filter((stop) => !stop.located).length;

  const message = loading
    ? "Locating stops…"
    : error
    ? "Route unavailable"
    : !map?.available
    ? map?.detail || "No stop on this route has a postcode that can be located."
    : null;

  return (
    <LayerSurface
      padding="var(--space-3)"
      gap="var(--space-sm)"
      radius="var(--radius-sm)"
      sectionKey="parts-deliveries-route-map"
      parentKey="parts-deliveries-detail"
      sectionType="content-card"
      data-presentation="deliveries-route-map"
      style={deliveryStyles.routeMapCard}
    >
      <div style={deliveryStyles.headerTopRow}>
        <span style={deliveryText.label}>Route</span>
        {map?.available ? (
          <span style={deliveryText.caption}>
            {map.totalMiles} mi est.
            {unplotted > 0 ? ` · ${unplotted} not plotted` : ""}
          </span>
        ) : null}
      </div>

      {message ? (
        <span style={deliveryText.muted}>{message}</span>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={deliveryStyles.routeMapSvg}
          role="img"
          aria-label={`Route with ${projected.stops.length} located stops covering about ${map.totalMiles} miles${
            unplotted > 0 ? `, ${unplotted} stop(s) could not be located` : ""
          }`}
        >
          {/* Desk → each stop in drive order → back to the desk. */}
          {projected.origin ? (
            <polyline
              points={[
                `${projected.origin.x},${projected.origin.y}`,
                ...projected.stops.map((stop) => `${stop.x},${stop.y}`),
                `${projected.origin.x},${projected.origin.y}`,
              ].join(" ")}
              fill="none"
              stroke="var(--accent-strong)"
              strokeWidth="1"
              strokeOpacity="0.45"
              strokeDasharray="2.5 2"
              strokeLinejoin="round"
            />
          ) : null}

          {projected.origin ? (
            <g>
              <rect
                x={projected.origin.x - 3}
                y={projected.origin.y - 3}
                width="6"
                height="6"
                rx="1.4"
                fill="var(--text-1)"
              />
              <text
                x={projected.origin.x}
                y={projected.origin.y + 10}
                textAnchor="middle"
                fontSize="4"
                fontWeight="600"
                fill="var(--text-1)"
              >
                Parts desk
              </text>
              <title>Humphries &amp; Parks parts desk</title>
            </g>
          ) : null}

          {projected.stops.map((stop) => {
            const isSelected = stop.id === selectedId;
            return (
              <g
                key={stop.id}
                onClick={() => onSelectStop?.(stop.id)}
                style={{ cursor: onSelectStop ? "pointer" : "default" }}
              >
                <circle
                  cx={stop.x}
                  cy={stop.y}
                  r={isSelected ? 5.2 : 4}
                  fill={stop.isUrgent ? "var(--danger)" : "var(--primary)"}
                />
                {isSelected ? (
                  <circle
                    cx={stop.x}
                    cy={stop.y}
                    r="7.4"
                    fill="none"
                    stroke="var(--accent-strong)"
                    strokeWidth="1"
                  />
                ) : null}
                <text
                  x={stop.x}
                  y={stop.y + 1.7}
                  textAnchor="middle"
                  fontSize={isSelected ? "5.2" : "4.5"}
                  fontWeight="700"
                  fill="var(--onAccentText)"
                >
                  {stop.stopNumber}
                </text>
                <title>
                  {`Stop ${stop.stopNumber}: ${stop.label} (${stop.postcode}) — ${deliveryStatusLabel(stop.status)}`}
                </title>
              </g>
            );
          })}
        </svg>
      )}

      {map?.available ? (
        <span style={deliveryText.caption}>
          Distances are estimated from postcode positions, not a routed drive.
        </span>
      ) : null}
    </LayerSurface>
  );
}
