// file location: src/lib/mobile/mobileJobs.js
// Server-side data layer for mobile technician jobs. Keeps SQL scoped and consistent
// across the API surface so pages/APIs don't reimplement the same selects.

import { getDatabaseClient } from "@/lib/database/client";
import { logActivity } from "@/lib/database/activity_logs";

const db = getDatabaseClient();

const MOBILE_JOB_COLUMNS = `
  id,
  job_number,
  status,
  description,
  type,
  service_mode,
  service_address,
  service_postcode,
  service_contact_name,
  service_contact_phone,
  appointment_window_start,
  appointment_window_end,
  access_notes,
  mobile_outcome,
  mobile_completed_at,
  redirected_from_mobile_at,
  redirect_reason,
  assigned_to,
  customer_id,
  vehicle_id,
  vehicle_reg,
  vehicle_make_model,
  created_at,
  completed_at,
  technician:assigned_to(user_id, first_name, last_name, role),
  customer:customer_id(id, first_name, last_name, email, phone)
`;

/** List mobile jobs assigned to a given technician, optionally bounded by a date window. */
export async function listMobileJobsForTechnician({ technicianId, fromIso, toIso } = {}) {
  let query = db
    .from("jobs")
    .select(MOBILE_JOB_COLUMNS)
    .eq("service_mode", "mobile")
    .order("appointment_window_start", { ascending: true, nullsFirst: false });

  if (technicianId) query = query.eq("assigned_to", technicianId);
  if (fromIso) query = query.gte("appointment_window_start", fromIso);
  if (toIso) query = query.lte("appointment_window_start", toIso);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list mobile jobs: ${error.message}`);
  return data || [];
}

/** Fetch a single mobile job by job_number (404-style null if missing or not mobile). */
export async function getMobileJobByNumber(jobNumber) {
  if (!jobNumber) return null;
  const { data, error } = await db
    .from("jobs")
    .select(MOBILE_JOB_COLUMNS)
    .eq("job_number", jobNumber)
    .eq("service_mode", "mobile")
    .maybeSingle();
  if (error) throw new Error(`Failed to load mobile job ${jobNumber}: ${error.message}`);
  return data;
}

/** Redirect a mobile job back to the workshop. Preserves history via audit columns. */
export async function redirectMobileJobToWorkshop({ jobNumber, reason, userId }) {
  if (!jobNumber) throw new Error("jobNumber is required");
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from("jobs")
    .update({
      service_mode: "workshop",
      mobile_outcome: "redirected_to_workshop",
      redirected_from_mobile_at: nowIso,
      redirected_from_mobile_by: userId || null,
      redirect_reason: reason || null,
      assigned_to: null,
      status_updated_at: nowIso,
      status_updated_by: userId || null,
    })
    .eq("job_number", jobNumber)
    .eq("service_mode", "mobile")
    .select("id, job_number")
    .maybeSingle();

  if (error) throw new Error(`Failed to redirect job: ${error.message}`);
  if (!data) throw new Error(`Mobile job ${jobNumber} not found`);

  await logActivity({
    userId: userId || null,
    action: `mobile_job_redirected_to_workshop:${jobNumber} reason=${reason || ""}`,
    tableName: "jobs",
    recordId: data.id,
  });

  return data;
}

/** Mark a mobile job completed on-site. Records the outcome and timestamps. */
export async function completeMobileJobOnsite({ jobNumber, notes, userId }) {
  if (!jobNumber) throw new Error("jobNumber is required");
  const nowIso = new Date().toISOString();

  const { data, error } = await db
    .from("jobs")
    .update({
      mobile_outcome: "completed_onsite",
      mobile_completed_at: nowIso,
      completed_at: nowIso,
      status_updated_at: nowIso,
      status_updated_by: userId || null,
    })
    .eq("job_number", jobNumber)
    .eq("service_mode", "mobile")
    .select("id, job_number")
    .maybeSingle();

  if (error) throw new Error(`Failed to complete mobile job: ${error.message}`);
  if (!data) throw new Error(`Mobile job ${jobNumber} not found`);

  await logActivity({
    userId: userId || null,
    action: `mobile_job_completed_onsite:${jobNumber}${notes ? ` notes=${notes}` : ""}`,
    tableName: "jobs",
    recordId: data.id,
  });

  return data;
}

/** Record that a mobile job could not be completed; optionally requests a follow-up or redirect. */
export async function markMobileJobUnableToComplete({ jobNumber, reason, followUp, userId }) {
  if (!jobNumber) throw new Error("jobNumber is required");
  const nowIso = new Date().toISOString();
  const outcome = followUp ? "follow_up_required" : "unable_to_complete";

  const { data, error } = await db
    .from("jobs")
    .update({
      mobile_outcome: outcome,
      redirect_reason: reason || null,
      status_updated_at: nowIso,
      status_updated_by: userId || null,
    })
    .eq("job_number", jobNumber)
    .eq("service_mode", "mobile")
    .select("id, job_number")
    .maybeSingle();

  if (error) throw new Error(`Failed to flag mobile job: ${error.message}`);
  if (!data) throw new Error(`Mobile job ${jobNumber} not found`);

  await logActivity({
    userId: userId || null,
    action: `mobile_job_unable_to_complete:${jobNumber} outcome=${outcome} reason=${reason || ""}`,
    tableName: "jobs",
    recordId: data.id,
  });

  return data;
}

/** Apply mobile-specific fields to an already-created job (called after createFullJob). */
export async function attachMobileFieldsToJob({ jobId, mobileDetails, userId }) {
  if (!jobId || !mobileDetails) return null;
  const patch = {
    service_mode: "mobile",
    service_address: mobileDetails.address || null,
    service_postcode: mobileDetails.postcode || null,
    service_contact_name: mobileDetails.contactName || null,
    service_contact_phone: mobileDetails.contactPhone || null,
    appointment_window_start: mobileDetails.windowStart || null,
    appointment_window_end: mobileDetails.windowEnd || null,
    access_notes: mobileDetails.accessNotes || null,
  };

  const { data, error } = await db
    .from("jobs")
    .update(patch)
    .eq("id", jobId)
    .select("id, job_number")
    .maybeSingle();
  if (error) throw new Error(`Failed to attach mobile fields: ${error.message}`);

  await logActivity({
    userId: userId || null,
    action: `mobile_job_created:${data?.job_number || jobId}`,
    tableName: "jobs",
    recordId: jobId,
  });

  return data;
}
