// file location: src/components/Deliveries/DeliveryRouteMap.js
//
// The day's route, drawn full-width across the top of the delivery detail
// panel. It replaces the old "Map" view control: the route is now always on
// screen above whichever stop you are looking at, rather than a mode you switch
// to and lose the list for.
//
// This draws a real basemap. Stops are geocoded by
// /api/parts/delivery-diary/route-map (postcodes.io - free, key-less, already
// used by /api/location/drive-time) and plotted on OpenStreetMap raster tiles
// in true Web Mercator, so a marker sits on the actual road it belongs to
// rather than on a schematic grid. There is no map library and no paid tile
// provider: the tiles are plain <img> elements positioned by the same
// projection the markers use, which is why the two can never drift apart.
//
// The route line is the real drive. The same API asks OSRM (free, key-less) to
// route the van from the parts desk through every stop in order and back, and
// returns the road geometry; this component projects those coordinates with the
// identical projection the tiles use, so the line lies on the roads underneath
// it. Miles and minutes in the header are that drive, not a straight-line
// guess. If OSRM could not answer, the API falls back to straight-line legs
// with a winding factor and says so - the line then renders dashed and the
// caption calls the figures estimates. The two cases must never look alike.
//
// If the tiles cannot be reached (offline, or a locked-down network) the
// basemap degrades to a plain tinted surface with the route still correctly
// positioned on it, rather than an empty black box. When no stop geocodes at
// all, the panel says so instead of drawing nothing. It never blocks the detail
// below it.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import LayerSurface from "@/components/ui/LayerSurface";
import { deliveryStyles, deliveryText } from "./deliveryStyles";
import {
  DELIVERY_STATUS,
  deliveryStatusLabel,
  normaliseDeliveryStatus,
} from "@/features/deliveries/deliveryStatus";

const TILE_SIZE = 256;
const MIN_ZOOM = 3;
// 16 is street level. Beyond that a single-stop route would be zoomed into a
// featureless close-up of one building.
const MAX_ZOOM = 16;
// Keeps markers and their labels clear of the frame edge when the route is fitted.
const FIT_INSET = 34;
// The parts-desk mark, in viewport pixels. Big enough to read as the brand at a
// glance, small enough not to swallow a nearby stop pin.
const ORIGIN_MARK_SIZE = 30;

const tileUrl = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Web Mercator world-pixel position of a coordinate at a given zoom. */
function project(latitude, longitude, zoom) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

/**
 * The two opposite corners of the box containing every point.
 *
 * Mercator x is monotonic in longitude and y in latitude, so fitting the corners
 * fits everything between them. That matters here because the routed geometry
 * can run to hundreds of coordinates and the fit is recomputed on every resize.
 */
function boundsCorners(points) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
    if (point.longitude < minLng) minLng = point.longitude;
    if (point.longitude > maxLng) maxLng = point.longitude;
  }
  return [
    { latitude: minLat, longitude: minLng },
    { latitude: maxLat, longitude: maxLng },
  ];
}

/**
 * The largest zoom at which every point still fits inside the viewport.
 *
 * Walking down from MAX_ZOOM rather than solving for it keeps the answer an
 * integer, which is what the tile grid needs - a fractional zoom would mean
 * scaling tiles and blurring the map.
 */
function fitZoom(points, width, height) {
  const usableW = Math.max(width - FIT_INSET * 2, 32);
  const usableH = Math.max(height - FIT_INSET * 2, 32);
  for (let zoom = MAX_ZOOM; zoom > MIN_ZOOM; zoom -= 1) {
    const projected = points.map((point) => project(point.latitude, point.longitude, zoom));
    const spanX = Math.max(...projected.map((p) => p.x)) - Math.min(...projected.map((p) => p.x));
    const spanY = Math.max(...projected.map((p) => p.y)) - Math.min(...projected.map((p) => p.y));
    if (spanX <= usableW && spanY <= usableH) return zoom;
  }
  return MIN_ZOOM;
}

