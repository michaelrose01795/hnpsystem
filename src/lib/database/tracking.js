// file location: src/lib/database/tracking.js
import { getDatabaseClient } from "@/lib/database/client"; // import supabase service client
import { apiRequest } from "@/lib/api/client";
import { getAutoMovementRule } from "@/lib/tracking/autoMovement"; // shared rule table (client + server)
import { logFailure } from "@/lib/utils/logFailure";

const supabase = getDatabaseClient(); // create singleton client

const normaliseDateKey = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const toNullableInteger = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const sameNullableInteger = (left, right) => toNullableInteger(left) === toNullableInteger(right);

// Fuel is stored on a 0–8 scale (Empty … Full in eighths), matching the
// eight-segment FuelGauge and the tracking_loan_cars_fuel_level_check constraint.
const normalizeFuelLevel = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(8, Math.max(0, Math.round(parsed)));
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const normalizeLoanCar = (row) => ({
  id: row.loan_car_id,
  loanCarId: row.loan_car_id,
  reg: row.reg || "",
  name: row.name || row.reg || "Loan car",
  makeModel: row.make_model || "",
  colour: row.colour || "",
  mileage: row.mileage ?? "",
  fuelLevel: normalizeFuelLevel(row.fuel_level),
  status: row.status || "active",
  sortOrder: row.sort_order ?? 0,
  notes: row.notes || "",
  lastVehicleUpdateAt: row.last_vehicle_update_at || row.updated_at || "",
});

const normalizeLoanCarFuelHistory = (row) => ({
  id: row.history_id,
  historyId: row.history_id,
  loanCarId: row.loan_car_id,
  reg: row.reg || "",
  fuelLevel: normalizeFuelLevel(row.fuel_level),
  mileage: row.mileage ?? "",
  recordedAt: row.recorded_at || "",
});

const normalizeLoanCarBooking = (row) => ({
  id: row.booking_id,
  bookingId: row.booking_id,
  loanCarId: row.loan_car_id,
  date: row.start_date,
  startDate: row.start_date,
  endDate: row.end_date,
  jobId: row.job_id || null,
  jobNumber: row.job_number || "",
  customer: row.customer_name || "",
  customerName: row.customer_name || "",
  customerEmail: row.customer_email || "",
  customerPhone: row.customer_phone || "",
  customerAddress: row.customer_address || "",
  customerPostcode: row.customer_postcode || "",
  reg: row.vehicle_reg || "",
  vehicleReg: row.vehicle_reg || "",
  vehicleMakeModel: row.vehicle_make_model || "",
  mileage: row.mileage || "",
  insuranceProvider: row.insurance_provider || "",
  insurancePolicyNumber: row.insurance_policy_number || "",
  licenceNumber: row.licence_number || "",
  dateOfBirth: row.date_of_birth || "",
  notes: row.notes || "",
});

const loanCarPayload = (car) => ({
  reg: String(car.reg || "").trim().toUpperCase(),
  name: String(car.name || "").trim() || String(car.reg || "").trim().toUpperCase(),
  make_model: String(car.makeModel ?? car.make_model ?? "").trim() || null,
  colour: String(car.colour ?? "").trim() || null,
  mileage: toNullableInteger(car.mileage),
  fuel_level: normalizeFuelLevel(car.fuelLevel ?? car.fuel_level),
  last_vehicle_update_at:
    car.updateVehicleState || car.mileage !== undefined || car.fuelLevel !== undefined || car.makeModel !== undefined || car.colour !== undefined
      ? new Date().toISOString()
      : car.lastVehicleUpdateAt || null,
  status: car.status || "active",
  sort_order: Number(car.sortOrder ?? car.sort_order ?? 0),
  notes: car.notes || null,
});

const bookingPayload = (booking) => ({
  loan_car_id: booking.loanCarId,
  start_date: booking.startDate || booking.date,
  end_date: booking.endDate || booking.startDate || booking.date,
  job_id: booking.jobId || null,
  job_number: booking.jobNumber || null,
  customer_name: booking.customerName || booking.customer || null,
  customer_email: booking.customerEmail || null,
  customer_phone: booking.customerPhone || null,
  customer_address: booking.customerAddress || null,
  customer_postcode: booking.customerPostcode || null,
  vehicle_reg: booking.vehicleReg || booking.reg || null,
  vehicle_make_model: booking.vehicleMakeModel || null,
  mileage: toNullableInteger(booking.mileage),
  insurance_provider: booking.insuranceProvider || null,
  insurance_policy_number: booking.insurancePolicyNumber || null,
  licence_number: booking.licenceNumber || null,
  date_of_birth: booking.dateOfBirth || null,
  notes: booking.notes || null,
});

const loanCarBookingOverlapError = (booking = {}) => ({
  message: "This loan car already has a booking that overlaps those dates.",
  code: "loan_car_booking_overlap",
  conflictingBooking: booking,
});

