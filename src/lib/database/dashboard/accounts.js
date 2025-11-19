import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { buildSevenDaySeries, runQuery } from "@/lib/database/dashboard/utils";

export const getAccountsDashboardData = async () => {
  const weekStart = dayjs().subtract(6, "day").startOf("day").toISOString();

  const [
    raisedRes,
    paidRes,
    outstandingJobs,
    completionRows,
  ] = await Promise.all([
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "Invoiced")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "Collected")
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("id,job_number,vehicle_reg,status,customer_id,updated_at")
        .in("status", ["Complete", "Completed"])
        .order("updated_at", { ascending: false })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("jobs")
        .select("completed_at")
        .gte("completed_at", weekStart)
    ),
  ]);

  return {
    invoicesRaised: raisedRes.count || 0,
    invoicesPaid: paidRes.count || 0,
    outstandingJobs,
    trends: buildSevenDaySeries(completionRows, "completed_at"),
  };
};
