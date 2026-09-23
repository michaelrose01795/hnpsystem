// file location: src/lib/database/loanCars.js
//
// Every Supabase read/write for the loan car tracker, server side only. The
// browser reaches it over /api/tracking/loan-cars/*, which enforces the
// capabilities in src/features/loanCars/loanCarAccess.js and writes the
// activity trail + platform audit record.
//
// Tables:
//   tracking_loan_cars                the fleet
//   tracking_loan_car_bookings        bookings copied from the external system
//   tracking_loan_car_unavailability  service / MOT / repair / damage periods
//   tracking_loan_car_events          the per-booking activity trail
//   tracking_loan_car_fuel_history    append-only fuel / mileage readings
//   jobs / customers / vehicles / appointments   Quick add lookups (read only)
//
// The unavailability / events tables and the booking lifecycle columns arrive
// with supabase/migrations/20260922120000_loan_car_tracker.sql. Until that is
// applied the tracker still loads and books with the columns that have always
// existed; `isLoanCarTrackerMigrationPending()` tells the page why the newer
// controls are unavailable.

import { supabase } from "@/lib/database/supabaseClient";
import { logFailure } from "@/lib/utils/logFailure";
import { BOOKING_STATUS_VALUES, normaliseDateKey, normaliseTime } from "@/features/loanCars/loanCarModel";

const CARS = "tracking_loan_cars";
const BOOKINGS = "tracking_loan_car_bookings";
const PERIODS = "tracking_loan_car_unavailability";
const EVENTS = "tracking_loan_car_events";
const FUEL_HISTORY = "tracking_loan_car_fuel_history";

// ---------------------------------------------------------------------------
// Migration detection
// ---------------------------------------------------------------------------
// Resolved from a cheap probe, not on every request. A positive result is kept
// for the life of the process; a negative one is re-checked after a minute so
// applying the migration (or recovering from a transient error) needs no
// restart.
const PENDING_RECHECK_MS = 60 * 1000;
let trackerColumnsAvailable = null;
let trackerProbeAt = 0;
// One probe at a time: the schedule request asks from three places at once, and
// on a cold process each used to fire its own identical probe query.
let trackerProbeInFlight = null;

async function probeTrackerMigration() {
  if (trackerColumnsAvailable === true) return true;
  if (trackerColumnsAvailable === false && Date.now() - trackerProbeAt < PENDING_RECHECK_MS) return false;
  if (!trackerProbeInFlight) {
    trackerProbeInFlight = (async () => {
      const { error } = await supabase.from(BOOKINGS).select("external_reference").limit(1);
      trackerColumnsAvailable = !error;
      trackerProbeAt = Date.now();
      return trackerColumnsAvailable;
    })().finally(() => {
      trackerProbeInFlight = null;
    });
  }
  return trackerProbeInFlight;
}

/** True when the loan-car-tracker migration has not reached this database. */
export const isLoanCarTrackerMigrationPending = async () => !(await probeTrackerMigration());

// ---------------------------------------------------------------------------
// Coercion
// ---------------------------------------------------------------------------
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const toNullableInteger = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

// Fuel is stored on a 0–8 scale (eighths), matching the FuelGauge.
const toFuelLevel = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(8, Math.max(0, Math.round(parsed)));
};

const text = (max) => (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().slice(0, max);
  return trimmed || null;
};

const upper = (max) => (value) => text(max)(value)?.toUpperCase() || null;
const dateOrNull = (value) => normaliseDateKey(value) || null;
const timeOrNull = (value) => normaliseTime(value) || null;
const uuidOrNull = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "")) ? String(value) : null;

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------
export const shapeLoanCar = (row = {}) => ({
  id: row.loan_car_id,
  loanCarId: row.loan_car_id,
  reg: row.reg || "",
  name: row.name || row.reg || "Loan car",
  makeModel: row.make_model || "",
  colour: row.colour || "",
  mileage: row.mileage ?? "",
  fuelLevel: toFuelLevel(row.fuel_level),
  status: row.status || "active",
  sortOrder: row.sort_order ?? 0,
  notes: row.notes || "",
  transmission: row.transmission || "",
  fuelType: row.fuel_type || "",
  motDue: row.mot_due || "",
  serviceDue: row.service_due || "",
  serviceDueMileage: row.service_due_mileage ?? "",
  lastVehicleUpdateAt: row.last_vehicle_update_at || row.updated_at || "",
});

