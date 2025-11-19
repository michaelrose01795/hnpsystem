import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getWorkshopDashboardData = async () => {
  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [
    inProgressJobs,
    checkedInTodayJobs,
    completedTodayJobs,
    technicianUsers,
    clockedInEntries,
    queueJobs,
    outstandingVhcJobs,
    statusHistory,
    checkIns,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select("job_number,vehicle_reg,status,checked_in_at")
        .is("completed_at", null)
        .not("checked_in_at", "is", null)
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
        .from("jobs")
        .select("id")
        .gte("completed_at", todayStart)
        .lt("completed_at", todayEnd)
    ),
    runQuery(() => supabase.from("users").select("user_id").ilike("role", "%tech%")),
    runQuery(() => supabase.from("job_clocking").select("user_id").is("clock_out", null)),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,status,waiting_status,checked_in_at")
        .is("completed_at", null)
        .order("checked_in_at", { ascending: true, nullsFirst: true })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,waiting_status,vhc_required,checked_in_at")
        .eq("vhc_required", true)
        .is("vhc_completed_at", null)
        .order("checked_in_at", { ascending: true, nullsFirst: true })
        .limit(5)
    ),
    runQuery(() =>
      supabase
        .from("job_status_history")
        .select("id,job_id,from_status,to_status,changed_at,job:job_id(job_number,vehicle_reg)")
        .order("changed_at", { ascending: false })
        .limit(5)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("checked_in_at")
        .gte("checked_in_at", weekStart)
        .not("checked_in_at", "is", null)
    ),
  ]);

  return {
    dailySummary: {
      inProgress: inProgressJobs.length,
      checkedInToday: checkedInTodayJobs.length,
      completedToday: completedTodayJobs.length,
    },
    technicianAvailability: {
      totalTechnicians: technicianUsers.length,
      onJobs: clockedInEntries.length,
      available: Math.max(technicianUsers.length - clockedInEntries.length, 0),
    },
    progress: {
      completed: completedTodayJobs.length,
      scheduled: Math.max(checkedInTodayJobs.length, completedTodayJobs.length, 1),
    },
    queue: queueJobs,
    outstandingVhc: outstandingVhcJobs,
    trends: {
      checkInsLast7: buildSevenDaySeries(checkIns, "checked_in_at"),
    },
    latestStatusUpdates: statusHistory,
  };
};