const loanCarBookingDateError = () => ({
  message: "The booking end date must be the same as or after the start date.",
  code: "loan_car_booking_invalid_date_range",
});

const statusLabelForAction = (actionType) => {
  if (actionType === "job_checked_in") return "Awaiting Workshop";
  if (actionType === "vhc_complete") return "Awaiting Advisor";
  if (actionType === "job_complete") return "Ready For Collection";
  return "Ready For Collection";
};

const buildKeyActionLabel = (actionType, keyLocation) => {
  if (!keyLocation) return "Keys updated";
  if (actionType === "job_checked_in") return `Keys received – ${keyLocation}`;
  if (actionType === "location_update") return `Keys updated – ${keyLocation}`;
  return `Keys hung – ${keyLocation}`;
};

const buildKeyNotes = ({ jobNumber, vehicleReg, notes }) => {
  const parts = [];
  if (jobNumber) parts.push(`Job ${jobNumber}`);
  if (vehicleReg) parts.push(`Reg ${vehicleReg}`);
  if (notes) parts.push(notes);
  return parts.join(" • ");
};

const buildVehicleNotes = ({ notes }) => {
  return notes ? notes : null;
};

// Auto-movement de-duplication.
//
// /tracking subscribes to every `jobs` UPDATE and, when the new status matches an
// auto-movement rule, POSTs to /api/tracking/next-action. That runs in *every*
// browser with the page open, so a single status change produced one key event
// and one vehicle event per viewer — duplicate rows in the tracking timeline,
// each attributed to whichever staff member happened to have the tab open rather
// than to whoever changed the status.
//
// This collapses that burst to the first writer. The check is deliberately
// narrow: it is keyed on job + vehicle status + key action, so a genuinely
// different transition still writes, and it fails open — if the lookup errors we
// insert as before, because losing a tracking event is worse than duplicating
// one. It is scoped to the automatic path only (see `deduplicate` below); manual
// location updates and every other actionType are untouched.
const AUTO_MOVEMENT_DEDUPE_WINDOW_MS = 30000;

const hasMatchingRecentEvent = async ({ jobId, status, action }) => {
  if (!jobId) return false;
  const since = new Date(Date.now() - AUTO_MOVEMENT_DEDUPE_WINDOW_MS).toISOString();
  try {
    const [vehicleResult, keyResult] = await Promise.all([
      supabase
        .from("vehicle_tracking_events")
        .select("event_id")
        .eq("job_id", jobId)
        .eq("status", status)
        .gte("occurred_at", since)
        .limit(1),
      supabase
        .from("key_tracking_events")
        .select("key_event_id")
        .eq("job_id", jobId)
        .eq("action", action)
        .gte("occurred_at", since)
        .limit(1),
    ]);
    if (vehicleResult.error || keyResult.error) return false;
    // Both halves must already exist, otherwise a half-written burst would never
    // be completed.
    return (vehicleResult.data || []).length > 0 && (keyResult.data || []).length > 0;
  } catch {
    return false;
  }
};

export const logNextActionEvents = async ({
  actionType,
  jobId,
  jobNumber,
  vehicleId,
  vehicleReg,
  keyLocation,
  vehicleLocation,
  notes,
  performedBy,
  vehicleStatus,
  // Set by the automatic status-change path only. Every other caller keeps the
  // previous unconditional insert.
  deduplicate = false,
}) => {
  const keyPayload = {
    job_id: jobId || null,
    vehicle_id: vehicleId || null,
    action: buildKeyActionLabel(actionType, keyLocation),
    notes: buildKeyNotes({ jobNumber, vehicleReg, notes }),
    performed_by: performedBy || null,
  };

  const vehiclePayload = {
    job_id: jobId || null,
    vehicle_id: vehicleId || null,
    status: vehicleStatus || statusLabelForAction(actionType),
    location: vehicleLocation || null,
    notes: buildVehicleNotes({ notes }),
    created_by: performedBy || null,
  };

  if (deduplicate) {
    const alreadyLogged = await hasMatchingRecentEvent({
      jobId,
      status: vehiclePayload.status,
      action: keyPayload.action,
    });
    if (alreadyLogged) {
      // Another viewer's browser already wrote this movement. Report success so
      // the caller still refreshes its view — the data it needs is there.
      return { success: true, data: { keyEvent: null, vehicleEvent: null, deduplicated: true } };
    }
  }

  const [{ data: keyEvent, error: keyError }, { data: vehicleEvent, error: vehicleError }] = await Promise.all([
    supabase.from("key_tracking_events").insert(keyPayload).select().single(),
    supabase.from("vehicle_tracking_events").insert(vehiclePayload).select().single(),
  ]);

  if (keyError || vehicleError) {
    logFailure("Failed to log next action", keyError || vehicleError);
    return {
      success: false,
      error: keyError || vehicleError,
    };
  }

  return {
    success: true,
    data: {
      keyEvent,
      vehicleEvent,
    },
  };
};

