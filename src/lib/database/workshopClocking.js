import { TECHNICIAN_ROLES } from "@/lib/auth/roles";
import { reconcileJobClockingsWithTimeRecords } from "@/lib/clocking/workshopBoard";
import { supabase } from "@/lib/database/supabaseClient";

const CLOCKING_JOB_SELECT = `
  id,
  user_id,
  job_id,
  job_number,
  request_id,
  clock_in,
  clock_out,
  work_type,
  created_at,
  updated_at,
  job:job_id (
    id,
    job_number,
    description,
    job_description_snapshot,
    type,
    status,
    tech_completion_status,
    assigned_to,
    queue_position,
    job_categories,
    checked_in_at,
    workshop_started_at,
    created_at,
    updated_at,
    appointments(appointment_id, scheduled_time, status, notes),
    job_requests(request_id, job_id, description, hours, job_type, sort_order, status, request_source, vhc_item_id, note_text),
    vhc_checks(vhc_id, request_id, approval_status, labour_hours, labour_complete, Complete)
  )
`;

const WORKSHOP_JOB_SELECT = `
  id,
  job_number,
  description,
  job_description_snapshot,
  type,
  status,
  tech_completion_status,
  assigned_to,
  queue_position,
  job_categories,
  checked_in_at,
  workshop_started_at,
  created_at,
  updated_at,
  appointments(appointment_id, scheduled_time, status, notes),
  job_requests(request_id, job_id, description, hours, job_type, sort_order, status, request_source, vhc_item_id, note_text),
  vhc_checks(vhc_id, request_id, approval_status, labour_hours, labour_complete, Complete)
`;

/**
 * Canonical active workshop population used by /clocking and every workspace
 * that needs to stay aligned with its technician/MOT roster.
 */
export async function getWorkshopClockingUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email, role, photo_url, contracted_hours, is_active")
    .in("role", TECHNICIAN_ROLES)
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Loads the raw sources needed by the live workshop clocking board.
 * Presentation and calculations stay outside the page while all Supabase
 * access remains in the database layer.
 */
export async function getWorkshopClockingSnapshot({ dateKey, dayStartIso }) {
  const users = await getWorkshopClockingUsers();

  const userIds = (users || []).map((user) => user.user_id).filter(Boolean);
  if (!userIds.length) {
    return { users: [], timeRecords: [], jobClockings: [], jobs: [] };
  }

  const [timeResult, clockingResult, jobsResult] = await Promise.all([
    supabase
      .from("time_records")
      .select("id, user_id, job_id, job_number, date, clock_in, clock_out, hours_worked, break_minutes, notes, created_at, updated_at")
      .in("user_id", userIds)
      .eq("date", dateKey)
      .order("clock_in", { ascending: true }),
    supabase
      .from("job_clocking")
      .select(CLOCKING_JOB_SELECT)
      .in("user_id", userIds)
      .or(`clock_in.gte.${dayStartIso},clock_out.gte.${dayStartIso},clock_out.is.null`)
      .order("clock_in", { ascending: true }),
    supabase
      .from("jobs")
      .select(WORKSHOP_JOB_SELECT)
      .in("assigned_to", userIds)
      .order("queue_position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  if (timeResult.error) throw timeResult.error;
  if (clockingResult.error) throw clockingResult.error;

  const jobClockings = clockingResult.data || [];
  const dayStartMs = new Date(dayStartIso).getTime();
  const staleOpenClockings = jobClockings.filter((clocking) => {
    const clockInMs = new Date(clocking?.clock_in).getTime();
    return !clocking?.clock_out && Number.isFinite(clockInMs) && clockInMs < dayStartMs;
  });

  let reconciliationRecords = timeResult.data || [];
  let reconciliationError = "";
  if (staleOpenClockings.length) {
    const staleUserIds = [...new Set(staleOpenClockings.map((clocking) => clocking.user_id).filter(Boolean))];
    const staleJobIds = [...new Set(staleOpenClockings.map((clocking) => clocking.job_id).filter(Boolean))];
    const earliestClockIn = staleOpenClockings
      .map((clocking) => clocking.clock_in)
      .filter(Boolean)
      .sort()[0];

    const staleTimeResult = await supabase
      .from("time_records")
      .select("id, user_id, job_id, job_number, date, clock_in, clock_out, hours_worked, break_minutes, notes, created_at, updated_at")
      .in("user_id", staleUserIds)
      .in("job_id", staleJobIds)
      .gte("clock_in", earliestClockIn)
      .lt("clock_in", dayStartIso)
      .not("clock_out", "is", null);

    if (staleTimeResult.error) reconciliationError = staleTimeResult.error.message || "Unable to reconcile stale job clockings.";
    else reconciliationRecords = [...reconciliationRecords, ...(staleTimeResult.data || [])];
  }

  return {
    users: users || [],
    timeRecords: timeResult.data || [],
    jobClockings: reconcileJobClockingsWithTimeRecords(jobClockings, reconciliationRecords),
    jobs: jobsResult.data || [],
    sectionErrors: {
      jobs: jobsResult.error?.message || "",
      reconciliation: reconciliationError,
    },
  };
}