// Before the tracker migration there is no status column. Derive one from the
// dates exactly as the migration's backfill does, so historic bookings read as
// returned rather than overdue.
const LONDON_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });
const legacyStatus = (row) => {
  const today = LONDON_DATE.format(new Date());
  if (row.end_date && row.end_date < today) return "returned";
  if (row.start_date && row.start_date < today) return "out";
  return "reserved";
};

export const shapeBooking = (row = {}) => ({
  id: row.booking_id,
  bookingId: row.booking_id,
  loanCarId: row.loan_car_id,
  startDate: row.start_date || "",
  endDate: row.end_date || row.start_date || "",
  startTime: normaliseTime(row.start_time),
  endTime: normaliseTime(row.end_time),
  status: row.status || legacyStatus(row),
  externalReference: row.external_reference || "",
  jobId: row.job_id || null,
  jobNumber: row.job_number || "",
  customerId: row.customer_id || null,
  customerName: row.customer_name || "",
  customerEmail: row.customer_email || "",
  customerPhone: row.customer_phone || "",
  customerAddress: row.customer_address || "",
  customerPostcode: row.customer_postcode || "",
  vehicleReg: row.vehicle_reg || "",
  vehicleMakeModel: row.vehicle_make_model || "",
  mileage: row.mileage ?? "",
  insuranceProvider: row.insurance_provider || "",
  insurancePolicyNumber: row.insurance_policy_number || "",
  licenceNumber: row.licence_number || "",
  dateOfBirth: row.date_of_birth || "",
  notes: row.notes || "",
  loanMileageOut: row.loan_mileage_out ?? "",
  loanFuelOut: row.loan_fuel_out ?? "",
  handedOverAt: row.handed_over_at || "",
  returnedDate: row.returned_date || "",
  returnedTime: normaliseTime(row.returned_time),
  loanMileageIn: row.loan_mileage_in ?? "",
  loanFuelIn: row.loan_fuel_in ?? "",
  hasDamage: row.has_damage === true,
  returnNotes: row.return_notes || "",
  createdAt: row.created_at || "",
  updatedAt: row.updated_at || "",
});

export const shapePeriod = (row = {}) => ({
  id: row.period_id,
  periodId: row.period_id,
  loanCarId: row.loan_car_id,
  startDate: row.start_date || "",
  endDate: row.end_date || "",
  reason: row.reason || "other",
  notes: row.notes || "",
});

export const shapeEvent = (row = {}) => ({
  id: row.id,
  bookingId: row.booking_id || null,
  loanCarId: row.loan_car_id || null,
  eventType: row.event_type || "",
  summary: row.summary || "",
  actorName: row.actor_name || "",
  detail: row.detail || {},
  createdAt: row.created_at || "",
});

// ---------------------------------------------------------------------------
// Write payloads (allow-lists — nothing the browser sends reaches a column
// that is not named here)
// ---------------------------------------------------------------------------
const BOOKING_FIELDS = {
  loanCarId: ["loan_car_id", uuidOrNull],
  startDate: ["start_date", dateOrNull],
  endDate: ["end_date", dateOrNull],
  jobId: ["job_id", toNullableInteger],
  jobNumber: ["job_number", text(40)],
  customerName: ["customer_name", text(160)],
  customerEmail: ["customer_email", text(160)],
  customerPhone: ["customer_phone", text(40)],
  customerAddress: ["customer_address", text(300)],
  customerPostcode: ["customer_postcode", upper(12)],
  vehicleReg: ["vehicle_reg", upper(16)],
  vehicleMakeModel: ["vehicle_make_model", text(120)],
  mileage: ["mileage", toNullableInteger],
  insuranceProvider: ["insurance_provider", text(120)],
  insurancePolicyNumber: ["insurance_policy_number", text(80)],
  licenceNumber: ["licence_number", upper(40)],
  dateOfBirth: ["date_of_birth", dateOrNull],
  notes: ["notes", text(2000)],
};