// Automatic movement, owned by the status change itself.
//
// This is the replacement for the client-owned path described in
// src/lib/tracking/autoMovement.js. It is called from the code that performs the
// status change (`updateJob`, and /api/tracking/next-action for browser-side
// callers) rather than from a page's realtime subscription, so:
//
//   * the movement happens whether or not anybody has /tracking open; and
//   * `performedBy` is the member of staff who changed the status.
//
// It is non-blocking by contract: the caller must never fail a status change
// because a tracking event could not be written. Every exit path returns a
// result object and nothing throws.
//
// `deduplicate` is left on. The server-side duplicate protection was added to
// contain the old multi-viewer burst and is kept as a safety layer while both
// paths can theoretically fire (a legacy client, a status change routed through
// two chokepoints). It is keyed on job + vehicle status + key action inside a
// 30s window, so a genuinely different transition still writes.
// `jobs.status_updated_by` is a text column and carries sentinels such as
// "SYSTEM_CLOCKING" alongside real user ids. `performed_by` / `created_by` are
// integer FKs to public.users, so anything that is not a positive integer must
// become NULL rather than 0 — `toNullableInteger` above would map a
// digit-free sentinel to 0 and break the foreign key.
const toUserIdOrNull = (value) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const recordAutomaticMovementForStatus = async ({
  jobId,
  status,
  performedBy = null,
  job = null,
}) => {
  const rule = getAutoMovementRule(status);
  if (!rule || !jobId) return { success: true, data: { skipped: true } };

  try {
    let row = job;
    if (!row || row.vehicle_id === undefined || row.job_number === undefined) {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, job_number, vehicle_id, vehicle_reg")
        .eq("id", jobId)
        .maybeSingle();
      if (error) {
        logFailure("Auto movement: unable to read job", error);
        return { success: false, error };
      }
      row = data || {};
    }

    return await logNextActionEvents({
      actionType: "job_status_change",
      jobId,
      jobNumber: String(row.job_number || "").trim().toUpperCase(),
      vehicleId: row.vehicle_id || null,
      vehicleReg: String(row.vehicle_reg || "").trim().toUpperCase(),
      keyLocation: rule.keyLocation,
      vehicleLocation: rule.vehicleLocation,
      vehicleStatus: rule.vehicleStatus,
      notes: `Auto-sync from status "${status}"`,
      performedBy: toUserIdOrNull(performedBy),
      deduplicate: true,
    });
  } catch (error) {
    logFailure("Auto movement error", error);
    return { success: false, error };
  }
};

export const getLoanCarScheduleBookings = async ({ startDate, endDate } = {}) => {
  const { data, error } = await supabase
    .from("tracking_loan_car_bookings")
    .select("*")
    .lte("start_date", endDate || normaliseDateKey(new Date()))
    .gte("end_date", startDate || normaliseDateKey(new Date()))
    .order("start_date", { ascending: true });

  if (error) {
    logFailure("Failed to fetch loan car schedule bookings", error);
    return [];
  }

  return (data || []).map(normalizeLoanCarBooking);
};

export const getLoanCars = async () => {
  const { data, error } = await supabase
    .from("tracking_loan_cars")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("reg", { ascending: true });

  if (error) {
    logFailure("Failed to fetch loan cars", error);
    return [];
  }

  return (data || []).map(normalizeLoanCar);
};

export const getLoanCarFuelHistory = async (loanCarId, { limit = 50 } = {}) => {
  if (!loanCarId) return [];
  const { data, error } = await supabase
    .from("tracking_loan_car_fuel_history")
    .select("*")
    .eq("loan_car_id", loanCarId)
    .order("recorded_at", { ascending: false })
    .limit(limit);

  if (error) {
    logFailure("Failed to fetch loan car fuel history", error);
    return [];
  }

  return (data || []).map(normalizeLoanCarFuelHistory);
};

// Append-only fuel/mileage change log. Every genuine fuel OR mileage change
// inserts a NEW row — the row is never updated in place — so the History panel
// shows the full trail of readings, not just the latest value.
//
// De-dup is anchored to the single most-recent row, never a wall-clock window:
// we skip only when the latest row already holds this exact (fuel_level,
// mileage) pair. That absorbs the row written by the DB trigger
// (trg_log_loan_car_fuel_change, which fires on fuel_level changes) and any
// exact no-op, while *never* dropping a real change the way a time-window guard
// can when two edits land close together (e.g. 1/4 → 1/2 → 1/4).
export const recordLoanCarFuelHistorySnapshot = async ({
  loanCarId,
  reg,
  fuelLevel,
  mileage,
}) => {
  if (!loanCarId) {
    return { success: false, error: { message: "loanCarId is required" } };
  }

  const normalizedFuelLevel = normalizeFuelLevel(fuelLevel);
  const normalizedMileage = toNullableInteger(mileage);

  const { data: latestRows, error: latestError } = await supabase
    .from("tracking_loan_car_fuel_history")
    .select("fuel_level, mileage")
    .eq("loan_car_id", loanCarId)
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (latestError) {
    logFailure("Failed to check latest loan car fuel history", latestError);
    return { success: false, error: latestError };
  }

  const latest = latestRows?.[0];
  if (
    latest &&
    normalizeFuelLevel(latest.fuel_level) === normalizedFuelLevel &&
    sameNullableInteger(latest.mileage, normalizedMileage)
  ) {
    return { success: true, skipped: true };
  }

  const { error: historyError } = await supabase
    .from("tracking_loan_car_fuel_history")
    .insert({
      loan_car_id: loanCarId,
      reg,
      fuel_level: normalizedFuelLevel,
      mileage: normalizedMileage,
    });

  if (historyError) {
    logFailure("Failed to save loan car fuel history", historyError);
    return { success: false, error: historyError };
  }

  return { success: true };
};

