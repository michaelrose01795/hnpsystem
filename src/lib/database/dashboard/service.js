import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSeverityWeeklySeries, buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

const isMatchingStatus = (status = "", keyword) => String(status).toLowerCase().includes(keyword);

export const getServiceDashboardData = async () => {
  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [
    appointmentsToday,
    completedJobsToday,
    scheduledJobsToday,
    appointmentTrendRows,
    customerStatuses,
    upcomingJobs,
    vhcCandidates,
    severityChecks,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("appointments")
        .select("appointment_id")
        .gte("scheduled_time", todayStart)
        .lt("scheduled_time", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id")
        .gte("completed_at", todayStart)
        .lt("completed_at", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id")
        .gte("checked_in_at", todayStart)
        .lt("checked_in_at", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("appointments")
        .select("scheduled_time")
        .gte("scheduled_time", weekStart)
        .lte("scheduled_time", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("job_customer_statuses")
        .select("id,status,job_id,job:job_id(job_number,vehicle_reg)")
        .order("created_at", { ascending: false })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,status,checked_in_at")
        .not("status", "in", ["Completed", "Complete", "Cancelled", "Collected"])
        .order("created_at", { ascending: true })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,checked_in_at,vhc_authorizations(id)")
        .eq("vhc_required", true)
        .is("vhc_completed_at", null)
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("vhc_checks")
        .select("job_id,issue_title,issue_description,section,created_at")
        .gte("created_at", weekStart)
    ),
  ]);

  const statusCounts = (customerStatuses || []).reduce((acc, row) => {
    const key = (row.status || "Unknown").trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const statusBreakdown = Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([status, count]) => ({ status, count }));

  const waitingTotal = Object.entries(statusCounts).reduce(
    (total, [status, count]) => (isMatchingStatus(status, "waiting") ? total + count : total),
    0
  );
  const loanTotal = Object.entries(statusCounts).reduce(
    (total, [status, count]) => (isMatchingStatus(status, "loan") ? total + count : total),
    0
  );
  const collectionTotal = Object.entries(statusCounts).reduce(
    (total, [status, count]) => (isMatchingStatus(status, "collection") ? total + count : total),
    0
  );

  return {
    appointmentsToday: appointmentsToday.length,
    appointmentTrends: buildSevenDaySeries(appointmentTrendRows, "scheduled_time"),
    customerStatuses: statusBreakdown,
    waitingBreakdown: {
      waiting: waitingTotal,
      loan: loanTotal,
      collection: collectionTotal,
    },
    upcomingJobs,
    awaitingVhc: (vhcCandidates || []).filter(
      (job) => !Array.isArray(job.vhc_authorizations) || job.vhc_authorizations.length === 0
    ),
    vhcSeverityTrend: buildSeverityWeeklySeries(severityChecks, "created_at"),
    progress: {
      completed: completedJobsToday.length,
      scheduled: Math.max(scheduledJobsToday.length, completedJobsToday.length, 1),
    },
  };
};