// Only written once the tracker migration is present.
const BOOKING_TRACKER_FIELDS = {
  startTime: ["start_time", timeOrNull],
  endTime: ["end_time", timeOrNull],
  status: ["status", (value) => (BOOKING_STATUS_VALUES.includes(value) ? value : "reserved")],
  externalReference: ["external_reference", text(80)],
  customerId: ["customer_id", uuidOrNull],
  loanMileageOut: ["loan_mileage_out", toNullableInteger],
  loanFuelOut: ["loan_fuel_out", (value) => (value === "" || value == null ? null : toFuelLevel(value))],
  handedOverAt: ["handed_over_at", (value) => value || null],
  returnedDate: ["returned_date", dateOrNull],
  returnedTime: ["returned_time", timeOrNull],
  loanMileageIn: ["loan_mileage_in", toNullableInteger],
  loanFuelIn: ["loan_fuel_in", (value) => (value === "" || value == null ? null : toFuelLevel(value))],
  hasDamage: ["has_damage", (value) => value === true || value === "true"],
  returnNotes: ["return_notes", text(2000)],
};

const CAR_FIELDS = {
  reg: ["reg", upper(16)],
  makeModel: ["make_model", text(120)],
  colour: ["colour", text(40)],
  mileage: ["mileage", toNullableInteger],
  fuelLevel: ["fuel_level", (value) => toFuelLevel(value)],
  status: ["status", (value) => (value === "inactive" ? "inactive" : "active")],
  sortOrder: ["sort_order", (value) => toNullableInteger(value) ?? 0],
  notes: ["notes", text(2000)],
};

const CAR_TRACKER_FIELDS = {
  transmission: ["transmission", (value) => (["manual", "automatic"].includes(value) ? value : null)],
  fuelType: [
    "fuel_type",
    (value) => (["petrol", "diesel", "hybrid", "plug_in_hybrid", "electric", "other"].includes(value) ? value : null),
  ],
  motDue: ["mot_due", dateOrNull],
  serviceDue: ["service_due", dateOrNull],
  serviceDueMileage: ["service_due_mileage", toNullableInteger],
};

const pickColumns = (input, ...fieldMaps) => {
  const payload = {};
  for (const fields of fieldMaps) {
    for (const [key, [column, coerce]] of Object.entries(fields)) {
      if (hasOwn(input, key)) payload[column] = coerce(input[key]);
    }
  }
  return payload;
};

/**
 * Column payload for a booking write. Only keys present on `input` are
 * written, so a partial update never blanks a column it did not mention.
 */
export async function buildBookingColumns(input = {}) {
  const trackerReady = await probeTrackerMigration();
  return trackerReady
    ? pickColumns(input, BOOKING_FIELDS, BOOKING_TRACKER_FIELDS)
    : pickColumns(input, BOOKING_FIELDS);
}

/** Adds created_by / updated_by once the tracker migration has added them. */
export async function withBookingActor(columns, actorUserId, { creating = false } = {}) {
  if (!(await probeTrackerMigration())) return columns;
  return {
    ...columns,
    ...(creating ? { created_by: actorUserId || null } : {}),
    updated_by: actorUserId || null,
  };
}

export async function buildCarColumns(input = {}) {
  const trackerReady = await probeTrackerMigration();
  const payload = trackerReady ? pickColumns(input, CAR_FIELDS, CAR_TRACKER_FIELDS) : pickColumns(input, CAR_FIELDS);
  if (hasOwn(payload, "reg")) payload.name = payload.reg;
  if (hasOwn(payload, "mileage") || hasOwn(payload, "fuel_level")) {
    payload.last_vehicle_update_at = new Date().toISOString();
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export async function listLoanCars() {
  const { data, error } = await supabase
    .from(CARS)
    .select("*")
    .order("sort_order", { ascending: true })
    .order("reg", { ascending: true });
  if (error) {
    logFailure("Failed to fetch loan cars", error);
    throw error;
  }
  return (data || []).map(shapeLoanCar);
}

export async function getLoanCar(loanCarId) {
  const { data, error } = await supabase.from(CARS).select("*").eq("loan_car_id", loanCarId).maybeSingle();
  if (error) throw error;
  return data ? shapeLoanCar(data) : null;
}

/**
 * Bookings the calendar needs: everything overlapping the visible range, plus
 * anything still outstanding today (an overdue car booked weeks ago must still
 * drive its column's availability even when that week is off screen).
 */
export async function listBookingsForSchedule({ startDate, endDate, todayKey }) {
  const rangeQuery = supabase
    .from(BOOKINGS)
    .select("*")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true })
    .limit(1000);

  // Only this query's filter depends on the migration probe, so only it waits
  // for the probe; the range and upcoming queries start straight away.
  const outstandingQuery = probeTrackerMigration().then((trackerReady) => {
    const query = supabase.from(BOOKINGS).select("*").lte("start_date", todayKey).limit(500);
    return trackerReady ? query.in("status", ["reserved", "out"]) : query.gte("end_date", todayKey);
  });

  // Upcoming bookings just past the visible range, so each column can say
  // when its next loan starts.
  const upcomingQuery = supabase
    .from(BOOKINGS)
    .select("*")
    .gt("start_date", endDate)
    .order("start_date", { ascending: true })
    .limit(200);

  const [range, outstanding, upcoming] = await Promise.all([rangeQuery, outstandingQuery, upcomingQuery]);
  const failed = range.error || outstanding.error || upcoming.error;
  if (failed) {
    logFailure("Failed to fetch loan car bookings", failed);
    throw failed;
  }

  const byId = new Map();
  for (const row of [...(range.data || []), ...(outstanding.data || []), ...(upcoming.data || [])]) {
    byId.set(row.booking_id, row);
  }
  return Array.from(byId.values()).map(shapeBooking);
}

