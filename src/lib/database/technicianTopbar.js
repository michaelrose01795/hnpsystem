// file location: src/lib/database/technicianTopbar.js
//
// Technician-specific topbar snapshot. Database access stays in the database
// layer while the layout consumes one small, presentation-ready result.
import { getDatabaseClient } from "@/lib/database/client";
import {
  calculateTechTotals,
  getEfficiencyEntries,
  getJobClockingAsEfficiency,
  getOvertimeAsEfficiency,
  getTechTarget,
} from "@/lib/database/efficiency";
import {
  getDayCapacityProgress,
  getJobCapacityDateKey,
  toCapacityDateKey,
} from "@/lib/capacity/technicianCapacity";

const db = getDatabaseClient();

const toStatusKey = (value) => String(value || "").trim().toUpperCase();

const buildRequestProgress = (jobs = []) =>
  jobs.reduce((progressByJobId, job) => {
    const progress = { totalHours: 0, completedHours: 0 };
    (Array.isArray(job?.job_requests) ? job.job_requests : []).forEach((request) => {
      const source = String(request?.request_source || "").trim().toLowerCase();
      if (request?.vhc_item_id || source.includes("vhc")) return;
      const hours = Math.max(0, Number(request?.hours) || 0);
      const status = String(request?.status || "").trim().toLowerCase();
      progress.totalHours += hours;
      if (["complete", "completed", "done"].includes(status)) {
        progress.completedHours += hours;
      }
    });
    progressByJobId[String(job.id)] = progress;
    return progressByJobId;
  }, {});

const normalizeCapacityJob = (job = {}) => ({
  id: job.id,
  status: job.status,
  techCompletionStatus: job.tech_completion_status,
  appointment: Array.isArray(job.appointments) ? job.appointments[0] || null : null,
  vhcChecks: Array.isArray(job.vhc_checks) ? job.vhc_checks : [],
});

/**
 * Loads the live technician figures shown in the staff topbar.
 *
 * - Jobs lined up mirrors the assigned IN PROGRESS panel on Next Jobs and
 *   excludes jobs the technician is actively clocked onto.
 * - Allocated today uses the same job-request/VHC capacity calculation as the
 *   Next Jobs technician row.
 * - Efficiency mirrors the Efficiency page's current-month calculation.
 */
export async function getTechnicianTopbarSnapshot(userId, referenceDate = new Date()) {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) {
    return { jobsLinedUp: 0, allocatedToday: 0, efficiencyPct: 0, queuedJobNumbers: [] };
  }

  const today = toCapacityDateKey(referenceDate);
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;

  const [
    jobsResult,
    activeClockingsResult,
    manualEntries,
    clockingEntries,
    overtimeEntries,
    target,
  ] = await Promise.all([
    db
      .from("jobs")
      .select(`
        id,
        job_number,
        status,
        tech_completion_status,
        assigned_to,
        queue_position,
        appointments(scheduled_time),
        job_requests(hours, status, request_source, vhc_item_id),
        vhc_checks(approval_status, labour_hours, labour_complete, Complete)
      `)
      .eq("assigned_to", normalizedUserId)
      .order("queue_position", { ascending: true, nullsFirst: false }),
    db
      .from("job_clocking")
      .select("job_id")
      .eq("user_id", normalizedUserId)
      .is("clock_out", null),
    getEfficiencyEntries(normalizedUserId, year, month),
    getJobClockingAsEfficiency([normalizedUserId], year, month),
    getOvertimeAsEfficiency([normalizedUserId], year, month),
    getTechTarget(normalizedUserId),
  ]);

  if (jobsResult.error) throw jobsResult.error;
  if (activeClockingsResult.error) throw activeClockingsResult.error;

  const jobs = jobsResult.data || [];
  const activeJobIds = new Set(
    (activeClockingsResult.data || []).map((row) => Number(row.job_id))
  );
  const nextJobsPanel = jobs.filter((job) => toStatusKey(job.status) === "IN PROGRESS");
  const queuedJobs = nextJobsPanel.filter((job) => !activeJobIds.has(Number(job.id)));

  const capacityJobs = nextJobsPanel
    .map(normalizeCapacityJob)
    .filter((job) => getJobCapacityDateKey(job, today) === today);
  const requestProgress = buildRequestProgress(jobs);
  const dayProgress = getDayCapacityProgress(capacityJobs, requestProgress);

  const efficiencyEntries = [
    ...(clockingEntries || []),
    ...(overtimeEntries || []),
    ...(manualEntries || []),
  ];
  const efficiency = calculateTechTotals(efficiencyEntries, target, {
    year,
    month,
    period: "month",
    referenceDate,
  });

  return {
    jobsLinedUp: queuedJobs.length,
    allocatedToday: dayProgress.plannedHours,
    efficiencyPct: efficiency.efficiencyPct,
    queuedJobNumbers: queuedJobs
      .map((job) => job.job_number)
      .filter(Boolean)
      .slice(0, 5),
  };
}
