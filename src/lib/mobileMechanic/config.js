// file location: src/lib/mobileMechanic/config.js
// Single source of truth for Mobile Mechanic eligibility tuning.
//
// Values here drive both the rules engine (eligibility.js) and the drive-time
// API route. Change a threshold here and everywhere picks it up — do not
// duplicate these numbers in page/component code.
//
// The origin postcode can be overridden at runtime via the
// HNP_ORIGIN_POSTCODE environment variable so the value stays configurable
// without a code change (e.g. if H&P move site or add a second depot).

/** Default origin postcode for Humphries & Parks, West Malling.
 *  Override with HNP_ORIGIN_POSTCODE in the environment if needed. */
export const HNP_ORIGIN_POSTCODE_DEFAULT = "ME19 4NY";

/** Resolve the live origin postcode (server OR browser safe). */
export const getOriginPostcode = () => {
  // Server-side: use the env var when present.
  if (typeof process !== "undefined" && process.env?.HNP_ORIGIN_POSTCODE) {
    return process.env.HNP_ORIGIN_POSTCODE;
  }
  // Browser bundle: fall back to the compile-time default. The API route
  // never needs the browser value — the client just passes the destination
  // postcode and lets the server use its own env var.
  return HNP_ORIGIN_POSTCODE_DEFAULT;
};

/** Hard limit on drive time for mobile mechanic eligibility, in minutes. */
export const MAX_DRIVE_TIME_MINUTES = 40;

/** Maximum vehicle age (in whole years) that still qualifies. */
export const MAX_VEHICLE_AGE_YEARS = 3;

/** Vehicle makes that qualify for mobile mechanic service.
 *  Lower-case, trimmed comparison — keep entries lower-case here. */
export const ELIGIBLE_MAKES = ["suzuki"];

/** Job types (from jobTypeDetection.js) that qualify as "service". */
export const SERVICE_JOB_TYPES = ["SERVICE"];
