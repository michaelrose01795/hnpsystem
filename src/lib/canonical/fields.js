// file location: src/lib/canonical/fields.js
//
// Canonical-field helpers for the three duplicated data-source pairs:
//
//   1. jobs.requests  (JSON blob)  vs  job_requests (normalised table)
//   2. vehicles.registration       vs  vehicles.reg_number
//   3. jobs.milage (typo)          vs  vehicles.mileage
//
// Every helper is a pure, synchronous function.  They never hit the
// database — they simply read the right field from an already-loaded
// row/object and return a single canonical value.
//
// Old columns are still written (dual-write) so nothing breaks.
// Old columns are still accepted on reads (fallback) so nothing breaks.

/* =====================================================
   1.  REQUESTS  — canonical source: job_requests table
   ===================================================== */

/**
 * Return the canonical request array from a job row / jobData object.
 *
 * Preference order:
 *   1. job.job_requests  (normalised rows from the table)
 *   2. job.jobRequests   (camelCase alias used by some hooks)
 *   3. job.requests      (legacy JSON snapshot)
 *
 * If the legacy column is a JSON string it is parsed safely.
 *
 * @param {object} job — any object that may carry request data
 * @returns {Array} — always an array (never null / undefined)
 */
export const getJobRequests = (job) => {
  if (!job) return [];

  // 1. Normalised table rows (preferred)
  if (Array.isArray(job.job_requests) && job.job_requests.length > 0) {
    return job.job_requests;
  }

  // 2. camelCase alias (some hooks)
  if (Array.isArray(job.jobRequests) && job.jobRequests.length > 0) {
    return job.jobRequests;
  }

  // 3. Legacy JSON snapshot
  return normalizeLegacyRequests(job.requests);
};

/**
 * Parse / normalise the legacy `jobs.requests` column.
 * Safe against null, undefined, objects, and malformed JSON strings.
 *
 * @param {*} raw — value of `job.requests`
 * @returns {Array}
 */
export const normalizeLegacyRequests = (raw) => {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  if (raw && typeof raw === "object") return [];

  return [];
};

/**
 * Count requests from a job row regardless of which field is populated.
 *
 * @param {object} job
 * @returns {number}
 */
export const getJobRequestsCount = (job) => getJobRequests(job).length;

/* =====================================================
   2.  REGISTRATION — canonical source: vehicles.registration
   ===================================================== */

/**
 * Read the canonical registration string from a vehicle row.
 *
 * Preference: registration > reg_number > reg (shorthand alias).
 * Always returns UPPERCASE trimmed string, or fallback.
 *
 * @param {object} vehicle — any object with registration-like fields
 * @param {string} [fallback=""] — returned when nothing is found
 * @returns {string}
 */
export const getVehicleRegistration = (vehicle, fallback = "") => {
  if (!vehicle) return fallback;

  const raw =
    vehicle.registration ||
    vehicle.reg_number ||
    vehicle.reg ||
    vehicle.registration_number ||
    "";

  const trimmed = typeof raw === "string" ? raw.trim() : String(raw).trim();
  return trimmed ? trimmed.toUpperCase() : fallback;
};

/**
 * Build the write-payload for a vehicle registration.
 * Returns BOTH columns so old readers keep working.
 *
 * @param {string} regNumber
 * @returns {{ registration: string, reg_number: string }}
 */
export const buildRegistrationWriteFields = (regNumber) => {
  const canonical = (regNumber || "").trim().toUpperCase();
  return {
    registration: canonical,   // canonical (new)
    reg_number: canonical,     // legacy   (kept for compatibility)
  };
};

/* =====================================================
   3.  MILEAGE — canonical source: vehicles.mileage
   ===================================================== */

/**
 * Pick the first truthy mileage value from a variable-length argument list.
 *
 * This is the shared version of the `pickMileageValue` utility that was
 * previously defined inline in [jobNumber].js.  It skips null, undefined,
 * and empty-string values.
 *
 * @param  {...*} values — candidates in priority order
 * @returns {number|string|null}
 */
export const pickMileageValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

/**
 * Resolve the "best available" mileage from a job row that may carry
 * vehicle-level mileage AND the legacy per-job snapshot (typo column).
 *
 * Preference:
 *   1. vehicle.mileage   (canonical, on the vehicle)
 *   2. job.mileage       (normalised alias some formatters set)
 *   3. job.milage        (legacy typo column on jobs table)
 *
 * @param {object} job — jobData / formatted job row
 * @param {object} [vehicle] — optional vehicle row (if loaded separately)
 * @returns {number|string|null}
 */
export const getResolvedMileage = (job, vehicle) => {
  return pickMileageValue(
    vehicle?.mileage,
    job?.vehicle?.mileage,
    job?.mileage,
    job?.milage
  );
};

/**
 * Build the dual-write payload for the jobs table `milage` column.
 * This keeps the legacy column populated so old readers still work.
 *
 * @param {number|string|null} mileageValue
 * @returns {{ milage: number|null }}
 */
export const buildJobMileageWriteFields = (mileageValue) => {
  if (mileageValue === null || mileageValue === undefined || mileageValue === "") {
    return { milage: null };
  }
  const parsed = Number(mileageValue);
  return { milage: Number.isFinite(parsed) ? parsed : null };
};

/**
 * Build the write payload for the vehicles table `mileage` column.
 *
 * @param {number|string|null} mileageValue
 * @returns {{ mileage: number|null }}
 */
export const buildVehicleMileageWriteFields = (mileageValue) => {
  if (mileageValue === null || mileageValue === undefined || mileageValue === "") {
    return { mileage: null };
  }
  const parsed = Number(mileageValue);
  return { mileage: Number.isFinite(parsed) ? parsed : null };
};

/* =====================================================
   DEFAULT EXPORT  — convenient object for destructuring
   ===================================================== */
export default {
  // requests
  getJobRequests,
  normalizeLegacyRequests,
  getJobRequestsCount,
  // registration
  getVehicleRegistration,
  buildRegistrationWriteFields,
  // mileage
  pickMileageValue,
  getResolvedMileage,
  buildJobMileageWriteFields,
  buildVehicleMileageWriteFields,
};
