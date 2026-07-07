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

// Run a small list query (used where a DISTINCT count is needed and a head:true
// count can't express it — e.g. distinct techs currently on a job). Returns the
// row array, or null on error so one failing metric never fails the summary.
async function selectRows(query) {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("topbarSummary select failed:", err?.message || err);
    return null;
  }
}

// How many detail rows a metric's hover tooltip lists before it collapses to a
// "+N more" line. Kept small so the tooltip stays compact, never a wall of text.
const DETAIL_CAP = 8;

// Run a filtered query that returns BOTH the exact count and a capped sample of
// rows in one round-trip (`.select(cols, { count: "exact" }).limit(cap)`), so a
// metric gets its KPI value AND a short detail list for the hover tooltip without
// a second query. Returns { count, sample }; count is null on error (widget then
// falls back), sample defaults to [].
async function countWithSample(query) {
  try {
    const { data, count, error } = await query;
    if (error) throw error;
    return { count: count ?? 0, sample: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.error("topbarSummary countWithSample failed:", err?.message || err);
    return { count: null, sample: [] };
  }
}

// Compact one-line label for a job detail row: "12345 · AB12 CDE" (reg dropped
// when absent). Short by design so the tooltip list never grows massive.
function jobLabel(row) {
  const num = row?.job_number ? String(row.job_number) : "—";
  const reg = row?.vehicle_reg ? String(row.vehicle_reg).toUpperCase() : "";
  return reg ? `${num} · ${reg}` : num;
}

// Display name for a user row, tolerant of the users table's overlapping name
// columns (name / first_name+last_name).
function personName(row) {
  const full = (row?.name || "").trim();
  if (full) return full;
  const composed = [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim();
  return composed || "Unknown";
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
    inProgress,
    waiting,
    appointmentsToday,
    overdue,
    waitingApprovals,
    techUsers,
    openClockings,
  ] = await Promise.all([
    // In progress: checked in, not completed (mirrors workshop dailySummary.inProgress).
    countWithSample(
      supabase
        .from("jobs")
        .select("job_number, vehicle_reg", { count: "exact" })
        .is("completed_at", null)
        .not("checked_in_at", "is", null)
        .order("checked_in_at", { ascending: true })
        .limit(DETAIL_CAP)
    ),
    // Waiting to be started: checked in but workshop work not begun, not completed.
    countWithSample(
      supabase
        .from("jobs")
        .select("job_number, vehicle_reg", { count: "exact" })
        .not("checked_in_at", "is", null)
        .is("workshop_started_at", null)
        .is("completed_at", null)
        .order("checked_in_at", { ascending: true })
        .limit(DETAIL_CAP)
    ),
    // Appointments scheduled today (mirrors admin/workshop appointmentsToday).
    countRows(
      headCount("appointments").gte("scheduled_time", todayStart).lt("scheduled_time", todayEnd)
    ),
    // Overdue: past its next-update-due and not completed. Sorted most-overdue first.
    countWithSample(
      supabase
        .from("jobs")
        .select("job_number, vehicle_reg", { count: "exact" })
        .lt("next_update_due", nowIso)
        .is("completed_at", null)
        .order("next_update_due", { ascending: true })
        .limit(DETAIL_CAP)
    ),
    // VHC checks awaiting authorisation.
    countRows(headCount("vhc_checks").eq("approval_status", "pending")),
    // Active technicians (role match mirrors workshop technicianAvailability). Names
    // fetched too so the "techs free" hover can list who is currently free.
    selectRows(
      supabase
        .from("users")
        .select("user_id, name, first_name, last_name")
        .eq("is_active", true)
        .ilike("role", "%tech%")
    ),
    // Everyone currently clocked onto a job (open clocking row = clock_out null).
    selectRows(supabase.from("job_clocking").select("user_id").is("clock_out", null)),
  ]);

  const jobsInProgress = inProgress.count;
  const jobsWaiting = waiting.count;
  const overdueJobs = overdue.count;

  // "Techs free" = active technicians NOT clocked onto any job right now. Count
  // DISTINCT techs on jobs (a tech split across several jobs is still one person)
  // and intersect with the tech set (job_clocking also holds non-tech user_ids),
  // so neither a tech on two jobs nor a non-tech clocking on can make the free
  // count false-zero — the flaw in the old `techsTotal − openClockingRows` maths.
  let techniciansTotal = null;
  let techniciansOnJobs = null;
  let techniciansAvailable = null;
  let freeTechNames = [];
  if (techUsers != null && openClockings != null) {
    const onJobIds = new Set(openClockings.map((c) => c.user_id));
    const techsOnJobs = new Set();
    const freeTechs = [];
    for (const tech of techUsers) {
      if (onJobIds.has(tech.user_id)) techsOnJobs.add(tech.user_id);
      else freeTechs.push(tech);
    }
    techniciansTotal = techUsers.length; // user_id is unique → already distinct
    techniciansOnJobs = techsOnJobs.size;
    techniciansAvailable = Math.max(techniciansTotal - techniciansOnJobs, 0);
    freeTechNames = freeTechs.map(personName).sort((a, b) => a.localeCompare(b));
  }

  // Compact per-metric detail lists for the hover tooltips (each already capped).
  const details = {
    jobsInProgress: inProgress.sample.map(jobLabel),
    jobsWaiting: waiting.sample.map(jobLabel),
    overdueJobs: overdue.sample.map(jobLabel),
    techniciansAvailable: freeTechNames.slice(0, DETAIL_CAP),
  };

  return {
    jobsInProgress,
    jobsWaiting,
    appointmentsToday,
    overdueJobs,
    waitingApprovals,
    techniciansAvailable,
    techniciansOnJobs,
    techniciansTotal,
    details,
  };
}
