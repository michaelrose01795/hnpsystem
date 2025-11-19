import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getMotDashboardData = async () => {
  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [
    testsTodayRes,
    passRes,
    failRes,
    retestRes,
    recentData,
    trendRows,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "MOT")
        .gte("checked_in_at", todayStart)
        .lt("checked_in_at", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "MOT")
        .ilike("completion_status", "%pass%")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "MOT")
        .ilike("completion_status", "%fail%")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("type", "MOT")
        .ilike("completion_status", "%retest%")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,completion_status,checked_in_at")
        .eq("type", "MOT")
        .order("checked_in_at", { ascending: false })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("checked_in_at")
        .eq("type", "MOT")
        .gte("checked_in_at", weekStart)
    ),
  ]);

  return {
    testsToday: testsTodayRes.count || 0,
    passCount: passRes.count || 0,
    failCount: failRes.count || 0,
    retestCount: retestRes.count || 0,
    recentTests: recentData,
    trends: buildSevenDaySeries(trendRows, "checked_in_at"),
  };
};
