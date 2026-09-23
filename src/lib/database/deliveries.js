// file location: src/lib/database/deliveries.js
//
// Every Supabase read/write for the parts delivery diary (/deliveries).
//
// Before this module the page queried `parts_delivery_jobs` straight from the
// browser, which meant no role enforcement on writes, no audit trail and a
// second copy of the join shape in /delivery-planner. All of it now goes
// through here and is reached over /api/parts/delivery-diary/*.
//
// Tables used — all of them already existed:
//   parts_delivery_jobs    the delivery itself (the diary row)
//   parts_delivery_events  its history (added by the diary migration)
//   customers / jobs / invoices / vehicles   linked context
//   users                  the driver list
//   company_settings       the delivery-vehicle roster
//   deliveries             fallback source of vehicle registrations

import { supabase } from "@/lib/database/supabaseClient";
import { excludeAllAccessUser } from "@/lib/database/allAccessVisibility";
import {
  DELIVERY_STATUS,
  normaliseDeliveryStatus,
} from "@/features/deliveries/deliveryStatus";

const TABLE = "parts_delivery_jobs";
const EVENTS_TABLE = "parts_delivery_events";
const VEHICLE_SETTING_KEY = "parts_delivery_vehicles";
// How many registrations the derived fallback offers when the company_settings
// roster is empty. A dealership runs a handful of vans; anything longer is
// history, not a choice.
const DERIVED_VEHICLE_LIMIT = 12;

// The row shape the diary needs, plus the three relationships that give a stop
// its customer, workshop job and invoice context. Selecting explicitly (rather
// than `*`) keeps the day payload small enough to load in one request.
// Columns that existed before the delivery-diary migration.
const LEGACY_COLUMNS = `
  id, invoice_id, invoice_number, job_id, customer_id,
  customer_name, part_name, part_number, quantity, unit_price, total_price,
  items, payment_method, is_paid, delivery_date, address,
  contact_name, contact_phone, contact_email, notes, status, sort_order,
  completed_at, created_at, updated_at
`;

// Columns the delivery-diary migration adds.
const DIARY_COLUMNS = `
  order_reference, postcode, driver_id, driver_name, vehicle_reg,
  planned_time, window_start, window_end, eta_at, picked_at, ready_at,
  loaded_at, dispatched_at, failed_at, returned_at, is_urgent, is_collection,
  package_count, missing_items, surcharge_value, core_return_expected,
  core_return_collected, core_return_notes, pod_recipient_name, pod_notes,
  pod_photo_url, pod_photo_path, pod_signature_url, pod_signature_path,
  pod_captured_at, failed_reason, failed_notes
`;

const RELATIONS = `
  customer:customers(id, firstname, lastname, name, address, postcode, mobile, telephone, email),
  job:jobs(id, job_number, vehicle_reg, vehicle_make_model, status, vehicle_id),
  invoice:invoices(id, invoice_number, job_number, grand_total, invoice_total, paid, payment_status, payment_method)
`;

const DELIVERY_SELECT = `${LEGACY_COLUMNS}, ${DIARY_COLUMNS}, ${RELATIONS}`;
const DELIVERY_SELECT_LEGACY = `${LEGACY_COLUMNS}, ${RELATIONS}`;

const EVENT_SELECT =
  "id, delivery_job_id, event_type, from_status, to_status, actor_user_id, actor_name, summary, detail, created_at";

// Whether the delivery-diary migration has been applied. Resolved once per
// process from the first failed read rather than probed on every request.
//
// This exists so the page is useful on a database the migration has not reached
// yet: the day's route still loads with the columns that have always been
// there, and the API reports `migrationPending` so the UI can say why the
// workflow controls are missing instead of showing a raw PostgREST error.
let diaryColumnsAvailable = true;

