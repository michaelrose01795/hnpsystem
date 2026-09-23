// file location: src/lib/database/jobSettings.js
//
// Server-side reads for the Job Card Settings control centre
// (/api/job-cards/[jobNumber]/settings). Writes are NOT made here: every change
// to a job row still goes through the canonical helpers in ./jobs.js
// (updateJob / updateJobStatus / assignTechnicianToJob / …), so status history,
// activity logging, notifications and tracking movements stay in one place.
//
// The four settings columns (priority, service_advisor_id, next_update_owner_id,
// next_update_reminder_enabled) arrive with migration
// 20260923120000_job_card_settings_fields. Until it has run, reads fall back to
// the columns that have always existed and report `migrationPending`, so the
// popup can explain why those controls are unavailable instead of failing.

import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { resolveJobIdentity } from "@/lib/jobs/jobIdentity";
import { getDisplayName } from "@/lib/users/displayName";

const getClient = () => supabaseService || supabase;

export const JOB_SETTINGS_COLUMNS = [
  "priority",
  "service_advisor_id",
  "next_update_owner_id",
  "next_update_reminder_enabled",
];

const BASE_JOB_COLUMNS = [
  "id",
  "job_number",
  "status",
  "booked_by",
  "assigned_to",
  "customer_id",
  "vehicle_id",
  "vhc_required",
  "vhc_completed_at",
  "job_source",
  "job_division",
  "waiting_status",
  "warranty_linked_job_id",
  "warranty_vhc_master_job_id",
  "prime_job_number",
  "is_prime_job",
  "next_update_due",
].join(", ");

// resolveJobIdentity wraps the PostgREST error in a plain Error, but the
// wrapped message still names the missing column ("column jobs.priority does
// not exist" / "… in the schema cache").
const isMissingSettingsColumnError = (error) => {
  const message = String(error?.message || "");
  return (
    /does not exist|schema cache/i.test(message) &&
    JOB_SETTINGS_COLUMNS.some((column) => message.includes(column))
  );
};

/**
 * Load the job a settings request targets. Returns { job, migrationPending }
 * where `job` is the raw row (or null when not found). A pending migration is
 * re-checked on every request, so applying it needs no restart.
 */
export async function loadJobForSettings(identifier) {
  const client = getClient();
  const withSettings = `${BASE_JOB_COLUMNS}, ${JOB_SETTINGS_COLUMNS.join(", ")}`;

  try {
    const job = await resolveJobIdentity({ client, identifier, select: withSettings });
    return { job, migrationPending: false };
  } catch (error) {
    if (!isMissingSettingsColumnError(error)) throw error;
  }

  const job = await resolveJobIdentity({ client, identifier, select: BASE_JOB_COLUMNS });
  return { job, migrationPending: true };
}

/** True when the job has been moved to job_archive (the archive is read-only). */
export async function isJobArchived(jobId) {
  if (!jobId) return false;
  const { data, error } = await getClient()
    .from("job_archive")
    .select("job_id")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Open clocking entries on the job, with the technician's name. */
export async function getActiveClockingForJob(jobId) {
  if (!jobId) return [];
  const { data, error } = await getClient()
    .from("job_clocking")
    .select("id, user_id, clock_in, user:user_id (first_name, last_name)")
    .eq("job_id", jobId)
    .is("clock_out", null);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    name: getDisplayName(row.user || {}) || `User ${row.user_id}`,
    clockIn: row.clock_in,
  }));
}

/** Display names for a set of users.user_id values. */
export async function getUserNamesById(userIds = []) {
  const ids = Array.from(
    new Set(userIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))
  );
  if (!ids.length) return new Map();
  const { data, error } = await getClient()
    .from("users")
    .select("user_id, first_name, last_name")
    .in("user_id", ids);
  if (error) throw error;
  return new Map((data || []).map((row) => [Number(row.user_id), getDisplayName(row)]));
}

/** The vehicle a job may be re-associated with — only the job customer's own. */
export async function getCustomerVehicle(customerId, vehicleId) {
  if (!customerId || !vehicleId) return null;
  const { data, error } = await getClient()
    .from("vehicles")
    .select("vehicle_id, customer_id, registration, reg_number, make, model, make_model")
    .eq("vehicle_id", vehicleId)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Whether the job still has a live (non-cancelled) appointment row. */
export async function hasOpenAppointment(jobId) {
  if (!jobId) return false;
  const { data, error } = await getClient()
    .from("appointments")
    .select("appointment_id, status")
    .eq("job_id", jobId);
  if (error) throw error;
  return (data || []).some((row) => String(row.status || "").toLowerCase() !== "cancelled");
}

/** Shape the settings-only fields for the popup. */
export async function buildJobSettingsMeta(job, { migrationPending = false } = {}) {
  const names = await getUserNamesById([
    job?.booked_by,
    job?.service_advisor_id,
    job?.next_update_owner_id,
  ]);
  const nameOf = (value) => (value ? names.get(Number(value)) || null : null);

  return {
    migrationPending,
    priority: migrationPending ? null : job?.priority || "normal",
    serviceAdvisorId: migrationPending ? null : job?.service_advisor_id ?? null,
    serviceAdvisorName: migrationPending ? null : nameOf(job?.service_advisor_id),
    bookedById: job?.booked_by ?? null,
    bookedByName: nameOf(job?.booked_by),
    nextUpdateOwnerId: migrationPending ? null : job?.next_update_owner_id ?? null,
    nextUpdateOwnerName: migrationPending ? null : nameOf(job?.next_update_owner_id),
    nextUpdateReminderEnabled: migrationPending ? false : job?.next_update_reminder_enabled === true,
  };
}
