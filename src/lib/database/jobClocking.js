// file location: src/lib/database/jobClocking.js

import { supabase } from "../supabaseClient"; // Supabase client
import { // Auto status helpers
  autoSetWorkshopStatus,
  autoSetAdditionalWorkInProgressStatus,
  autoSetBeingWashedStatus
} from "../services/jobStatusService"; // Status service

const MAX_INT32 = 2147483647; // Postgres INTEGER max
const MIN_INT32 = -2147483648; // Postgres INTEGER min

// Coerce to 32-bit integer and validate bounds
const toInt = (val, name) => { // Guard function for integer FKs
  if (val === null || val === undefined) throw new Error(`${name} is required`); // required
  const n = Number(val); // numeric cast
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`); // integer only
  if (n > MAX_INT32 || n < MIN_INT32) throw new Error(`${name} is out of range for type integer`); // bounds
  return n; // ok
};

// Normalise a department/role combination down to a coarse category
const inferDepartmentCategory = (department = "", role = "") => {
  const text = `${department} ${role}`.toLowerCase();
  if (/(valet|valeting|wash)/.test(text)) return "valeting";
  if (/(tech|technician|workshop|mot)/.test(text)) return "workshop";
  return null;
};

// Format a user's full name for status audit logging
const formatUserName = (user) => {
  if (!user) return "Unknown";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "Unknown";
};

/* ============================================
   CLOCK IN TO JOB
============================================ */
export const clockInToJob = async (userId, jobId, jobNumber, workType = "initial") => {
  const userIdInt = toInt(userId, "userId"); // ✅ enforce int32
  const jobIdInt = toInt(jobId, "jobId"); // ✅ enforce int32
  const jobNumberText = String(jobNumber || ""); // text
  const workTypeText = String(workType || "initial"); // text

  console.log(`🔧 Clocking in: User ${userIdInt} → Job ${jobNumberText} (${workTypeText})`); // log

  try {
    // Ensure technician is not already clocked into another active job
    const { data: activeJobs, error: activeJobsError } = await supabase
      .from("job_clocking")
      .select("id, job_id, job_number")
      .eq("user_id", userIdInt)
      .is("clock_out", null);

    if (activeJobsError && activeJobsError.code !== "PGRST116") throw activeJobsError;

    const conflictingJob = (activeJobs || []).find((entry) => entry.job_id !== jobIdInt);
    if (conflictingJob) {
      const jobLabel = conflictingJob.job_number || `ID ${conflictingJob.job_id}`;
      return {
        success: false,
        error: `Already clocked onto Job ${jobLabel}. Please clock out before starting another job.`,
        data: conflictingJob
      };
    }

    const { data: existingClock, error: checkError } = await supabase
      .from("job_clocking")
      .select("*")
      .eq("user_id", userIdInt)
      .eq("job_id", jobIdInt)
      .is("clock_out", null)
      .maybeSingle(); // open row?

    if (checkError && checkError.code !== "PGRST116") throw checkError; // real error
    if (existingClock) {
      return { success: false, error: "Already clocked into this job", data: existingClock }; // avoid dup
    }

    const nowIso = new Date().toISOString(); // timestamp
    const { data: clockData, error: insertError } = await supabase
      .from("job_clocking")
      .insert([{
        user_id: userIdInt, // int
        job_id: jobIdInt, // int
        job_number: jobNumberText, // text
        clock_in: nowIso, // ts
        work_type: workTypeText, // text
        created_at: nowIso // ts
      }])
      .select()
      .single(); // return row

    if (insertError) throw insertError; // stop on error

    // Optional: set job status automatically
    try {
      const { data: userData, error: userErr } = await supabase
        .from("users")
        .select("first_name, last_name, department, role")
        .eq("user_id", userIdInt)
        .maybeSingle();

      if (userErr && userErr.code !== "PGRST116") throw userErr;

      const departmentCategory = inferDepartmentCategory(userData?.department, userData?.role);

      if (departmentCategory === "valeting") {
        await autoSetBeingWashedStatus(jobIdInt, userIdInt);
      } else if (workTypeText === "additional") {
        await autoSetAdditionalWorkInProgressStatus(jobIdInt, userIdInt);
      } else if (departmentCategory === "workshop" || workTypeText === "initial") {
        const techName = formatUserName(userData);
        await autoSetWorkshopStatus(jobIdInt, userIdInt, techName);
      } else {
        console.log(
          "ℹ️ No auto status update for department",
          userData?.department || userData?.role || "unknown"
        );
      }
    } catch (statusErr) {
      console.warn("⚠️ Auto-status update failed:", statusErr?.message || statusErr);
    }

    return { success: true, data: clockData }; // success
  } catch (error) {
    console.error("❌ Error clocking in to job:", error); // log
    return { success: false, error: error.message }; // clean error
  }
};

/* ============================================
   CLOCK OUT FROM JOB
============================================ */
export const clockOutFromJob = async (userId, jobId, clockingId = null) => {
  const userIdInt = toInt(userId, "userId"); // int32
  const jobIdInt =
    jobId === null || jobId === undefined ? null : toInt(jobId, "jobId"); // optional
  const clockingIdInt =
    clockingId === null || clockingId === undefined ? null : toInt(clockingId, "clockingId"); // optional

  if (clockingIdInt == null && jobIdInt == null) {
    throw new Error("clockOutFromJob requires a jobId or clockingId");
  }

  const logContext =
    clockingIdInt != null
      ? `clocking record ${clockingIdInt}`
      : `Job ${jobIdInt}`;
  console.log(`⏸️ Clocking out: User ${userIdInt} from ${logContext}`); // log

  try {
    let query = supabase
      .from("job_clocking")
      .select("*")
      .eq("user_id", userIdInt)
      .is("clock_out", null);

    if (clockingIdInt != null) {
      query = query.eq("id", clockingIdInt).limit(1);
    } else {
      query = query.eq("job_id", jobIdInt).order("clock_in", { ascending: false }).limit(1);
    }

    const { data: activeClocking, error: findError } = await query.maybeSingle(); // open row

    if (findError && findError.code !== "PGRST116") throw findError; // real error
    if (!activeClocking) {
      const msg =
        clockingIdInt != null
          ? "No active clock-in found for this entry"
          : "No active clock-in found for this job";
      return { success: false, error: msg };
    }

    const clockOutTime = new Date().toISOString(); // ts
    const { data: updatedClock, error: updateError } = await supabase
      .from("job_clocking")
      .update({ clock_out: clockOutTime, updated_at: clockOutTime })
      .eq("id", activeClocking.id)
      .select()
      .single(); // updated row

    if (updateError) throw updateError; // stop on error

    const start = new Date(activeClocking.clock_in).getTime(); // ms
    const end = new Date(clockOutTime).getTime(); // ms
    const hoursWorked = Math.max(0, (end - start) / 3600000); // hours

    return { success: true, data: updatedClock, hoursWorked: hoursWorked.toFixed(2) }; // ok
  } catch (error) {
    console.error("❌ Error clocking out from job:", error); // log
    return { success: false, error: error.message }; // clean error
  }
};

/* ============================================
   GET USER'S ACTIVE JOBS
============================================ */
export const getUserActiveJobs = async (userId) => {
  const userIdInt = toInt(userId, "userId"); // int32
  console.log(`🔍 Fetching active jobs for user ${userIdInt}`); // log

  try {
    const { data, error } = await supabase
      .from("job_clocking")
      .select(`
        id,
        job_id,
        job_number,
        clock_in,
        work_type,
        job:job_id (
          id,
          job_number,
          vehicle_reg,
          vehicle_make_model,
          status
        )
      `)
      .eq("user_id", userIdInt)
      .is("clock_out", null)
      .order("clock_in", { ascending: false });

    if (error) throw error; // stop

    const nowMs = Date.now(); // now
    const formatted = (data || []).map(c => { // map rows
      const job = c.job || {};
      const hours = Math.max(0, (nowMs - new Date(c.clock_in).getTime()) / 3600000);
      return {
        clockingId: c.id,
        jobId: c.job_id,
        jobNumber: c.job_number || job.job_number,
        clockIn: c.clock_in,
        workType: c.work_type,
        hoursWorked: hours.toFixed(2),
        reg: job.vehicle_reg || "N/A",
        makeModel: job.vehicle_make_model || "N/A",
        customer: "N/A",
        status: job.status || "Unknown"
      };
    });

    return { success: true, data: formatted }; // ok
  } catch (error) {
    console.error("❌ Error fetching active jobs:", error); // log
    return { success: false, error: error.message, data: [] }; // clean error
  }
};
