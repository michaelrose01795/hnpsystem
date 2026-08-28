// file location: src/pages/api/parts/delivery-diary/route-map.js
//
// Geocodes the stops on one day's route so the page can plot them.
//
// There is no mapping library or tile provider in this project, and the brief
// is explicit that no paid API may be introduced. This route therefore reuses
// exactly what /api/location/drive-time already relies on — postcodes.io, free
// and key-less — via its bulk endpoint, and returns plain coordinates plus
// straight-line leg distances. The page draws a schematic route from those and
// hides the panel entirely when geocoding is unavailable.
//
// The shape returned is deliberately provider-neutral: swapping in a real
// routing provider later means changing this file only.

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
const ROAD_FACTOR = 1.35;

const normaliseKey = (postcode) => String(postcode || "").toUpperCase().replace(/\s+/g, "");

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

    const stops = [];
    let previous = origin;
    let totalMiles = 0;

    deliveries.forEach((delivery, index) => {
      const point = geocoded.get(normaliseKey(delivery.postcodeValue));
      if (!point) {
        stops.push({
          id: delivery.id,
          stopNumber: index + 1,
          located: false,
          label: delivery.customerDisplayName || delivery.customer_name || "Stop",
          postcode: delivery.postcodeValue || null,
          status: delivery.status,
        });
        return;
      }
      const legMiles = Math.round(haversineMiles(previous, point) * ROAD_FACTOR * 10) / 10;
      totalMiles += legMiles;
      previous = point;
      stops.push({
        id: delivery.id,
        stopNumber: index + 1,
        located: true,
        label: delivery.customerDisplayName || delivery.customer_name || "Stop",
        postcode: point.postcode,
        latitude: point.latitude,
        longitude: point.longitude,
        legMiles,
        status: delivery.status,
        isUrgent: Boolean(delivery.is_urgent),
      });
    });

    // Return leg — the van comes back to the parts desk.
    const returnMiles =
      previous === origin
        ? 0
        : Math.round(haversineMiles(previous, origin) * ROAD_FACTOR * 10) / 10;
    totalMiles = Math.round((totalMiles + returnMiles) * 10) / 10;

    res.status(200).json({
      success: true,
      data: {
        date: requestedDate,
        available: true,
        // "estimate" is honest about what these numbers are: straight-line
        // distance with a road-winding factor, not a routed drive.
        provider: "estimate",
        origin: { ...origin, label: "Humphries & Parks" },
        stops,
        returnMiles,
        totalMiles,
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
