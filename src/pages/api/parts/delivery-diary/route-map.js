// file location: src/pages/api/parts/delivery-diary/route-map.js
//
// Geocodes the stops on one day's route and routes the drive between them.
//
// There is no mapping library in this project and no paid API may be
// introduced, so both halves of the answer come from free, key-less services:
//
//   1. Postcodes are geocoded by postcodes.io — exactly what
//      /api/location/drive-time already relies on.
//   2. The drive itself is routed by OSRM (the public demo server by default,
//      or whatever OSRM_BASE_URL points at). It returns the real road geometry
//      from the parts desk through every stop in order and back, plus per-leg
//      driving distance and duration. That geometry is what the page draws, so
//      the line on the map follows the roads the van actually takes rather than
//      a straight hop between postcodes.
//
// OSRM is best-effort. If it is slow, rate-limited, unreachable, or refuses the
// waypoint set, the response falls back to the previous behaviour —
// straight-line distance with a winding factor, and no geometry — and flags
// itself with provider: "estimate" so the page says so in its caption instead
// of quietly presenting a guess as a routed drive.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasAllAccessRole, normalizeRoles } from "@/lib/auth/roles";
import {
  DELIVERY_DIARY_ROLES,
  resolveDeliveryCapabilities,
} from "@/features/deliveries/deliveryStatus";
import { listDeliveriesForDate } from "@/lib/database/deliveries";
import { HNP_ORIGIN_POSTCODE_DEFAULT } from "@/lib/mobileMechanic/config";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
const BULK_LIMIT = 100;

// postcodes.io caps a bulk lookup at 100 postcodes per request.
async function bulkLookup(postcodes) {
  if (postcodes.length === 0) return new Map();
  const results = new Map();
  for (let index = 0; index < postcodes.length; index += BULK_LIMIT) {
    const batch = postcodes.slice(index, index + BULK_LIMIT);
    let response;
    try {
      response = await fetch("https://api.postcodes.io/postcodes", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ postcodes: batch }),
      });
    } catch {
      return results; // network failure — the caller degrades to "unavailable"
    }
    if (!response.ok) return results;
    const payload = await response.json().catch(() => null);
    for (const entry of payload?.result || []) {
      const result = entry?.result;
      if (!result || typeof result.latitude !== "number") continue;
      results.set(String(entry.query || "").toUpperCase().replace(/\s+/g, ""), {
        postcode: result.postcode,
        latitude: result.latitude,
        longitude: result.longitude,
      });
    }
  }
  return results;
}

// Great-circle distance in miles — the same haversine used by
// /api/location/drive-time, so leg estimates stay consistent between the two.
function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.7613;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude));
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Road distance is longer than straight-line. The same 1.35 winding factor the
// drive-time estimator uses, so the two never disagree about the same leg.
// Only reached when OSRM could not answer.
const ROAD_FACTOR = 1.35;

const METRES_PER_MILE = 1609.344;

// The public OSRM demo server is free and key-less, matching the constraint
// that already put postcodes.io in this file. Self-hosting later means pointing
// OSRM_BASE_URL somewhere else — nothing else here changes.
const OSRM_BASE_URL = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org").replace(
  /\/+$/,
  ""
);
// A route panel must never hold the page open on a slow third party; past this
// the request is abandoned and the estimate is used instead.
const OSRM_TIMEOUT_MS = 7000;
// Waypoints travel in the URL path. A day's van run is nowhere near this, and
// the cap stops a pathological day building an unroutable request.
const OSRM_MAX_WAYPOINTS = 60;

const roundTenth = (value) => Math.round(value * 10) / 10;

const normaliseKey = (postcode) => String(postcode || "").toUpperCase().replace(/\s+/g, "");

/**
 * Ask OSRM to drive through `points` in order.
 *
 * Returns null on any failure — the caller then falls back to the estimate.
 * Never throws: a routing outage must not take the panel down with it.
 *
 * @param {Array<{latitude:number, longitude:number}>} points
 * @returns {Promise<null | {
 *   legMiles: number[],
 *   legMinutes: number[],
 *   geometry: Array<{latitude:number, longitude:number}>,
 *   totalMiles: number,
 *   totalMinutes: number,
 * }>}
 */
