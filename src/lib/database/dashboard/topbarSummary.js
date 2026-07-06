// file location: src/lib/database/dashboard/topbarSummary.js
//
// Lean operational counts for the role-aware top bar (Phase 2.1 / 2.2). Unlike
// the full dashboard helpers (which fetch whole row bundles for a page), this
// returns ONLY cheap `head:true` counts for the caller's department, because the
// top bar polls this on every page for every logged-in user and must stay light.
//
// Filters mirror the existing dashboard helpers exactly (see dashboard/
// workshop.js, dashboard/admin.js, api/parts/summary.js) so the numbers agree
// with the department dashboards. Column names verified against
// src/lib/database/schema/schemaReference.sql.

import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";

// Open parts-item statuses = "still on a live job" (mirrors api/parts/summary.js).
const OPEN_PARTS_STATUSES = [
  "waiting_authorisation",
  "pending",
  "awaiting_stock",
  "on_order",
  "pre_picked",
  "stock",
  "allocated",
  "picked",
];
const PENDING_DELIVERY_STATUSES = ["ordering", "on_route", "partial"];

// Departments that receive live operational counts. Everything else falls back
// to static status copy (no query is run).
const OPERATIONAL_DEPARTMENTS = new Set([
  "workshop",
  "service",
  "mot",
  "valeting",
  "paint",
  "management",
]);

// Run a single head-count query. Returns the integer count, or null on error so
// one failing metric never fails the whole summary (the widget falls back).
async function countRows(query) {
  try {
    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error("topbarSummary count failed:", err?.message || err);
    return null;
  }
}

const headCount = (table) =>
  supabase.from(table).select("*", { count: "exact", head: true });

// Returns a flat metrics object for the given department code. Missing/errored
// metrics are omitted or null; the client merges roster headcounts on top.
export async function getTopbarOperationalSummary(department) {
  if (department === "parts") {
    const [partsOnOrder, pendingDeliveries, partsOutstanding] = await Promise.all([
      countRows(headCount("parts_catalog").eq("is_active", true).gt("qty_on_order", 0)),
      countRows(headCount("parts_deliveries").in("status", PENDING_DELIVERY_STATUSES)),
      countRows(headCount("parts_job_items").in("status", OPEN_PARTS_STATUSES)),
    ]);
    return { partsOnOrder, pendingDeliveries, partsOutstanding };
  }

  if (!OPERATIONAL_DEPARTMENTS.has(department)) {
    return {};
  }

  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const nowIso = dayjs().toISOString();

  const [
    jobsInProgress,
    jobsWaiting,
    appointmentsToday,
    overdueJobs,
    waitingApprovals,
    techniciansTotal,
    techniciansOnJobs,
  ] = await Promise.all([
    // In progress: checked in, not completed (mirrors workshop dailySummary.inProgress).
    countRows(headCount("jobs").is("completed_at", null).not("checked_in_at", "is", null)),
    // Waiting to be started: checked in but workshop work not begun, not completed.
    countRows(
      headCount("jobs")
        .not("checked_in_at", "is", null)
        .is("workshop_started_at", null)
        .is("completed_at", null)
    ),
    // Appointments scheduled today (mirrors admin/workshop appointmentsToday).
    countRows(
      headCount("appointments").gte("scheduled_time", todayStart).lt("scheduled_time", todayEnd)
    ),
    // Overdue: past its next-update-due and not completed.
    countRows(headCount("jobs").lt("next_update_due", nowIso).is("completed_at", null)),
    // VHC checks awaiting authorisation.
    countRows(headCount("vhc_checks").eq("approval_status", "pending")),
    // Technician availability (mirrors workshop technicianAvailability).
    countRows(headCount("users").ilike("role", "%tech%")),
    countRows(headCount("job_clocking").is("clock_out", null)),
  ]);

  const techniciansAvailable =
    techniciansTotal == null || techniciansOnJobs == null
      ? null
      : Math.max(techniciansTotal - techniciansOnJobs, 0);

  return {
    jobsInProgress,
    jobsWaiting,
    appointmentsToday,
    overdueJobs,
    waitingApprovals,
    techniciansAvailable,
    techniciansOnJobs,
    techniciansTotal,
  };
}