const isMissingDiaryColumnError = (error) => {
  const message = String(error?.message || "");
  if (!/does not exist|schema cache/i.test(message)) return false;
  return /driver_id|planned_time|is_urgent|pod_recipient_name|order_reference|package_count/i.test(
    message
  );
};

/** True when the diary columns are known to be missing from the database. */
export const isDeliveryDiaryMigrationPending = () => !diaryColumnsAvailable;

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------
const asArray = (value) => (Array.isArray(value) ? value : []);

// PostgREST returns an embedded one-to-one relation as an object, but returns
// an array when it cannot prove uniqueness. Normalise both.
const firstRelation = (value) => {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const customerDisplayName = (customer, fallback) => {
  if (!customer) return fallback || "";
  const composed = [customer.firstname, customer.lastname].filter(Boolean).join(" ").trim();
  return composed || customer.name || fallback || "";
};

/**
 * Turn a raw row into the shape the page renders. Keeps every derived value
 * (item count, display name, contact number, status normalisation) in one place
 * so the row, the detail panel and the summary strip can never disagree.
 *
 * @param {object} row
 * @returns {object}
 */
export function shapeDeliveryRow(row = {}) {
  const customer = firstRelation(row.customer);
  const job = firstRelation(row.job);
  const invoice = firstRelation(row.invoice);
  const items = asArray(row.items);

  // `items` is free-form jsonb and the table already holds two shapes: the
  // invoice-line shape ({ description, quantity, total }) written by
  // /delivery-planner, and a shorter parts shape ({ name, partNumber, qty }).
  // Both are counted rather than one being treated as malformed.
  const itemCount = items.length
    ? items.reduce((total, item) => total + toNumber(item.quantity ?? item.qty, 1), 0)
    : toNumber(row.quantity, 0);

  // total_price is the diary's own figure; fall back to the invoice when the
  // row was created before a total was captured.
  const value = toNumber(
    row.total_price ?? invoice?.invoice_total ?? invoice?.grand_total,
    0
  );

  return {
    ...row,
    status: normaliseDeliveryStatus(row.status),
    rawStatus: row.status,
    items,
    itemCount,
    packageCount: toNumber(row.package_count, 0),
    value,
    surchargeValue: toNumber(row.surcharge_value, 0),
    customer,
    job,
    invoice,
    customerDisplayName: customerDisplayName(customer, row.customer_name),
    contactPhone: row.contact_phone || customer?.mobile || customer?.telephone || "",
    contactEmail: row.contact_email || customer?.email || "",
    addressLine: row.address || customer?.address || "",
    postcodeValue: row.postcode || customer?.postcode || "",
    isPaid: Boolean(row.is_paid) || Boolean(invoice?.paid),
    jobNumber: job?.job_number || invoice?.job_number || null,
    vehicleDetails: job
      ? [job.vehicle_reg, job.vehicle_make_model].filter(Boolean).join(" · ")
      : "",
  };
}

/**
 * Day totals for the summary strip. Derived from the already-fetched rows so
 * the page never issues a second aggregate query.
 *
 * @param {object[]} rows Shaped rows.
 */
export function summariseDeliveries(rows = []) {
  const counts = {
    [DELIVERY_STATUS.PLANNED]: 0,
    [DELIVERY_STATUS.PICKING]: 0,
    [DELIVERY_STATUS.READY]: 0,
    [DELIVERY_STATUS.LOADED]: 0,
    [DELIVERY_STATUS.OUT_FOR_DELIVERY]: 0,
    [DELIVERY_STATUS.DELIVERED]: 0,
    [DELIVERY_STATUS.FAILED]: 0,
    [DELIVERY_STATUS.RETURNED]: 0,
  };
  let totalValue = 0;
  let unpaidValue = 0;
  let urgentCount = 0;

  for (const row of rows) {
    const status = normaliseDeliveryStatus(row.status);
    counts[status] = (counts[status] || 0) + 1;
    totalValue += toNumber(row.value ?? row.total_price, 0);
    if (!row.isPaid && !row.is_paid) unpaidValue += toNumber(row.value ?? row.total_price, 0);
    if (row.is_urgent) urgentCount += 1;
  }

  return { counts, totalValue, unpaidValue, urgentCount, total: rows.length };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Every delivery for one day, in route order.
 *
 * @param {{date:string, driverId?:number|null}} params
 * @returns {Promise<object[]>} Shaped rows.
 */
export async function listDeliveriesForDate({ date, driverId = null } = {}) {
  if (!date) throw new Error("listDeliveriesForDate requires a delivery date.");

  const run = (columns, withDriverFilter) => {
    let query = supabase
      .from(TABLE)
      .select(columns)
      .eq("delivery_date", date)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (driverId && withDriverFilter) query = query.eq("driver_id", driverId);
    return query;
  };

  let result = diaryColumnsAvailable
    ? await run(DELIVERY_SELECT, true)
    : await run(DELIVERY_SELECT_LEGACY, false);

  if (result.error && isMissingDiaryColumnError(result.error)) {
    diaryColumnsAvailable = false;
    result = await run(DELIVERY_SELECT_LEGACY, false);
  }

  if (result.error) throw new Error(`Unable to load deliveries: ${result.error.message}`);
  return (result.data || []).map(shapeDeliveryRow);
}

/**
 * Per-day counts for the week strip. One grouped read rather than seven day
 * queries — the week view only needs totals, not rows.
 *
 * @param {{startDate:string, endDate:string}} params
 * @returns {Promise<Record<string, {total:number, open:number, delivered:number, failed:number, value:number}>>}
 */
export async function summariseDeliveryWeek({ startDate, endDate } = {}) {
  if (!startDate || !endDate) {
    throw new Error("summariseDeliveryWeek requires a start and end date.");
  }
  const run = (columns) =>
    supabase
      .from(TABLE)
      .select(columns)
      .gte("delivery_date", startDate)
      .lte("delivery_date", endDate);

  let { data, error } = await run(
    diaryColumnsAvailable
      ? "delivery_date, status, total_price, is_urgent"
      : "delivery_date, status, total_price"
  );
  if (error && isMissingDiaryColumnError(error)) {
    diaryColumnsAvailable = false;
    ({ data, error } = await run("delivery_date, status, total_price"));
  }
  if (error) throw new Error(`Unable to load the delivery week: ${error.message}`);

  const byDate = {};
  for (const row of data || []) {
    const key = row.delivery_date;
    if (!byDate[key]) {
      byDate[key] = { total: 0, open: 0, delivered: 0, failed: 0, urgent: 0, value: 0 };
    }
    const bucket = byDate[key];
    const status = normaliseDeliveryStatus(row.status);
    bucket.total += 1;
    bucket.value += toNumber(row.total_price, 0);
    if (row.is_urgent) bucket.urgent += 1;
    if (status === DELIVERY_STATUS.DELIVERED) bucket.delivered += 1;
    else if (status === DELIVERY_STATUS.FAILED) bucket.failed += 1;
    else bucket.open += 1;
  }
  return byDate;
}

/**
 * A single delivery, shaped, with its event history attached.
 * @param {string} deliveryJobId
 */
export async function getDeliveryJob(deliveryJobId) {
  if (!deliveryJobId) return null;
  const run = (columns) =>
    supabase.from(TABLE).select(columns).eq("id", deliveryJobId).maybeSingle();

  let result = await run(diaryColumnsAvailable ? DELIVERY_SELECT : DELIVERY_SELECT_LEGACY);
  if (result.error && isMissingDiaryColumnError(result.error)) {
    diaryColumnsAvailable = false;
    result = await run(DELIVERY_SELECT_LEGACY);
  }
  if (result.error) throw new Error(`Unable to load delivery: ${result.error.message}`);
  return result.data ? shapeDeliveryRow(result.data) : null;
}

/**
 * The history trail rendered in the detail panel.
 * @param {string} deliveryJobId
 * @param {number} [limit]
 */
export async function listDeliveryEvents(deliveryJobId, limit = 40) {
  if (!deliveryJobId) return [];
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_SELECT)
    .eq("delivery_job_id", deliveryJobId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // The trail is supporting detail: a missing events table (migration not yet
  // applied) must not take the whole delivery panel down with it.
  if (error) return [];
  return data || [];
}

/**
 * Event history for a whole day in one read, keyed by delivery id, so opening
 * a row does not cost a request.
 * @param {string[]} deliveryJobIds
 */
export async function listDeliveryEventsForIds(deliveryJobIds = []) {
  const ids = deliveryJobIds.filter(Boolean);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .select(EVENT_SELECT)
    .in("delivery_job_id", ids)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return {};
  const grouped = {};
  for (const row of data || []) {
    (grouped[row.delivery_job_id] ||= []).push(row);
  }
  return grouped;
}

// Who can be given a van run. Parts drivers first, plus the parts team who
// cover the route when a driver is off. Read from `users` — there is no
// separate driver table and adding one would duplicate the staff record. The
// role names match src/config/users.js exactly, so a rename there is a single
// edit rather than a silent behaviour change in a LIKE pattern.
const DELIVERY_DRIVER_ROLES = ["Parts Driver", "Parts", "Parts Manager"];

/**
 * Staff who can be assigned a van run, All Access demo account excluded (the
 * same rule the technician and MOT-tester pickers already apply).
 */
export async function listDeliveryDrivers() {
  const roleList = DELIVERY_DRIVER_ROLES.map((role) => `"${role}"`).join(",");
  const { data, error } = await excludeAllAccessUser(
    supabase
      .from("users")
      .select("user_id, first_name, last_name, name, role, phone, email, is_active")
      .eq("is_active", true)
      .or(`role.in.(${roleList})`)
  ).order("first_name", { ascending: true });
  if (error) throw new Error(`Unable to load delivery drivers: ${error.message}`);
  return (data || []).map((row) => ({
    userId: row.user_id,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
      row.name ||
      `User ${row.user_id}`,
    role: row.role || "",
    phone: row.phone || "",
  }));
}

/**
 * Delivery vehicle registrations.
 *
 * Primary source is the existing `company_settings` key
 * `parts_delivery_vehicles` (a JSON array of registrations, or of
 * `{ reg, label }`). When that is empty the list falls back to registrations
 * already used on `deliveries` and on the diary itself, so the dropdown is
 * never blank on a site that has never filled the setting in.
 */
export async function listDeliveryVehicles() {
  const configured = [];
  const { data: settingRow } = await supabase
    .from("company_settings")
    .select("setting_value")
    .eq("setting_key", VEHICLE_SETTING_KEY)
    .maybeSingle();

  if (settingRow?.setting_value) {
    try {
      const parsed = JSON.parse(settingRow.setting_value);
      for (const entry of asArray(parsed)) {
        const reg = typeof entry === "string" ? entry : entry?.reg || entry?.registration;
        if (!reg) continue;
        configured.push({
          reg: String(reg).toUpperCase(),
          label: (typeof entry === "object" && entry?.label) || String(reg).toUpperCase(),
        });
      }
    } catch {
      // A malformed setting falls through to the derived list below.
    }
  }

  if (configured.length > 0) return configured;

  // Ordered by most recently used, not alphabetically: `deliveries.vehicle_reg`
  // is free text and holds every registration ever typed into a delivery run,
  // so an A-Z list of all of them is a history dump, not a van roster. The last
  // few vans the site actually used are what a dropdown needs — and a site that
  // wants an exact list fills in the company_settings key above.
  const [runResult, diaryResult] = await Promise.all([
    supabase
      .from("deliveries")
      .select("vehicle_reg, updated_at")
      .not("vehicle_reg", "is", null)
      .order("updated_at", { ascending: false })
      .limit(200),
    // Skipped entirely until the diary migration has added the column.
    diaryColumnsAvailable
      ? supabase
          .from(TABLE)
          .select("vehicle_reg, updated_at")
          .not("vehicle_reg", "is", null)
          .order("updated_at", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  const rows = [
    ...(runResult?.error ? [] : runResult?.data || []),
    ...(diaryResult?.error ? [] : diaryResult?.data || []),
  ].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));

  const seen = new Set();
  const derived = [];
  for (const row of rows) {
    const reg = String(row.vehicle_reg || "").trim().toUpperCase();
    if (!reg || seen.has(reg)) continue;
    seen.add(reg);
    derived.push({ reg, label: reg });
    if (derived.length >= DERIVED_VEHICLE_LIMIT) break;
  }
  return derived;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Apply a patch to a delivery and return the refreshed, shaped row.
 * @param {string} deliveryJobId
 * @param {object} patch Column/value pairs — callers must pass real columns.
 */
export async function updateDeliveryJob(deliveryJobId, patch = {}) {
  if (!deliveryJobId) throw new Error("updateDeliveryJob requires a delivery id.");
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", deliveryJobId)
    .select(diaryColumnsAvailable ? DELIVERY_SELECT : DELIVERY_SELECT_LEGACY)
    .maybeSingle();
  if (error) {
    if (isMissingDiaryColumnError(error)) {
      diaryColumnsAvailable = false;
      throw new Error(
        "This delivery workflow needs the parts delivery diary migration (supabase/migrations/20260828120000_parts_delivery_diary.sql) to be applied first."
      );
    }
    throw new Error(`Unable to update delivery: ${error.message}`);
  }
  return data ? shapeDeliveryRow(data) : null;
}

/**
 * Persist a drag-and-drop route order.
 *
 * `sort_order` is written as the 1-based stop number so "Stop 3" in the UI and
 * `sort_order = 3` in the database are the same number — the old page stored
 * an opaque sequence and pushed completed rows to `(n + 1) * 100`, which is why
 * the order drifted as soon as anything was delivered.
 *
 * @param {{date:string, orderedIds:string[]}} params
 * @returns {Promise<number>} rows written
 */
export async function saveDeliveryRouteOrder({ date, orderedIds = [] } = {}) {
  if (!date) throw new Error("saveDeliveryRouteOrder requires a delivery date.");
  const ids = orderedIds.filter(Boolean);
  if (ids.length === 0) return 0;

  // Confirm every id belongs to the day being reordered before writing, so a
  // crafted payload cannot renumber another day's route.
  const { data: owned, error: ownedError } = await supabase
    .from(TABLE)
    .select("id")
    .eq("delivery_date", date)
    .in("id", ids);
  if (ownedError) throw new Error(`Unable to verify route order: ${ownedError.message}`);
  const ownedIds = new Set((owned || []).map((row) => row.id));
  const writable = ids.filter((id) => ownedIds.has(id));
  if (writable.length === 0) return 0;

  const stamp = new Date().toISOString();
  const results = await Promise.all(
    writable.map((id, index) =>
      supabase
        .from(TABLE)
        .update({ sort_order: index + 1, updated_at: stamp })
        .eq("id", id)
        .eq("delivery_date", date)
    )
  );
  const failed = results.find((result) => result.error);
  if (failed) throw new Error(`Unable to save route order: ${failed.error.message}`);
  return writable.length;
}

/**
 * Append a row to the delivery's own history trail.
 *
 * Best-effort: the trail is supporting detail, so a write failure is logged and
 * swallowed rather than failing the workflow action the user just performed.
 * The tamper-evident record of the same action is written separately to
 * `audit_events` by the API route.
 */
export async function recordDeliveryEvent({
  deliveryJobId,
  eventType,
  fromStatus = null,
  toStatus = null,
  actorUserId = null,
  actorName = null,
  summary,
  detail = {},
}) {
  if (!deliveryJobId || !eventType || !summary) return null;
  const { data, error } = await supabase
    .from(EVENTS_TABLE)
    .insert([
      {
        delivery_job_id: deliveryJobId,
        event_type: eventType,
        from_status: fromStatus,
        to_status: toStatus,
        actor_user_id: actorUserId,
        actor_name: actorName,
        summary,
        detail,
      },
    ])
    .select(EVENT_SELECT)
    .maybeSingle();
  if (error) {
    console.warn(`Delivery event not recorded (${eventType}): ${error.message}`);
    return null;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Downstream status sync
// ---------------------------------------------------------------------------

/**
 * Keep the records a delivery is linked to in step with it, using only the
 * status vocabulary those tables already define.
 *
 *   jobs.delivery_confirmed_at              — existing column, set on delivery
 *   parts_order_cards.delivery_status       — existing enum
 *                                             (pending/scheduled/dispatched/delivered)
 *
 * Invoices are deliberately NOT touched: `invoices.paid` is an accounts
 * decision, and marking a delivery delivered is not a payment.
 *
 * Every write is best-effort and reported back, so a missing link never blocks
 * the delivery transition itself.
 *
 * @param {object} delivery Shaped delivery row (post-update).
 * @returns {Promise<string[]>} Human-readable notes about what was synced.
 */
export async function syncDeliveryLinkedRecords(delivery) {
  const notes = [];
  if (!delivery) return notes;
  const status = normaliseDeliveryStatus(delivery.status);

  // 1. Workshop job — the schema already carries delivery_confirmed_at.
  if (delivery.job_id) {
    const confirmedAt =
      status === DELIVERY_STATUS.DELIVERED
        ? delivery.completed_at || new Date().toISOString()
        : null;
    const shouldWrite =
      status === DELIVERY_STATUS.DELIVERED ||
      status === DELIVERY_STATUS.FAILED ||
      status === DELIVERY_STATUS.RETURNED;
    if (shouldWrite) {
      const { error } = await supabase
        .from("jobs")
        .update({ delivery_confirmed_at: confirmedAt })
        .eq("id", delivery.job_id);
      if (error) notes.push(`Job link not updated: ${error.message}`);
      else if (confirmedAt) notes.push("Workshop job marked as delivery confirmed.");
      else notes.push("Workshop job delivery confirmation cleared.");
    }
  }

  // 2. Parts order card — matched on the reference the diary already stores.
  // The reference goes into a PostgREST `or()` filter string, where a comma or
  // a parenthesis would change the filter's meaning, so anything that is not a
  // plain reference token is skipped rather than escaped.
  const rawReference = delivery.order_reference || delivery.invoice_number;
  const orderReference = /^[A-Za-z0-9._/-]{1,64}$/.test(String(rawReference || ""))
    ? String(rawReference)
    : null;
  if (orderReference) {
    const orderStatus =
      status === DELIVERY_STATUS.DELIVERED
        ? "delivered"
        : status === DELIVERY_STATUS.OUT_FOR_DELIVERY || status === DELIVERY_STATUS.LOADED
        ? "dispatched"
        : status === DELIVERY_STATUS.FAILED || status === DELIVERY_STATUS.RETURNED
        ? "scheduled"
        : null;
    if (orderStatus) {
      const { data, error } = await supabase
        .from("parts_order_cards")
        .update({ delivery_status: orderStatus, updated_at: new Date().toISOString() })
        .or(
          `order_number.eq.${orderReference},invoice_reference.eq.${orderReference}`
        )
        .select("id");
      if (error) notes.push(`Parts order not updated: ${error.message}`);
      else if ((data || []).length > 0) {
        notes.push(`Parts order marked ${orderStatus}.`);
      }
    }
  }

  return notes;
}
