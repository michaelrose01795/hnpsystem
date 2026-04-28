// file location: src/lib/database/jobActivity.js
// Server-side helper for inserting job_activity_events. Always uses the
// service-role client because most callers run inside API routes where the
// authenticated session has already been validated by withRoleGuard. Failures
// are swallowed and logged — activity logging must never block the user-facing
// action that triggered it.
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const getClient = () => supabaseService || supabase;

const truncate = (value, max = 280) => {
  if (typeof value !== "string") return value;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
};

const coerceUserId = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * Insert a single job activity event.
 *
 * @param {object} params
 * @param {number} params.jobId        Numeric jobs.id (required).
 * @param {string} params.category     'vhc' | 'health_check' | 'files' | 'parts'.
 * @param {string} params.action       Short action key, e.g. 'authorise', 'decline', 'labour_changed'.
 * @param {string} params.summary      Human-readable description shown on the tracker.
 * @param {string} [params.targetType] Optional target row type ('vhc_check', 'job_file', etc).
 * @param {string|number} [params.targetId] Optional target row id.
 * @param {object} [params.payload]    Extra structured context.
 * @param {number} [params.performedBy] users.user_id of the actor.
 */
export async function logJobActivity({
  jobId,
  category,
  action,
  summary,
  targetType = null,
  targetId = null,
  payload = {},
  performedBy = null,
}) {
  if (!jobId || !category || !action || !summary) {
    return { success: false, error: "jobId, category, action and summary are required" };
  }
  try {
    const client = getClient();
    const row = {
      job_id: Number(jobId),
      category: String(category).slice(0, 64),
      action: String(action).slice(0, 64),
      target_type: targetType ? String(targetType).slice(0, 64) : null,
      target_id: targetId !== null && targetId !== undefined ? String(targetId).slice(0, 128) : null,
      summary: truncate(String(summary)),
      payload: payload && typeof payload === "object" ? payload : {},
      performed_by: coerceUserId(performedBy),
      occurred_at: new Date().toISOString(),
    };
    const { error } = await client.from("job_activity_events").insert(row);
    if (error) {
      console.warn("logJobActivity insert failed:", error.message || error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.warn("logJobActivity threw:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Resolve the numeric jobs.id for a given job_number.
 * Returns null if the job cannot be found.
 */
export async function resolveJobIdByNumber(jobNumber) {
  if (jobNumber === null || jobNumber === undefined) return null;
  try {
    const client = getClient();
    const trimmed = String(jobNumber).trim().replace(/^#/, "");
    if (!trimmed) return null;
    const { data } = await client
      .from("jobs")
      .select("id")
      .eq("job_number", trimmed)
      .maybeSingle();
    return data?.id ? Number(data.id) : null;
  } catch (err) {
    console.warn("resolveJobIdByNumber threw:", err?.message || err);
    return null;
  }
}