async function routeDrive(points) {
  if (points.length < 2 || points.length > OSRM_MAX_WAYPOINTS) return null;

  const coordinates = points
    .map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`)
    .join(";");
  // overview=simplified is Douglas-Peucker-reduced geometry: it still follows
  // every road the route uses, but at a fraction of the points. The panel is a
  // few hundred pixels wide, so full geometry would be detail nobody can see.
  const url =
    `${OSRM_BASE_URL}/route/v1/driving/${coordinates}` +
    "?overview=simplified&geometries=geojson&steps=false&alternatives=false";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    if (payload?.code !== "Ok") return null;

    const route = payload?.routes?.[0];
    const legs = route?.legs;
    const line = route?.geometry?.coordinates;
    // One leg per consecutive pair of waypoints. Anything else means the answer
    // does not describe the journey that was asked for, so it is not safe to
    // map legs back onto stops.
    if (!Array.isArray(legs) || legs.length !== points.length - 1) return null;
    if (!Array.isArray(line) || line.length < 2) return null;

    return {
      legMiles: legs.map((leg) => roundTenth(Number(leg?.distance || 0) / METRES_PER_MILE)),
      legMinutes: legs.map((leg) => Math.round(Number(leg?.duration || 0) / 60)),
      // GeoJSON is [longitude, latitude]; every other coordinate in this
      // response is lat/lng, so it is flipped once, here.
      geometry: line
        .filter((pair) => Array.isArray(pair) && pair.length >= 2)
        .map(([longitude, latitude]) => ({ latitude, longitude })),
      totalMiles: roundTenth(Number(route?.distance || 0) / METRES_PER_MILE),
      totalMinutes: Math.round(Number(route?.duration || 0) / 60),
    };
  } catch {
    // Timeout, DNS failure, malformed JSON — all the same answer: no route.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }

  const roles = normalizeRoles(session?.user?.roles ?? []);
  const capabilities = resolveDeliveryCapabilities(roles, hasAllAccessRole(roles));
  if (!capabilities.view) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }

  const requestedDate = String(req.query.date || "").trim();
  if (!ISO_DATE_RE.test(requestedDate)) {
    res.status(400).json({ success: false, message: "A valid delivery date is required." });
    return;
  }

  try {
    const deliveries = await listDeliveriesForDate({ date: requestedDate });
    const originPostcode =
      process.env.HNP_ORIGIN_POSTCODE || HNP_ORIGIN_POSTCODE_DEFAULT;

    const wanted = new Set([originPostcode]);
    for (const delivery of deliveries) {
      const postcode = delivery.postcodeValue;
      if (postcode && UK_POSTCODE_RE.test(postcode)) wanted.add(postcode);
    }

    const geocoded = await bulkLookup([...wanted]);
    const origin = geocoded.get(normaliseKey(originPostcode)) || null;

    if (!origin || geocoded.size <= 1) {
      // Nothing plottable — say so plainly rather than drawing an empty map.
      res.status(200).json({
        success: true,
        data: {
          date: requestedDate,
          available: false,
          detail:
            geocoded.size === 0
              ? "Postcode lookup is unavailable right now."
              : "No stop on this route has a postcode that could be located.",
          origin,
          stops: [],
          totalMiles: 0,
        },
      });
      return;
    }

    // Two passes: build the stop list and the waypoint list first, then attach
    // distances once it is known whether they came from a routed drive or from
    // the estimate. A stop that could not be geocoded stays in the list — the
    // page reports it as "not plotted" — but never becomes a waypoint.
    const stops = [];
    const waypoints = [origin];
    const waypointStopIndex = [];

    deliveries.forEach((delivery, index) => {
      const point = geocoded.get(normaliseKey(delivery.postcodeValue));
      const base = {
        id: delivery.id,
        stopNumber: index + 1,
        label: delivery.customerDisplayName || delivery.customer_name || "Stop",
        status: delivery.status,
      };
      if (!point) {
        stops.push({ ...base, located: false, postcode: delivery.postcodeValue || null });
        return;
      }
      waypointStopIndex.push(stops.length);
      waypoints.push(point);
      stops.push({
        ...base,
        located: true,
        postcode: point.postcode,
        latitude: point.latitude,
        longitude: point.longitude,
        isUrgent: Boolean(delivery.is_urgent),
      });
    });

    // The van comes back to the parts desk, so the drive ends where it started.
    const hasLocatedStops = waypoints.length > 1;
    if (hasLocatedStops) waypoints.push(origin);

    const routed = hasLocatedStops ? await routeDrive(waypoints) : null;

    let returnMiles = 0;
    let totalMiles = 0;
    let totalMinutes = null;

    if (routed) {
      // Leg N is the drive into waypoint N+1, so the leading legs land on the
      // located stops in order and the last one is the run home.
      waypointStopIndex.forEach((stopIndex, legIndex) => {
        stops[stopIndex].legMiles = routed.legMiles[legIndex];
        stops[stopIndex].legMinutes = routed.legMinutes[legIndex];
      });
      returnMiles = routed.legMiles[routed.legMiles.length - 1];
      totalMiles = routed.totalMiles;
      totalMinutes = routed.totalMinutes;
    } else {
      let previous = origin;
      waypointStopIndex.forEach((stopIndex) => {
        const stop = stops[stopIndex];
        const point = { latitude: stop.latitude, longitude: stop.longitude };
        stop.legMiles = roundTenth(haversineMiles(previous, point) * ROAD_FACTOR);
        totalMiles += stop.legMiles;
        previous = point;
      });
      returnMiles = hasLocatedStops
        ? roundTenth(haversineMiles(previous, origin) * ROAD_FACTOR)
        : 0;
      totalMiles = roundTenth(totalMiles + returnMiles);
    }

    res.status(200).json({
      success: true,
      data: {
        date: requestedDate,
        available: true,
        // "osrm" means these are real road distances measured along the
        // geometry below. "estimate" means straight-line distance with a
        // winding factor and no geometry — the page must not claim a routed
        // drive in that case.
        provider: routed ? "osrm" : "estimate",
        routed: Boolean(routed),
        geometry: routed ? routed.geometry : null,
        origin: { ...origin, label: "Humphries & Parks" },
        stops,
        returnMiles,
        totalMiles,
        totalMinutes,
      },
    });
  } catch (error) {
    console.error("Delivery route map failed:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Unable to build the route map",
    });
  }
}

export default withRoleGuard(handler, { allow: DELIVERY_DIARY_ROLES });
