// ✅ Connected to Supabase (server-side)
// file location: src/lib/database/technicians.js
//
// Technician-dashboard data helpers for the Scheduling tab redesign
// (Technician Assignment section): per-technician skill tags and a derived
// "today" workload (hours done vs available, jobs scheduled today).
//
// Skills come from the technician_skills table (display-only in UI v1).
// Daily load is *computed* from existing clocking + appointment data — there
// is no per-day capacity table. All reads are defensive: if a table/column is
// missing the helper returns empty/zeroed defaults so the dashboard still
// renders rather than throwing.
import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();

const DEFAULT_DAILY_HOURS = 8;

const toUserIdList = (userIds) =>
  Array.from(
    new Set(
      (Array.isArray(userIds) ? userIds : [userIds])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && !Number.isNaN(id))
    )
  );

// Local-day [start, end) ISO boundaries for an optional reference date.
const dayBounds = (reference) => {
  const base = reference ? new Date(reference) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startIso: start.toISOString(), endIso: end.toISOString(), ymd: start.toISOString().slice(0, 10) };
};

/* ============================================
   SKILLS
============================================ */

// Returns { [userId]: string[] } for the requested technicians.
export const getTechnicianSkills = async (userIds) => {
  const ids = toUserIdList(userIds);
  if (ids.length === 0) return {};
  try {
    const { data, error } = await db
      .from("technician_skills")
      .select("user_id, skill")
      .in("user_id", ids);
    if (error) throw error;
    const map = {};
    (data || []).forEach((row) => {
      const key = row.user_id;
      if (!map[key]) map[key] = [];
      if (row.skill) map[key].push(row.skill);
    });
    return map;
  } catch (err) {
    console.warn("⚠️ getTechnicianSkills failed (returning empty):", err?.message || err);
    return {};
  }
};

// Replace a technician's skill set with the provided list. Added for a future
// admin editor — not surfaced in the dashboard UI v1.
export const setTechnicianSkills = async (userId, skills = []) => {
  const id = Number(userId);
  if (!Number.isInteger(id)) {
    return { success: false, error: { message: "Valid userId is required" } };
  }
  const clean = Array.from(
    new Set((Array.isArray(skills) ? skills : []).map((s) => String(s).trim()).filter(Boolean))
  );
  try {
    const { error: deleteError } = await db
      .from("technician_skills")
      .delete()
      .eq("user_id", id);
    if (deleteError) throw deleteError;
    if (clean.length > 0) {
      const { error: insertError } = await db
        .from("technician_skills")
        .insert(clean.map((skill) => ({ user_id: id, skill })));
      if (insertError) throw insertError;
    }
    return { success: true };
  } catch (err) {
    console.error("❌ setTechnicianSkills failed:", err);
    return { success: false, error: { message: err?.message || "Failed to save skills" } };
  }
};

/* ============================================
   DAILY LOAD (derived capacity)
============================================ */

// Sum of clocked hours for a set of users on the reference day.
const fetchHoursDoneByUser = async (ids, startIso, endIso, ymd) => {
  const done = {};
  ids.forEach((id) => (done[id] = 0));
  // Prefer time_records (carries a precomputed hours_worked + date column).
  try {
    const { data, error } = await db
      .from("time_records")
      .select("user_id, hours_worked, date")
      .in("user_id", ids)
      .eq("date", ymd);
    if (error) throw error;
    (data || []).forEach((row) => {
      const hrs = Number(row.hours_worked);
      if (Number.isFinite(hrs)) done[row.user_id] = (done[row.user_id] || 0) + hrs;
    });
    return done;
  } catch (err) {
    console.warn("⚠️ fetchHoursDoneByUser: time_records unavailable, trying job_clocking:", err?.message || err);
  }
  // Fallback: derive from job_clocking clock_in/clock_out pairs for today.
  try {
    const { data, error } = await db
      .from("job_clocking")
      .select("user_id, clock_in, clock_out")
      .in("user_id", ids)
      .gte("clock_in", startIso)
      .lt("clock_in", endIso);
    if (error) throw error;
    (data || []).forEach((row) => {
      if (!row.clock_in || !row.clock_out) return;
      const ms = new Date(row.clock_out).getTime() - new Date(row.clock_in).getTime();
      if (ms > 0) done[row.user_id] = (done[row.user_id] || 0) + ms / 3_600_000;
    });
  } catch (err) {
    console.warn("⚠️ fetchHoursDoneByUser: job_clocking unavailable (hours done = 0):", err?.message || err);
  }
  return done;
};

// Job ids each user is assigned to that have an appointment on the reference day.
const fetchJobsTodayByUser = async (ids, startIso, endIso) => {
  const byUser = {};
  ids.forEach((id) => (byUser[id] = []));
  try {
    const { data, error } = await db
      .from("appointments")
      .select("job_id, scheduled_time, job:job_id(id, assigned_to)")
      .gte("scheduled_time", startIso)
      .lt("scheduled_time", endIso)
      .order("scheduled_time", { ascending: true });
    if (error) throw error;
    (data || []).forEach((row) => {
      const assignedTo = row.job?.assigned_to;
      const jobId = row.job?.id ?? row.job_id;
      if (assignedTo != null && byUser[assignedTo] && jobId != null) {
        byUser[assignedTo].push(jobId);
      }
    });
  } catch (err) {
    console.warn("⚠️ fetchJobsTodayByUser unavailable (jobs today = 0):", err?.message || err);
  }
  return byUser;
};

// Returns { [userId]: { hoursDone, hoursAvailable, jobsToday, jobIdsToday } }.
// `contractedHoursByUser` maps userId → weekly contracted hours (from users
// roster) so we can derive a daily figure without an extra query.
export const getTechnicianDailyLoad = async (
  userIds,
  { date, contractedHoursByUser = {} } = {}
) => {
  const ids = toUserIdList(userIds);
  if (ids.length === 0) return {};
  const { startIso, endIso, ymd } = dayBounds(date);

  const [hoursDone, jobsToday] = await Promise.all([
    fetchHoursDoneByUser(ids, startIso, endIso, ymd),
    fetchJobsTodayByUser(ids, startIso, endIso),
  ]);

  const result = {};
  ids.forEach((id) => {
    const weekly = Number(contractedHoursByUser[id]);
    const hoursAvailable =
      Number.isFinite(weekly) && weekly > 0 ? weekly / 5 : DEFAULT_DAILY_HOURS;
    const jobIdsToday = jobsToday[id] || [];
    result[id] = {
      hoursDone: Math.round((hoursDone[id] || 0) * 10) / 10,
      hoursAvailable: Math.round(hoursAvailable * 10) / 10,
      jobsToday: jobIdsToday.length,
      jobIdsToday,
    };
  });
  return result;
};
