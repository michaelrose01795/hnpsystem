// file location: src/lib/mobileMechanic/eligibility.js
// Pure rules engine for Mobile Mechanic eligibility.
//
// Given the data already captured on /job-cards/create (customer,
// vehicle, detected job types, and the result of a drive-time lookup),
// this module produces a deterministic eligibility verdict broken down
// rule-by-rule so the UI can display *why* a job does or doesn't qualify.
//
// Design notes:
//   - No React, no fetch, no side effects — makes it trivially unit-testable.
//   - Each rule returns one of three states:
//       ok: true   → rule satisfied
//       ok: false  → rule not satisfied (reason shown to user)
//       ok: null   → cannot evaluate yet (missing data); UI shows "pending"
//   - The overall job is "eligible" only when every rule is ok: true.

import {
  MAX_DRIVE_TIME_MINUTES,
  MAX_VEHICLE_AGE_YEARS,
  ELIGIBLE_MAKES,
  SERVICE_JOB_TYPES,
} from "./config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Normalise a make string for comparison against ELIGIBLE_MAKES.
const normaliseMake = (value = "") =>
  String(value || "")
    .toLowerCase()
    .trim();

// Resolve a "manufacture year" from the several shapes we accept. Callers may
// pass a plain number, a string, or a raw vehicle record with year /
// year_of_manufacture / yearOfManufacture fields.
const extractYear = (vehicle = {}) => {
  const candidates = [
    vehicle.year,
    vehicle.yearOfManufacture,
    vehicle.year_of_manufacture,
    vehicle.manufactureYear,
    vehicle.manufacture_year,
  ];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 1900 && numeric < 2100) {
      return Math.trunc(numeric);
    }
  }
  return null;
};

// Resolve a make from either an explicit `make` field or the combined
// `makeModel` label the create page stores.
const extractMake = (vehicle = {}) => {
  if (vehicle.make && String(vehicle.make).trim()) return String(vehicle.make).trim();
  const combined = String(vehicle.makeModel || vehicle.make_model || "").trim();
  if (!combined) return "";
  // Take the first whitespace-separated token as the make (e.g. "Suzuki Swift" → "Suzuki").
  return combined.split(/\s+/)[0] || "";
};

// ---------------------------------------------------------------------------
// Individual rule evaluators
// ---------------------------------------------------------------------------

// Drive time rule. `driveTime` is the shape returned by /api/location/drive-time
// (or null if not yet fetched). See the API route for the contract.
const evaluateDriveTimeRule = (driveTime) => {
  if (!driveTime || driveTime.status === "pending") {
    return {
      id: "location",
      label: `Within ${MAX_DRIVE_TIME_MINUTES} min drive of West Malling`,
      ok: null,
      detail: "Checking drive time…",
    };
  }
  if (driveTime.status === "unavailable") {
    return {
      id: "location",
      label: `Within ${MAX_DRIVE_TIME_MINUTES} min drive of West Malling`,
      ok: null,
      detail: driveTime.detail || "Enter a valid UK postcode to check drive time",
    };
  }
  if (driveTime.status !== "ok" || typeof driveTime.minutes !== "number") {
    return {
      id: "location",
      label: `Within ${MAX_DRIVE_TIME_MINUTES} min drive of West Malling`,
      ok: null,
      detail: driveTime.detail || "Drive time lookup failed",
    };
  }

  const minutes = Math.round(driveTime.minutes);
  const ok = minutes <= MAX_DRIVE_TIME_MINUTES;
  // "~" prefix when the value is an estimate (no routing provider configured).
  const prefix = driveTime.estimated ? "~" : "";
  const distancePart =
    typeof driveTime.distanceMiles === "number"
      ? ` · ${driveTime.distanceMiles.toFixed(1)} mi`
      : "";
  const estimatedPart = driveTime.estimated ? " · estimated" : "";
  return {
    id: "location",
    label: `Within ${MAX_DRIVE_TIME_MINUTES} min drive of West Malling`,
    ok,
    detail: `${prefix}${minutes} min${distancePart}${estimatedPart}`,
  };
};

