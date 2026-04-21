// file location: src/pages/api/location/drive-time.js
// Drive-time lookup between a UK postcode and the Humphries & Parks origin.
//
// Response contract (always JSON, HTTP 200 on expected outcomes, 4xx/5xx on
// hard failures):
//
//   {
//     status: "ok" | "unavailable" | "error",
//     minutes?: number,              // drive time in minutes when status==="ok"
//     distanceMiles?: number,        // straight-line distance when known
//     estimated?: boolean,           // true when derived from a heuristic, false when a routing provider supplied it
//     provider?: "google" | "estimate",
//     origin?: { postcode, latitude, longitude },
//     destination?: { postcode, latitude, longitude },
//     detail?: string                // human-readable explanation, used by the UI when status !== "ok"
//   }
//
// Strategy:
//   1. Validate the destination postcode, look up both postcodes via
//      postcodes.io (free, no key, UK-only).
//   2. If GOOGLE_MAPS_API_KEY is configured, ask the Google Distance Matrix
//      API for a real driving time. This is the authoritative answer.
//   3. Otherwise fall back to a calibrated estimate based on great-circle
//      distance, a road-winding factor, and an average UK driving speed.
//      The response flags estimated: true so the UI can make it obvious.
//
// The endpoint is role-guarded to match the rest of the API surface — only
// signed-in users can trigger outbound lookups, which prevents drive-by
// abuse of any configured Google quota.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  MAX_DRIVE_TIME_MINUTES,
  HNP_ORIGIN_POSTCODE_DEFAULT,
} from "@/lib/mobileMechanic/config";

// Conservative UK-road heuristic used when no routing provider is configured.
// DRIVE_FACTOR accounts for road winding vs. straight-line distance.
// AVG_MPH is the blended average speed for the kind of Kent/Surrey suburban
// + A-road mix around West Malling — deliberately on the low side so the
// estimate doesn't under-count minutes and let ineligible jobs slip through.
const DRIVE_FACTOR = 1.35;
const AVG_MPH = 35;

const METRES_PER_MILE = 1609.344;

// Great-circle distance in miles using the haversine formula.
function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.7613; // Earth radius in miles
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// postcodes.io returns 200 with { result: { longitude, latitude, postcode } }.
// A 404 means the postcode isn't recognised. Anything else is a hard error.
async function lookupPostcode(postcode) {
  const trimmed = String(postcode || "").trim();
  if (!trimmed) return { ok: false, reason: "missing" };

  // postcodes.io accepts the postcode un-normalised but trim whitespace for
  // the URL. The API itself is case-insensitive and tolerant of spacing.
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`;
  let res;
  try {
    res = await fetch(url, { headers: { accept: "application/json" } });
  } catch (err) {
    return { ok: false, reason: "network", detail: err?.message || "network error" };
  }

  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "upstream", detail: `postcodes.io ${res.status}` };

  const payload = await res.json().catch(() => null);
  const result = payload?.result;
  if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
    return { ok: false, reason: "invalid_payload" };
  }
  return {
    ok: true,
    postcode: result.postcode || trimmed.toUpperCase(),
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

// Google Distance Matrix API — driving mode, metric units (metres+seconds).
// Only called when GOOGLE_MAPS_API_KEY is present in the env. Errors are
// returned so the caller can decide whether to fall back to the estimator.
async function queryGoogleDistanceMatrix({ origin, destination, apiKey }) {
  const params = new URLSearchParams({
    origins: `${origin.latitude},${origin.longitude}`,
    destinations: `${destination.latitude},${destination.longitude}`,
    mode: "driving",
    units: "imperial",
    key: apiKey,
  });
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    return { ok: false, reason: "upstream", detail: `google ${res.status}` };
  }
  const payload = await res.json().catch(() => null);
  const element = payload?.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return { ok: false, reason: "upstream", detail: `google element ${element?.status || "unknown"}` };
  }
  const seconds = element.duration?.value;
  const metres = element.distance?.value;
  if (typeof seconds !== "number") {
    return { ok: false, reason: "upstream", detail: "no duration in response" };
  }
  return {
    ok: true,
    minutes: seconds / 60,
    distanceMiles: typeof metres === "number" ? metres / METRES_PER_MILE : undefined,
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ status: "error", detail: "Method not allowed" });
  }

  const destinationPostcode = String(req.body?.destinationPostcode || "").trim();
  if (!destinationPostcode) {
    return res.status(200).json({
      status: "unavailable",
      detail: "No postcode provided",
    });
  }

  const originPostcode =
    String(req.body?.originPostcode || "").trim() ||
    process.env.HNP_ORIGIN_POSTCODE ||
    HNP_ORIGIN_POSTCODE_DEFAULT;

  // 1) Geocode both postcodes in parallel — they're independent lookups.
  const [origin, destination] = await Promise.all([
    lookupPostcode(originPostcode),
    lookupPostcode(destinationPostcode),
  ]);

  if (!origin.ok) {
    // Origin lookup should always succeed — if it doesn't, surface a 500 so
    // an ops engineer notices. The destination failing is a user problem.
    return res.status(500).json({
      status: "error",
      detail: `Origin postcode lookup failed (${origin.reason})`,
    });
  }

  if (!destination.ok) {
    return res.status(200).json({
      status: "unavailable",
      detail:
        destination.reason === "not_found"
          ? "Postcode not recognised"
          : "Could not look up this postcode",
      origin: { postcode: origin.postcode, latitude: origin.latitude, longitude: origin.longitude },
    });
  }

  const distanceMiles = haversineMiles(origin, destination);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 2) Preferred path: Google routing when a key is configured.
  if (apiKey) {
    const google = await queryGoogleDistanceMatrix({ origin, destination, apiKey });
    if (google.ok) {
      return res.status(200).json({
        status: "ok",
        minutes: google.minutes,
        distanceMiles: google.distanceMiles ?? distanceMiles,
        estimated: false,
        provider: "google",
        origin: { postcode: origin.postcode, latitude: origin.latitude, longitude: origin.longitude },
        destination: {
          postcode: destination.postcode,
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        limitMinutes: MAX_DRIVE_TIME_MINUTES,
      });
    }
    // Fall through to the estimator when Google fails — we'd rather show an
    // honest estimate than nothing at all.
    console.warn("[drive-time] Google Distance Matrix failed:", google.detail);
  }

  // 3) Fallback: heuristic estimate from great-circle distance.
  const estimatedMinutes = (distanceMiles * DRIVE_FACTOR) / AVG_MPH * 60;
  return res.status(200).json({
    status: "ok",
    minutes: estimatedMinutes,
    distanceMiles,
    estimated: true,
    provider: "estimate",
    origin: { postcode: origin.postcode, latitude: origin.latitude, longitude: origin.longitude },
    destination: {
      postcode: destination.postcode,
      latitude: destination.latitude,
      longitude: destination.longitude,
    },
    limitMinutes: MAX_DRIVE_TIME_MINUTES,
  });
}

// Any signed-in user on the create page can trigger a lookup — no special
// role needed, the sensitive data (customer address) is already on their
// screen. withRoleGuard still enforces authentication; an empty `allow`
// list with no authorize function lets every signed-in user through.
export default withRoleGuard(handler);