export const saveLoanCar = async (car) => {
  const payload = loanCarPayload(car);
  const loanCarId = car.loanCarId || car.id;
  const hasFuelUpdate = hasOwn(car, "fuelLevel") || hasOwn(car, "fuel_level");
  const hasMileageUpdate = hasOwn(car, "mileage");
  const nextFuelLevel = normalizeFuelLevel(car.fuelLevel ?? car.fuel_level);
  const nextMileage = toNullableInteger(car.mileage);
  let previousFuelLevel = null;
  let previousMileage = null;

  if (loanCarId && (hasFuelUpdate || hasMileageUpdate)) {
    const { data: existingCar, error: existingError } = await supabase
      .from("tracking_loan_cars")
      .select("fuel_level, mileage")
      .eq("loan_car_id", loanCarId)
      .maybeSingle();

    if (existingError) {
      logFailure("Failed to check current loan car fuel level", existingError);
      return { success: false, error: existingError };
    }

    previousFuelLevel = normalizeFuelLevel(existingCar?.fuel_level);
    previousMileage = toNullableInteger(existingCar?.mileage);
  }

  const query = loanCarId
    ? supabase.from("tracking_loan_cars").update(payload).eq("loan_car_id", loanCarId)
    : supabase.from("tracking_loan_cars").insert(payload);
  const { data, error } = await query.select().single();

  if (error) {
    logFailure("Failed to save loan car", error);
    return { success: false, error };
  }

  const savedCarId = data?.loan_car_id;
  const fuelChanged = hasFuelUpdate && (!loanCarId || previousFuelLevel !== nextFuelLevel);
  const mileageChanged = hasMileageUpdate && (!loanCarId || previousMileage !== nextMileage);

  if (savedCarId && (fuelChanged || mileageChanged)) {
    const historyPayload = {
      loanCarId: savedCarId,
      reg: data.reg,
      fuelLevel: nextFuelLevel,
      mileage: data.mileage,
    };

    let historyResult;
    try {
      historyResult = typeof window === "undefined"
        ? await recordLoanCarFuelHistorySnapshot(historyPayload)
        : await apiRequest("/api/tracking/loan-car-fuel-history", {
            method: "POST",
            body: historyPayload,
          });
    } catch (historyError) {
      return {
        success: false,
        error: { message: historyError.message || "Failed to save loan car fuel history." },
      };
    }

    if (!historyResult?.success) {
      return {
        success: false,
        error: historyResult?.error || { message: historyResult?.message || "Failed to save loan car fuel history." },
      };
    }
  }

  return { success: true, data: normalizeLoanCar(data) };
};

export const deleteLoanCar = async (loanCarId) => {
  const { error } = await supabase.from("tracking_loan_cars").delete().eq("loan_car_id", loanCarId);
  if (error) {
    logFailure("Failed to delete loan car", error);
    return { success: false, error };
  }
  return { success: true };
};

export const saveLoanCarBooking = async (booking) => {
  const payload = bookingPayload(booking);
  const bookingId = booking.bookingId || booking.id;
  const startDate = normaliseDateKey(payload.start_date);
  const endDate = normaliseDateKey(payload.end_date);

  if (startDate && endDate && endDate < startDate) {
    return { success: false, error: loanCarBookingDateError() };
  }

  let overlapQuery = supabase
    .from("tracking_loan_car_bookings")
    .select("booking_id, start_date, end_date, job_number, customer_name, vehicle_reg")
    .eq("loan_car_id", payload.loan_car_id)
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if (bookingId) {
    overlapQuery = overlapQuery.neq("booking_id", bookingId);
  }

  const { data: overlappingBookings, error: overlapError } = await overlapQuery;

  if (overlapError) {
    logFailure("Failed to check loan car booking overlap", overlapError);
    return { success: false, error: overlapError };
  }

  if ((overlappingBookings || []).length > 0) {
    return {
      success: false,
      error: loanCarBookingOverlapError(normalizeLoanCarBooking(overlappingBookings[0])),
    };
  }

  const query = booking.bookingId || booking.id
    ? supabase.from("tracking_loan_car_bookings").update(payload).eq("booking_id", bookingId)
    : supabase.from("tracking_loan_car_bookings").insert(payload);
  const { data, error } = await query.select().single();

  if (error) {
    logFailure("Failed to save loan car booking", error);
    return { success: false, error };
  }

  return { success: true, data: normalizeLoanCarBooking(data) };
};

