import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

const followsUpStatuses = (status = "") => {
  const normalized = String(status).toLowerCase();
  return normalized.includes("follow") || normalized.includes("call");
};

export const getAfterSalesDashboardData = async () => {
  const weekStart = dayjs().startOf("week").toISOString();
  const weekEnd = dayjs().endOf("week").toISOString();

  const [
    completedJobs,
    vhcCompleted,
    statusData,
    pendingParts,
    vhcPendingJobs,
    startedJobs,
    completionRows,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id")
        .gte("completed_at", weekStart)
        .lt("completed_at", weekEnd)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id")
        .eq("vhc_required", true)
        .gte("vhc_completed_at", weekStart)
        .lt("vhc_completed_at", weekEnd)
    ),
    runQuery(() =>
      supabase
        .from("job_customer_statuses")
        .select("id,status,job_id,job:job_id(job_number,vehicle_reg)")
        .order("created_at", { ascending: false })
        .limit(8)
    ),
    runQuery(() =>
      supabase
        .from("parts_requests")
        .select("request_id")
        .eq("status", "pending")
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
        .from("jobs")
        .select("id")
        .gte("checked_in_at", weekStart)
        .lt("checked_in_at", weekEnd)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("completed_at")
        .gte("completed_at", weekStart)
    ),
  ]);

  const followUps = (statusData || []).filter((row) => followsUpStatuses(row.status));

  const pendingVhc = (vhcPendingJobs || []).filter(
    (job) => !Array.isArray(job.vhc_authorizations) || job.vhc_authorizations.length === 0
  );

  return {
    counts: {
      jobsCompleted: completedJobs.length,
      vhcsCompleted: vhcCompleted.length,
      pendingParts: pendingParts.length,
      pendingVhc: pendingVhc.length,
    },
    followUps,
    progress: {
      completed: completedJobs.length,
      scheduled: Math.max(startedJobs.length, completedJobs.length, 1),
    },
    trend: {
      jobsCompletedLast7: buildSevenDaySeries(completionRows, "completed_at"),
    },
  };
};