/** Every booking on any car whose dates touch the window — for conflict checks. */
export async function listBookingsTouching({ startDate, endDate }) {
  const { data, error } = await supabase
    .from(BOOKINGS)
    .select("*")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1000);
  if (error) throw error;
  return (data || []).map(shapeBooking);
}

export async function countBookingsForCar(loanCarId) {
  const { count, error } = await supabase
    .from(BOOKINGS)
    .select("booking_id", { count: "exact", head: true })
    .eq("loan_car_id", loanCarId);
  if (error) throw error;
  return count || 0;
}

export async function getBooking(bookingId) {
  const { data, error } = await supabase.from(BOOKINGS).select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw error;
  return data ? shapeBooking(data) : null;
}

export async function listUnavailability({ startDate, endDate }) {
  if (!(await probeTrackerMigration())) return [];
  const { data, error } = await supabase
    .from(PERIODS)
    .select("*")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .order("start_date", { ascending: true })
    .limit(500);
  if (error) {
    logFailure("Failed to fetch loan car unavailable periods", error);
    return [];
  }
  return (data || []).map(shapePeriod);
}

export async function listUnavailabilityForCar(loanCarId) {
  if (!(await probeTrackerMigration())) return [];
  const { data, error } = await supabase
    .from(PERIODS)
    .select("*")
    .eq("loan_car_id", loanCarId)
    .order("start_date", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data || []).map(shapePeriod);
}

export async function getUnavailability(periodId) {
  const { data, error } = await supabase.from(PERIODS).select("*").eq("period_id", periodId).maybeSingle();
  if (error) throw error;
  return data ? shapePeriod(data) : null;
}

export async function listBookingEvents(bookingId, limit = 50) {
  if (!bookingId || !(await probeTrackerMigration())) return [];
  const { data, error } = await supabase
    .from(EVENTS)
    .select("*")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // The trail is supporting detail; it must never take the drawer down.
  if (error) return [];
  return (data || []).map(shapeEvent);
}

export async function listCarEvents(loanCarId, limit = 30) {
  if (!loanCarId || !(await probeTrackerMigration())) return [];
  const { data, error } = await supabase
    .from(EVENTS)
    .select("*")
    .eq("loan_car_id", loanCarId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map(shapeEvent);
}

export async function listFuelHistory(loanCarId, limit = 30) {
  if (!loanCarId) return [];
  const { data, error } = await supabase
    .from(FUEL_HISTORY)
    .select("*")
    .eq("loan_car_id", loanCarId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.history_id,
    fuelLevel: toFuelLevel(row.fuel_level),
    mileage: row.mileage ?? "",
    recordedAt: row.recorded_at || "",
  }));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export async function insertBooking(columns) {
  const { data, error } = await supabase.from(BOOKINGS).insert(columns).select().single();
  if (error) throw error;
  return shapeBooking(data);
}