// Vehicle age rule. Compares the current year to the year of manufacture.
// "3 years or newer" is interpreted as: current year - manufacture year ≤ 3.
const evaluateVehicleAgeRule = (vehicle = {}) => {
  const year = extractYear(vehicle);
  if (!year) {
    return {
      id: "vehicle_age",
      label: `Vehicle is ${MAX_VEHICLE_AGE_YEARS} years old or newer`,
      ok: null,
      detail: "Vehicle year not available yet",
    };
  }
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  const ok = age >= 0 && age <= MAX_VEHICLE_AGE_YEARS;
  return {
    id: "vehicle_age",
    label: `Vehicle is ${MAX_VEHICLE_AGE_YEARS} years old or newer`,
    ok,
    detail: `${year} · ${age < 0 ? "future year" : `${age} yr${age === 1 ? "" : "s"} old`}`,
  };
};

// Make rule — vehicle make must be in the eligible list (currently "Suzuki").
const evaluateMakeRule = (vehicle = {}) => {
  const make = extractMake(vehicle);
  if (!make) {
    return {
      id: "make",
      label: "Vehicle make is Suzuki",
      ok: null,
      detail: "Vehicle make not available yet",
    };
  }
  const ok = ELIGIBLE_MAKES.includes(normaliseMake(make));
  return {
    id: "make",
    label: "Vehicle make is Suzuki",
    ok,
    detail: make,
  };
};

// Service-job rule. Accepts either the detection objects from
// jobTypeDetection.js or a raw jobCategories array.
const evaluateServiceRule = ({ jobDetections = [], jobCategories = [] } = {}) => {
  const hasDetections = Array.isArray(jobDetections) && jobDetections.length > 0;
  const hasCategories = Array.isArray(jobCategories) && jobCategories.length > 0;

  if (!hasDetections && !hasCategories) {
    return {
      id: "service",
      label: "Job is a service",
      ok: null,
      detail: "No request entered yet",
    };
  }

  const detectedTypes = new Set(
    [
      ...jobDetections.map((d) => String(d?.jobType || "").toUpperCase()),
      ...jobCategories.map((c) => String(c || "").toUpperCase()),
    ].filter(Boolean)
  );

  const matched = SERVICE_JOB_TYPES.find((type) => detectedTypes.has(type));
  if (matched) {
    return {
      id: "service",
      label: "Job is a service",
      ok: true,
      detail: `Detected: ${matched}`,
    };
  }

  // If we have detections but none are a service, surface what we saw so the
  // advisor understands why the job didn't qualify.
  const firstOther = [...detectedTypes][0];
  return {
    id: "service",
    label: "Job is a service",
    ok: false,
    detail: firstOther ? `Detected: ${firstOther}` : "Not detected as a service",
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate every Mobile Mechanic eligibility rule and return a structured verdict.
 *
 * @param {object} params
 * @param {object} params.customer       { address, postcode, ... } (postcode is the key field)
 * @param {object} params.vehicle        { make?, makeModel?, year?, ... }
 * @param {Array}  params.jobDetections  output of detectJobTypesForRequests()
 * @param {Array}  params.jobCategories  fallback list of job type strings
 * @param {object} params.driveTime      output of /api/location/drive-time or null
 * @returns {{ eligible: boolean, status: "eligible"|"ineligible"|"pending", rules: Array }}
 */
export function evaluateMobileMechanicEligibility({
  customer = {},
  vehicle = {},
  jobDetections = [],
  jobCategories = [],
  driveTime = null,
} = {}) {
  const rules = [
    evaluateDriveTimeRule(driveTime),
    evaluateVehicleAgeRule(vehicle),
    evaluateMakeRule(vehicle),
    evaluateServiceRule({ jobDetections, jobCategories }),
  ];

  const anyUnknown = rules.some((r) => r.ok === null);
  const allTrue = rules.every((r) => r.ok === true);

  // Status drives the UI shell:
  //   eligible    → every rule passed, Yes/No is enabled
  //   ineligible  → at least one rule failed outright
  //   pending     → we're still waiting on data (e.g. drive-time lookup)
  let status = "ineligible";
  if (allTrue) status = "eligible";
  else if (anyUnknown && !rules.some((r) => r.ok === false)) status = "pending";

  return {
    eligible: allTrue,
    status,
    rules,
    // Expose the postcode used so the UI can mention it in help text.
    destinationPostcode: customer?.postcode || "",
  };
}

// Exported for unit tests / debugging.
export const __internals = {
  extractYear,
  extractMake,
  evaluateDriveTimeRule,
  evaluateVehicleAgeRule,
  evaluateMakeRule,
  evaluateServiceRule,
};