/** "1h 24m" / "35 min" — a drive time a parts advisor can read at a glance. */
function formatDriveTime(minutes) {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

export default function DeliveryRouteMap({ map, loading, error, selectedId, onSelectStop }) {
  const viewportRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [failedTiles, setFailedTiles] = useState(() => new Set());

  // The viewport is fluid (full width of the detail panel, fixed aspect), so the
  // fit is recomputed from its measured box rather than assumed.
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (!box) return;
      setSize({ width: Math.round(box.width), height: Math.round(box.height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (!map?.available || !map?.origin) return null;
    const located = (map.stops || []).filter(
      (stop) => stop.located && typeof stop.latitude === "number"
    );
    if (located.length === 0) return null;
    // Geometry is only present when the drive was actually routed. Guarding on
    // its shape as well as its presence means a half-formed payload degrades to
    // the straight-line drawing rather than throwing inside the projection.
    const drive = Array.isArray(map.geometry)
      ? map.geometry.filter(
          (point) =>
            typeof point?.latitude === "number" && typeof point?.longitude === "number"
        )
      : [];
    return { origin: map.origin, located, drive: drive.length >= 2 ? drive : null };
  }, [map]);

  // The whole view - zoom, the world-pixel origin of the top-left corner, the
  // tiles that cover it, and every point already in viewport pixels - is derived
  // once, so the basemap and the overlay can never disagree.
  const view = useMemo(() => {
    if (!geo || size.width === 0 || size.height === 0) return null;
    // The drive is fitted too, not just its endpoints: a route that loops out
    // wide between two close stops would otherwise be clipped by the frame.
    const points = [geo.origin, ...geo.located, ...(geo.drive || [])];
    const corners = boundsCorners(points);
    const zoom = fitZoom(corners, size.width, size.height);
    const projected = corners.map((point) => project(point.latitude, point.longitude, zoom));
    const centre = {
      x: (Math.min(...projected.map((p) => p.x)) + Math.max(...projected.map((p) => p.x))) / 2,
      y: (Math.min(...projected.map((p) => p.y)) + Math.max(...projected.map((p) => p.y))) / 2,
    };
    const topLeft = { x: centre.x - size.width / 2, y: centre.y - size.height / 2 };
    const toViewport = (point) => {
      const world = project(point.latitude, point.longitude, zoom);
      return { x: world.x - topLeft.x, y: world.y - topLeft.y };
    };

    const tileCount = 2 ** zoom;
    const tiles = [];
    const firstX = Math.floor(topLeft.x / TILE_SIZE);
    const lastX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
    const firstY = Math.floor(topLeft.y / TILE_SIZE);
    const lastY = Math.floor((topLeft.y + size.height) / TILE_SIZE);
    for (let x = firstX; x <= lastX; x += 1) {
      for (let y = firstY; y <= lastY; y += 1) {
        // Above the north pole / below the south there is no tile to ask for.
        if (y < 0 || y >= tileCount) continue;
        // Longitude wraps; the tile column does too.
        const wrappedX = ((x % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${zoom}/${wrappedX}/${y}/${x}`,
          src: tileUrl(zoom, wrappedX, y),
          left: x * TILE_SIZE - topLeft.x,
          top: y * TILE_SIZE - topLeft.y,
        });
      }
    }

    return {
      zoom,
      tiles,
      origin: toViewport(geo.origin),
      stops: geo.located.map((stop) => ({ ...stop, ...toViewport(stop) })),
      drive: geo.drive ? geo.drive.map(toViewport) : null,
    };
  }, [geo, size.width, size.height]);

  // A new tile set (different day, different zoom) starts with a clean slate,
  // otherwise one bad tile would keep the "basemap unavailable" note forever.
  const tileSetKey = view ? `${view.zoom}:${view.tiles.length}` : "";
  useEffect(() => {
    setFailedTiles(new Set());
  }, [tileSetKey]);

  const handleTileError = useCallback((key) => {
    setFailedTiles((previous) => {
      if (previous.has(key)) return previous;
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }, []);

  const basemapDown =
    Boolean(view) && view.tiles.length > 0 && failedTiles.size >= view.tiles.length;
  const unplotted = (map?.stops || []).filter((stop) => !stop.located).length;

  // A routed drive is drawn along its own geometry. Without one, the fallback is
  // the old desk -> stops -> desk polyline, which is a schematic and is drawn as
  // one: dashed, so nobody reads it as a road.
  const isRouted = Boolean(view?.drive);
  const routePoints = view
    ? (view.drive
        ? view.drive
        : [view.origin, ...view.stops, view.origin]
      )
        .map((point) => `${point.x},${point.y}`)
        .join(" ")
    : "";

  const driveTime = formatDriveTime(map?.totalMinutes);

  const message = loading
    ? "Locating stops…"
    : error
    ? "Route unavailable"
    : !map?.available || !geo
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
            {isRouted ? `${map.totalMiles} mi` : `${map.totalMiles} mi est.`}
            {isRouted && driveTime ? ` · ${driveTime}` : ""}
            {unplotted > 0 ? ` · ${unplotted} not plotted` : ""}
          </span>
        ) : null}
      </div>

      {message ? (
        <span style={deliveryText.muted}>{message}</span>
      ) : (
        <div ref={viewportRef} style={deliveryStyles.routeMapViewport}>
          {view
            ? view.tiles
                .filter((tile) => !failedTiles.has(tile.key))
                .map((tile) => (
                  // next/image is wrong for map tiles: they are already 256px
                  // PNGs served from a CDN, and routing them through the image
                  // optimiser would proxy every tile of every route.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={tile.key}
                    src={tile.src}
                    alt=""
                    aria-hidden="true"
                    draggable="false"
                    referrerPolicy="no-referrer"
                    onError={() => handleTileError(tile.key)}
                    style={{
                      position: "absolute",
                      left: `${tile.left}px`,
                      top: `${tile.top}px`,
                      width: `${TILE_SIZE}px`,
                      height: `${TILE_SIZE}px`,
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  />
                ))
            : null}

          {view ? (
            <svg
              viewBox={`0 0 ${size.width} ${size.height}`}
              width={size.width}
              height={size.height}
              style={deliveryStyles.routeMapOverlay}
              role="img"
              aria-label={`${
                isRouted ? "Driving route" : "Estimated route"
              } from the parts desk through ${view.stops.length} located stops and back, about ${
                map.totalMiles
              } miles${isRouted && driveTime ? ` and ${driveTime} of driving` : ""}${
                unplotted > 0 ? `, ${unplotted} stop(s) could not be located` : ""
              }`}
            >
              {/* Desk -> each stop in drive order -> back to the desk, along the
                  roads when the drive was routed. Drawn twice: a light casing
                  under the line keeps it readable over dark map features as
                  well as light ones. */}
              <polyline
                points={routePoints}
                fill="none"
                stroke="var(--surface)"
                strokeOpacity="0.85"
                strokeWidth="7"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <polyline
                points={routePoints}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={isRouted ? "4" : "3"}
                // Solid means "this is the road". Dashed is reserved for the
                // straight-line fallback, which is a schematic.
                strokeDasharray={isRouted ? undefined : "7 5"}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {view.stops.map((stop) => {
                const isSelected = stop.id === selectedId;
                const isDelivered = normaliseDeliveryStatus(stop.status) === DELIVERY_STATUS.DELIVERED;
                return (
                  <g
                    key={stop.id}
                    onClick={() => onSelectStop?.(stop.id)}
                    style={{ cursor: onSelectStop ? "pointer" : "default" }}
                  >
                    {/* Invisible 44px touch target — the visible pin is
                        deliberately small so a dense route stays readable. */}
                    <circle cx={stop.x} cy={stop.y} r="22" fill="transparent" />
                    <circle
                      cx={stop.x}
                      cy={stop.y}
                      r={isSelected ? 13 : 10}
                      fill={
                        isDelivered
                          ? "var(--success-base)"
                          : stop.isUrgent
                          ? "var(--danger)"
                          : "var(--primary)"
                      }
                      stroke="var(--surface)"
                      strokeWidth="2"
                    />
                    {isSelected ? (
                      <circle
                        cx={stop.x}
                        cy={stop.y}
                        r="18"
                        fill="none"
                        stroke="var(--primary)"
                        strokeWidth="2"
                      />
                    ) : null}
                    <text
                      x={stop.x}
                      y={stop.y + 4}
                      textAnchor="middle"
                      fontSize={isSelected ? "13" : "11"}
                      fontWeight="700"
                      fill="var(--onAccentText)"
                    >
                      {stop.stopNumber}
                    </text>
                    <title>
                      {`Stop ${stop.stopNumber}: ${stop.label} (${stop.postcode}) — ${deliveryStatusLabel(
                        stop.status
                      )}`}
                    </title>
                  </g>
                );
              })}
            </svg>
          ) : null}

          {/* The parts desk is marked with the house logo rather than a labelled
              square — the same mark the collapsed sidebar rail uses, so "where
              we work" reads instantly without a caption competing with the stop
              numbers. It sits outside the SVG so it can go through BrandLogo and
              recolour to the active theme accent like every other instance. */}
          {view ? (
            <div
              title="Humphries & Parks parts desk"
              style={{
                ...deliveryStyles.routeMapOriginMark,
                left: `${view.origin.x}px`,
                top: `${view.origin.y}px`,
              }}
            >
              <BrandLogo
                src="/images/logo/icon-256.png"
                alt="Humphries & Parks parts desk"
                width={ORIGIN_MARK_SIZE * 2}
                height={ORIGIN_MARK_SIZE * 2}
                style={deliveryStyles.routeMapOriginMarkImage}
              />
            </div>
          ) : null}

          {/* Attribution is a condition of using the OpenStreetMap tiles; the
              routing engine has to be credited on the same terms. */}
          <span style={deliveryStyles.routeMapAttribution}>
            {basemapDown
              ? "Basemap unavailable — stops shown by position"
              : isRouted
              ? "© OpenStreetMap · routing by OSRM"
              : "© OpenStreetMap"}
          </span>
        </div>
      )}

      {map?.available && geo ? (
        <span style={deliveryText.caption}>
          {isRouted
            ? "The line is the driving route from the parts desk through every stop and back. Miles and drive time are for that route."
            : "Live routing is unavailable, so the line is drawn straight between postcodes and the distances are estimates."}
        </span>
      ) : null}
    </LayerSurface>
  );
}
