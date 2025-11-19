import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getValetingDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [jobs, washStarts] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select(
          "id,job_number,vehicle_reg,status,checked_in_at,wash_started_at,waiting_status,completed_at"
        )
        .order("checked_in_at", { ascending: true })
        .limit(40)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("wash_started_at")
        .gte("wash_started_at", weekStart)
    ),
  ]);

  const waitingQueue = (jobs || []).filter((job) => job.checked_in_at && !job.wash_started_at).slice(0, 6);
  const waitingCount = (jobs || []).filter((job) => job.checked_in_at && !job.wash_started_at).length;
  const washedCount = (jobs || []).filter((job) => Boolean(job.wash_started_at)).length;
  const delayedCount = (jobs || []).filter((job) =>
    String(job.waiting_status || "").toLowerCase().includes("delay")
  ).length;

  return {
    waitingCount,
    washedCount,
    delayedCount,
    waitingQueue,
    trends: buildSevenDaySeries(washStarts, "wash_started_at"),
  };
};
