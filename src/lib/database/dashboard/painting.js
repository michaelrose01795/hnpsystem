import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getPaintingDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [paintJobs, startedRows] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select(
          "id,job_number,vehicle_reg,status,checked_in_at,workshop_started_at,completed_at,updated_at,type,job_categories"
        )
        .or("type.ilike.%paint%,job_categories.cs.{bodyshop}")
        .order("checked_in_at", { ascending: true })
        .limit(40)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("workshop_started_at")
        .gte("workshop_started_at", weekStart)
    ),
  ]);

  const activeQueue = (paintJobs || []).filter((job) => !job.completed_at).slice(0, 6);
  return {
    bodyshopCount: (paintJobs || []).length,
    queue: activeQueue,
    trends: buildSevenDaySeries(startedRows, "workshop_started_at"),
  };
};