export const deleteLoanCarBooking = async (bookingId) => {
  const { error } = await supabase.from("tracking_loan_car_bookings").delete().eq("booking_id", bookingId);
  if (error) {
    logFailure("Failed to delete loan car booking", error);
    return { success: false, error };
  }
  return { success: true };
};

export const searchLoanCarBookingTargets = async (searchTerm) => {
  const term = String(searchTerm || "").trim();
  if (term.length < 2) return [];

  const escaped = term.replace(/[%_,()]/g, "");
  const { data, error } = await supabase
    .from("jobs")
    .select(`
      id,
      job_number,
      customer,
      vehicle_reg,
      vehicle_make_model,
      milage,
      waiting_status,
      customer_ref:customer_id(
        firstname,
        lastname,
        email,
        mobile,
        telephone,
        address,
        postcode
      ),
      vehicle:vehicle_id(
        registration,
        reg_number,
        make,
        model,
        make_model,
        mileage,
        insurance_provider,
        insurance_policy_number
      )
    `)
    .or(`job_number.ilike.%${escaped}%,vehicle_reg.ilike.%${escaped}%,customer.ilike.%${escaped}%`)
    .order("updated_at", { ascending: false })
    .limit(12);

  if (error) {
    logFailure("Failed to search loan car booking targets", error);
    return [];
  }

  return (data || []).map((job) => {
    const customer = job.customer_ref || {};
    const vehicle = job.vehicle || {};
    const customerName =
      job.customer ||
      [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim() ||
      "";
    return {
      jobId: job.id,
      jobNumber: job.job_number || "",
      customerName,
      customerEmail: customer.email || "",
      customerPhone: customer.mobile || customer.telephone || "",
      customerAddress: customer.address || "",
      customerPostcode: customer.postcode || "",
      vehicleReg: job.vehicle_reg || vehicle.registration || vehicle.reg_number || "",
      vehicleMakeModel:
        job.vehicle_make_model ||
        vehicle.make_model ||
        [vehicle.make, vehicle.model].filter(Boolean).join(" ").trim() ||
        "",
      mileage: job.milage ?? vehicle.mileage ?? "",
      insuranceProvider: vehicle.insurance_provider || "",
      insurancePolicyNumber: vehicle.insurance_policy_number || "",
      waitingStatus: job.waiting_status || "",
    };
  });
};

const fetchLatestEvent = async (table, idField, idValue, selectFields) => {
  if (!idValue) return { data: null, error: null };
  const { data, error } = await supabase
    .from(table)
    .select(selectFields)
    .eq(idField, idValue)
    .order("occurred_at", { ascending: false })
    .limit(1);
  return { data: data?.[0] || null, error };
};

// Manual location update — APPEND, never rewrite.
//
// This used to run `update(payload).eq("job_id", jobId)`, with an insert only as
// a fallback when the update matched nothing. PostgREST applies that UPDATE to
// *every* matching row, so one manual location change rewrote the whole of that
// job's key and vehicle history: every historical row had its
// action/status/location/notes/performed_by replaced with the new values and its
// `occurred_at` restamped to now. A job's movement timeline collapsed into N
// identical entries dated at the moment of the last edit, the "Added to parking
// & key tracking" marker that /api/status/getHistory derives from the oldest row
// moved with it, and every row was re-attributed to whoever made the edit —
// destroying the audit trail.
//
// These tables are append-only event logs (`key_tracking_events`,
// `vehicle_tracking_events` — one row per movement, ordered by `occurred_at`).
// The current tracker location is *derived* from the newest row, so recording a
// new location is an INSERT. Nothing pre-existing is ever mutated.
//
// Per-side addressing is preserved: a caller that passes only `keyLocation`
// writes only a key row, and vice versa — `undefined` means "not addressed".
//
// Status carry-forward: the /tracking location form does not send a vehicle
// status, and `statusLabelForAction("location_update")` falls through to
// "Ready For Collection". Under the old mass-update that label was stamped over
// the job's entire history; as a plain append it would silently become the job's
// current status. A location change is not a status change, so when the caller
// does not supply one we carry forward the status of the latest existing vehicle
// event, falling back to the action label only when the job has no tracking
// history at all.
//
// De-duplication is deliberately NOT applied here. It is scoped to the
// automatic status-change path (`logNextActionEvents({ deduplicate: true })`),
// which could fire once per open browser tab. A manual update is one deliberate
// action by one member of staff, and a correction made twice within the window
// must still be recorded.
export const updateTrackingLocations = async ({
  actionType,
  jobId,
  jobNumber,
  vehicleId,
  vehicleReg,
  keyLocation,
  vehicleLocation,
  notes,
  performedBy,
  vehicleStatus,
}) => {
  const timestamp = new Date().toISOString();
  const targetJobId = jobId || null;
  const targetVehicleId = vehicleId || null;
  const filterField = targetJobId ? "job_id" : "vehicle_id";
  const filterValue = targetJobId || targetVehicleId;

  if (!filterValue) {
    return { success: false, error: { message: "Missing jobId or vehicleId for tracking update" } };
  }

  let keyResult = { data: null, error: null };
  let vehicleResult = { data: null, error: null };

  if (keyLocation !== undefined) {
    keyResult = await supabase
      .from("key_tracking_events")
      .insert({
        job_id: targetJobId,
        vehicle_id: targetVehicleId,
        action: buildKeyActionLabel(actionType, keyLocation),
        notes: buildKeyNotes({ jobNumber, vehicleReg, notes }),
        performed_by: performedBy || null,
        occurred_at: timestamp,
      })
      .select()
      .single();
    if (keyResult.error) {
      logFailure("Failed to append key tracking entry", keyResult.error);
      return { success: false, error: keyResult.error };
    }
  }

  if (vehicleLocation !== undefined) {
    let nextVehicleStatus = vehicleStatus || null;
    if (!nextVehicleStatus) {
      const { data: latestVehicleEvent, error: latestVehicleError } = await fetchLatestEvent(
        "vehicle_tracking_events",
        filterField,
        filterValue,
        "event_id, status, occurred_at"
      );
      // Fail open: a lookup error must not stop the movement being recorded.
      if (latestVehicleError) {
        logFailure("Failed to read latest vehicle tracking status", latestVehicleError);
      }
      nextVehicleStatus = latestVehicleEvent?.status || statusLabelForAction(actionType);
    }

    vehicleResult = await supabase
      .from("vehicle_tracking_events")
      .insert({
        job_id: targetJobId,
        vehicle_id: targetVehicleId,
        status: nextVehicleStatus,
        location: vehicleLocation || null,
        notes: buildVehicleNotes({ notes }),
        created_by: performedBy || null,
        occurred_at: timestamp,
      })
      .select()
      .single();
    if (vehicleResult.error) {
      logFailure("Failed to append vehicle tracking entry", vehicleResult.error);
      return { success: false, error: vehicleResult.error };
    }
  }

  return {
    success: true,
    data: {
      keyEvent: keyResult.data || null,
      vehicleEvent: vehicleResult.data || null,
    },
  };
};

const normaliseJobJoin = (join) => {
  if (!join) return {};
  const customerJoin = join.customer_ref || null;
  const vehicleJoin = join.vehicle_ref || null;
  const customerFromJoin =
    customerJoin?.name ||
    [customerJoin?.firstname, customerJoin?.lastname].filter(Boolean).join(" ").trim() ||
    "";
  const makeModelFromJoin =
    vehicleJoin?.make_model ||
    [vehicleJoin?.make, vehicleJoin?.model].filter(Boolean).join(" ").trim() ||
    "";
  const colourFromJoin = vehicleJoin?.colour || "";
  return {
    jobNumber: join.job_number || "",
    vehicleReg: join.vehicle_reg || "",
    customer: join.customer || customerFromJoin,
    serviceType: join.type || "",
    makeModel: join.vehicle_make_model || makeModelFromJoin,
    colour: colourFromJoin,
    assignedTo: join.assigned_to ?? null, // propagate technician assignment for tracking-page prioritisation
  };
};

const mergeEntry = (entryMap, baseKey, incoming) => {
  if (!entryMap.has(baseKey)) {
    entryMap.set(baseKey, {
      jobId: incoming.jobId,
      jobNumber: incoming.jobNumber,
      vehicleReg: incoming.vehicleReg,
      reg: incoming.vehicleReg,
      customer: incoming.customer,
      serviceType: incoming.serviceType,
      makeModel: incoming.makeModel,
      colour: incoming.colour || "",
      status: incoming.status,
      jobStatus: incoming.jobStatus || null,
      assignedTo: incoming.assignedTo ?? null,
      vehicleLocation: incoming.vehicleLocation || null,
      keyLocation: incoming.keyLocation || null,
      keyNotes: incoming.keyNotes || null,
      notes: incoming.notes || null,
      maintenanceInfo: incoming.maintenanceInfo || {},
      checkedInAt: incoming.checkedInAt || null,
      appointmentAt: incoming.appointmentAt || null,
      washState: incoming.washState || null,
      washUpdatedAt: incoming.washUpdatedAt || null,
      updatedAt: incoming.updatedAt,
    });
    return;
  }

  const existing = entryMap.get(baseKey);
  entryMap.set(baseKey, {
    ...existing,
    jobNumber: existing.jobNumber || incoming.jobNumber,
    vehicleReg: existing.vehicleReg || incoming.vehicleReg,
    reg: existing.reg || incoming.vehicleReg,
    customer: existing.customer || incoming.customer,
    serviceType: existing.serviceType || incoming.serviceType,
    makeModel: existing.makeModel || incoming.makeModel,
    colour: existing.colour || incoming.colour || "",
    assignedTo: existing.assignedTo ?? incoming.assignedTo ?? null,
    status: incoming.status || existing.status,
    jobStatus: incoming.jobStatus || existing.jobStatus,
    vehicleLocation: incoming.vehicleLocation || existing.vehicleLocation,
    keyLocation: incoming.keyLocation || existing.keyLocation,
    keyNotes: incoming.keyNotes || existing.keyNotes,
    notes: incoming.notes || existing.notes,
    maintenanceInfo:
      (incoming.maintenanceInfo && Object.keys(incoming.maintenanceInfo).length > 0)
        ? incoming.maintenanceInfo
        : existing.maintenanceInfo || {},
    checkedInAt: existing.checkedInAt || incoming.checkedInAt || null,
    appointmentAt: existing.appointmentAt || incoming.appointmentAt || null,
    washState: incoming.washState || existing.washState || null,
    washUpdatedAt:
      incoming.washUpdatedAt ||
      existing.washUpdatedAt ||
      null,
    updatedAt: new Date(Math.max(new Date(existing.updatedAt || 0).getTime(), new Date(incoming.updatedAt || 0).getTime())).toISOString(),
  });
};

// Rows scanned per table when building the tracking list.
//
// This was 50. Under the old behaviour a manual location update rewrote a job's
// existing rows instead of adding one, so row growth was driven only by
// automatic movements and 50 rows covered comfortably more jobs than the
// workshop holds. Now that every movement is a genuine append (see
// `updateTrackingLocations`), a single actively-moved job can occupy several
// rows in the window, and a 50-row scan would start dropping whole jobs off the
// list. The window is widened so the newest-row-per-job collapse below still
// sees every active job; the queries stay bounded and indexed on occurred_at.
const TRACKING_SNAPSHOT_EVENT_LIMIT = 400;

// The tracking list shows one row per job: its CURRENT key and vehicle location.
// The underlying tables are append-only event logs, so "current" means the newest
// row for that job — every older row is history and must not influence the list.
//
// `mergeEntry` is last-write-wins for the mutable fields (status, locations,
// notes), and the queries below come back `occurred_at` DESC, so feeding it every
// row made the OLDEST event win and the list showed a stale location. That was
// masked while manual updates rewrote a job's whole history to identical values;
// once those became true appends (see `updateTrackingLocations`) it would have
// pinned the list to each job's first ever movement. Collapse to the newest row
// per key here, before merging.
const newestEventPerKey = (events, keyOf) => {
  const seen = new Set();
  const newest = [];
  // Input is already occurred_at DESC, so the first row seen for a key is its
  // latest. Sort defensively rather than trusting the caller's ordering.
  [...(events || [])]
    .sort((a, b) => new Date(b?.occurred_at || 0).getTime() - new Date(a?.occurred_at || 0).getTime())
    .forEach((event) => {
      const key = keyOf(event);
      if (seen.has(key)) return;
      seen.add(key);
      newest.push(event);
    });
  return newest;
};

export const fetchTrackingSnapshot = async () => {
  const [{ data: keyEvents, error: keyError }, { data: vehicleEvents, error: vehicleError }] = await Promise.all([
    supabase
      .from("key_tracking_events")
      .select(
        "key_event_id, job_id, vehicle_id, action, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, status, vehicle_make_model, maintenance_info, checked_in_at, assigned_to, customer_ref:customer_id(name, firstname, lastname), vehicle_ref:vehicle_id(make_model, make, model, colour), appointments(scheduled_time)), vehicle:vehicle_id(make_model, make, model, colour)"
      )
      .order("occurred_at", { ascending: false })
      .limit(TRACKING_SNAPSHOT_EVENT_LIMIT),
    supabase
      .from("vehicle_tracking_events")
      .select(
        "event_id, job_id, vehicle_id, status, location, notes, occurred_at, jobs:job_id(job_number, vehicle_reg, customer, type, status, vehicle_make_model, maintenance_info, checked_in_at, assigned_to, customer_ref:customer_id(name, firstname, lastname), vehicle_ref:vehicle_id(make_model, make, model, colour), appointments(scheduled_time)), vehicle:vehicle_id(make_model, make, model, colour)"
      )
      .order("occurred_at", { ascending: false })
      .limit(TRACKING_SNAPSHOT_EVENT_LIMIT),
  ]);

  if (keyError || vehicleError) {
    logFailure("Failed to fetch tracking snapshot", keyError || vehicleError);
    return { success: false, error: keyError || vehicleError };
  }

  const entryMap = new Map();

  newestEventPerKey(vehicleEvents, (event) => event.job_id || `vehicle-${event.event_id}`).forEach((event) => {
    const join = normaliseJobJoin(event.jobs);
    const fallbackMakeModel =
      event.vehicle?.make_model ||
      [event.vehicle?.make, event.vehicle?.model].filter(Boolean).join(" ").trim() ||
      "";
    mergeEntry(entryMap, event.job_id || `vehicle-${event.event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel || fallbackMakeModel,
      colour: join.colour || event.vehicle?.colour || "",
      status: event.status || join.serviceType || "In Progress",
      jobStatus: event.jobs?.status || null,
      assignedTo: join.assignedTo ?? null,
      vehicleLocation: event.location || null,
      keyLocation: null,
      keyNotes: null,
      notes: event.notes || null,
      maintenanceInfo: event.jobs?.maintenance_info || {},
      checkedInAt: event.jobs?.checked_in_at || null,
      appointmentAt: event.jobs?.appointments?.[0]?.scheduled_time || null,
      washState:
        event.jobs?.maintenance_info?.valetChecklist?.washState ||
        (event.jobs?.maintenance_info?.valetChecklist?.wash ? "complete" : null),
      washUpdatedAt: event.jobs?.maintenance_info?.valetChecklist?.updatedAt || null,
      updatedAt: event.occurred_at,
    });
  });

  newestEventPerKey(keyEvents, (event) => event.job_id || `key-${event.key_event_id}`).forEach((event) => {
    const join = normaliseJobJoin(event.jobs);
    const fallbackMakeModel =
      event.vehicle?.make_model ||
      [event.vehicle?.make, event.vehicle?.model].filter(Boolean).join(" ").trim() ||
      "";
    mergeEntry(entryMap, event.job_id || `key-${event.key_event_id}`, {
      jobId: event.job_id || null,
      jobNumber: join.jobNumber,
      vehicleReg: join.vehicleReg,
      customer: join.customer,
      serviceType: join.serviceType,
      makeModel: join.makeModel || fallbackMakeModel,
      colour: join.colour || event.vehicle?.colour || "",
      // Vehicle status is owned by vehicle_tracking_events. This used to pass
      // the constant statusLabelForAction("job_complete") — "Ready For
      // Collection" — which, because mergeEntry is last-write-wins on status and
      // the key loop runs after the vehicle loop, overwrote the real status of
      // every job that had a key event and drove getTrackerLocationFlags to
      // classify them all as "collection". Leave it unset; the entry keeps
      // jobStatus below and the UI already falls back to it.
      status: null,
      jobStatus: event.jobs?.status || null,
      assignedTo: join.assignedTo ?? null,
      vehicleLocation: null,
      keyLocation: event.action || null,
      keyNotes: event.notes || null,
      notes: event.notes || null,
      maintenanceInfo: event.jobs?.maintenance_info || {},
      checkedInAt: event.jobs?.checked_in_at || null,
      appointmentAt: event.jobs?.appointments?.[0]?.scheduled_time || null,
      washState:
        event.jobs?.maintenance_info?.valetChecklist?.washState ||
        (event.jobs?.maintenance_info?.valetChecklist?.wash ? "complete" : null),
      washUpdatedAt: event.jobs?.maintenance_info?.valetChecklist?.updatedAt || null,
      updatedAt: event.occurred_at,
    });
  });

  const entries = Array.from(entryMap.values()).sort(
    (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
  );

  return {
    success: true,
    data: entries,
  };
};

export const fetchTrackingEntryForJob = async ({
  jobId = null,
  jobNumber = "",
  vehicleReg = "",
} = {}) => {
  const snapshot = await fetchTrackingSnapshot();
  if (!snapshot.success) {
    return snapshot;
  }

  const normalizedJobId =
    jobId !== null && jobId !== undefined ? String(jobId) : "";
  const normalizedJobNumber = String(jobNumber || "").trim().toLowerCase();
  const normalizedVehicleReg = String(vehicleReg || "").trim().toLowerCase();
  const matches = (snapshot.data || []).filter((entry) => {
    if (!entry) return false;
    const entryJobId =
      entry.jobId !== null && entry.jobId !== undefined
        ? String(entry.jobId)
        : "";
    const entryJobNumber = String(entry.jobNumber || "").trim().toLowerCase();
    const entryVehicleReg = String(
      entry.vehicleReg || entry.reg || ""
    ).trim().toLowerCase();

    return (
      (normalizedJobId && entryJobId === normalizedJobId) ||
      (normalizedJobNumber && entryJobNumber === normalizedJobNumber) ||
      (normalizedVehicleReg && entryVehicleReg === normalizedVehicleReg)
    );
  });

  const latestMatch = matches.sort(
    (a, b) =>
      new Date(b?.updatedAt || 0).getTime() -
      new Date(a?.updatedAt || 0).getTime()
  )[0];

  return {
    success: true,
    data: latestMatch || null,
  };
};