export async function updateBooking(bookingId, columns) {
  const { data, error } = await supabase
    .from(BOOKINGS)
    .update({ ...columns, updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return shapeBooking(data);
}

export async function deleteBooking(bookingId) {
  const { error } = await supabase.from(BOOKINGS).delete().eq("booking_id", bookingId);
  if (error) throw error;
}

/**
 * Append a fuel / mileage reading, skipping an exact repeat of the latest row
 * (the tracking_loan_cars fuel trigger may already have written it).
 */
async function recordFuelReading({ loanCarId, reg, fuelLevel, mileage }) {
  const { data: latest } = await supabase
    .from(FUEL_HISTORY)
    .select("fuel_level, mileage")
    .eq("loan_car_id", loanCarId)
    .order("recorded_at", { ascending: false })
    .limit(1);
  const last = latest?.[0];
  if (last && toFuelLevel(last.fuel_level) === fuelLevel && toNullableInteger(last.mileage) === mileage) return;
  const { error } = await supabase.from(FUEL_HISTORY).insert({ loan_car_id: loanCarId, reg, fuel_level: fuelLevel, mileage });
  if (error) logFailure("Failed to save loan car fuel history", error);
}

export async function insertLoanCar(columns) {
  const { data, error } = await supabase.from(CARS).insert(columns).select().single();
  if (error) throw error;
  const car = shapeLoanCar(data);
  await recordFuelReading({
    loanCarId: car.loanCarId,
    reg: car.reg,
    fuelLevel: car.fuelLevel,
    mileage: toNullableInteger(car.mileage),
  });
  return car;
}

export async function updateLoanCar(loanCarId, columns) {
  const { data, error } = await supabase
    .from(CARS)
    .update({ ...columns, updated_at: new Date().toISOString() })
    .eq("loan_car_id", loanCarId)
    .select()
    .single();
  if (error) throw error;
  const car = shapeLoanCar(data);
  if (hasOwn(columns, "fuel_level") || hasOwn(columns, "mileage")) {
    await recordFuelReading({
      loanCarId,
      reg: car.reg,
      fuelLevel: car.fuelLevel,
      mileage: toNullableInteger(car.mileage),
    });
  }
  return car;
}

export async function deleteLoanCar(loanCarId) {
  const { error } = await supabase.from(CARS).delete().eq("loan_car_id", loanCarId);
  if (error) throw error;
}

export async function insertUnavailability({ loanCarId, startDate, endDate, reason, notes, createdBy }) {
  const { data, error } = await supabase
    .from(PERIODS)
    .insert({
      loan_car_id: loanCarId,
      start_date: startDate,
      end_date: endDate,
      reason,
      notes: text(1000)(notes),
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error) throw error;
  return shapePeriod(data);
}

export async function updateUnavailability(periodId, { startDate, endDate, reason, notes }) {
  const { data, error } = await supabase
    .from(PERIODS)
    .update({
      start_date: startDate,
      end_date: endDate,
      reason,
      notes: text(1000)(notes),
      updated_at: new Date().toISOString(),
    })
    .eq("period_id", periodId)
    .select()
    .single();
  if (error) throw error;
  return shapePeriod(data);
}

export async function deleteUnavailability(periodId) {
  const { error } = await supabase.from(PERIODS).delete().eq("period_id", periodId);
  if (error) throw error;
}

/** Append to the page-facing activity trail. Never throws. */
export async function recordLoanCarEvent({
  bookingId = null,
  loanCarId = null,
  eventType,
  summary,
  actorUserId = null,
  actorName = null,
  detail = {},
}) {
  if (!eventType || !summary) return null;
  if (!(await probeTrackerMigration())) return null;
  const { data, error } = await supabase
    .from(EVENTS)
    .insert({
      booking_id: bookingId,
      loan_car_id: loanCarId,
      event_type: eventType,
      summary: String(summary).slice(0, 500),
      actor_user_id: actorUserId,
      actor_name: actorName,
      detail,
    })
    .select()
    .single();
  if (error) {
    logFailure("Failed to record loan car event", error);
    return null;
  }
  return shapeEvent(data);
}

// ---------------------------------------------------------------------------
// Quick add lookup
// ---------------------------------------------------------------------------
const JOB_LOOKUP_SELECT = `
  id,
  job_number,
  customer,
  customer_id,
  vehicle_reg,
  vehicle_make_model,
  milage,
  updated_at,
  customer_ref:customer_id(id, firstname, lastname, name, email, mobile, telephone, address, postcode),
  vehicle:vehicle_id(registration, reg_number, make, model, make_model, mileage, insurance_provider, insurance_policy_number),
  appointments(scheduled_time)
`;

const firstRelation = (value) => (Array.isArray(value) ? value[0] || null : value || null);

const customerName = (customer, fallback = "") =>
  [customer?.firstname, customer?.lastname].filter(Boolean).join(" ").trim() || customer?.name || fallback;

// Appointment times are stored as timestamptz; the booking form wants the
// dealership's local date and time.
const LOCAL_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const toLocalDateTime = (value) => {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const parts = Object.fromEntries(LOCAL_PARTS.formatToParts(parsed).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
};

const shapeJobTarget = (job) => {
  const customer = firstRelation(job.customer_ref) || {};
  const vehicle = firstRelation(job.vehicle) || {};
  const appointment = (Array.isArray(job.appointments) ? job.appointments : [])
    .map((row) => row.scheduled_time)
    .filter(Boolean)
    .sort()
    .pop();
  const local = toLocalDateTime(appointment);
  return {
    key: `job-${job.id}`,
    source: "job",
    jobId: job.id,
    jobNumber: job.job_number || "",
    customerId: job.customer_id || customer.id || null,
    customerName: customerName(customer, job.customer || ""),
    customerEmail: customer.email || "",
    customerPhone: customer.mobile || customer.telephone || "",
    customerAddress: customer.address || "",
    customerPostcode: customer.postcode || "",
    vehicleReg: job.vehicle_reg || vehicle.registration || vehicle.reg_number || "",
    vehicleMakeModel:
      job.vehicle_make_model || vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" "),
    mileage: job.milage ?? vehicle.mileage ?? "",
    insuranceProvider: vehicle.insurance_provider || "",
    insurancePolicyNumber: vehicle.insurance_policy_number || "",
    appointmentDate: local.date,
    appointmentTime: local.time,
  };
};

/**
 * DMS records matching a Quick add search: jobs by number / registration /
 * customer, and customers by name / phone / email (with their latest job, so a
 * customer pick still fills the job and vehicle).
 */
export async function searchLoanCarLookup(term) {
  const cleaned = String(term || "").replace(/[%_,()*\\]/g, " ").trim();
  if (cleaned.length < 2) return [];
  const like = `%${cleaned}%`;
  const compactReg = cleaned.replace(/\s+/g, "");
  const phoneDigits = cleaned.replace(/\D/g, "");

  const jobFilters = [`job_number.ilike.${like}`, `vehicle_reg.ilike.${like}`, `customer.ilike.${like}`];
  if (compactReg !== cleaned) jobFilters.push(`vehicle_reg.ilike.%${compactReg}%`);

  const customerFilters = [`firstname.ilike.${like}`, `lastname.ilike.${like}`, `name.ilike.${like}`, `email.ilike.${like}`];
  if (phoneDigits.length >= 4) {
    customerFilters.push(`mobile.ilike.%${phoneDigits}%`, `telephone.ilike.%${phoneDigits}%`);
  }

  const [jobsResult, customersResult] = await Promise.all([
    supabase.from("jobs").select(JOB_LOOKUP_SELECT).or(jobFilters.join(",")).order("updated_at", { ascending: false }).limit(10),
    supabase
      .from("customers")
      .select("id, firstname, lastname, name, email, mobile, telephone, address, postcode")
      .or(customerFilters.join(","))
      .limit(8),
  ]);

  if (jobsResult.error) logFailure("Loan car lookup: job search failed", jobsResult.error);
  if (customersResult.error) logFailure("Loan car lookup: customer search failed", customersResult.error);

  const jobTargets = (jobsResult.data || []).map(shapeJobTarget);
  const seenCustomers = new Set(jobTargets.map((target) => target.customerId).filter(Boolean));
  const extraCustomers = (customersResult.data || []).filter((customer) => !seenCustomers.has(customer.id));

  let customerJobs = [];
  if (extraCustomers.length > 0) {
    const { data } = await supabase
      .from("jobs")
      .select(JOB_LOOKUP_SELECT)
      .in("customer_id", extraCustomers.map((customer) => customer.id))
      .order("updated_at", { ascending: false })
      .limit(40);
    customerJobs = data || [];
  }

  const customerTargets = extraCustomers.map((customer) => {
    const latestJob = customerJobs.find((job) => job.customer_id === customer.id);
    if (latestJob) return shapeJobTarget(latestJob);
    return {
      key: `customer-${customer.id}`,
      source: "customer",
      jobId: null,
      jobNumber: "",
      customerId: customer.id,
      customerName: customerName(customer),
      customerEmail: customer.email || "",
      customerPhone: customer.mobile || customer.telephone || "",
      customerAddress: customer.address || "",
      customerPostcode: customer.postcode || "",
      vehicleReg: "",
      vehicleMakeModel: "",
      mileage: "",
      insuranceProvider: "",
      insurancePolicyNumber: "",
      appointmentDate: "",
      appointmentTime: "",
    };
  });

  return [...jobTargets, ...customerTargets].slice(0, 14);
}
