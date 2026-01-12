import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";
import { runQuery } from "@/lib/database/dashboard/utils";

const formatUserName = (user) => {
  if (!user) return "Unknown user";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || user.email || "Unknown user";
};

export const getAdminDashboardData = async () => {
  const todayStart = dayjs().startOf("day").toISOString();
  const todayEnd = dayjs().endOf("day").toISOString();
  const weekStart = dayjs().subtract(7, "day").toISOString();

  const [jobsRes, appointmentsRes, partsRes, usersRes, holidaysRes, noticesRes] = await Promise.all([
    runQuery(() => supabase.from("jobs").select("id", { count: "exact", head: true })),
    runQuery(() =>
      supabase
        .from("appointments")
        .select("appointment_id", { count: "exact", head: true })
        .gte("scheduled_time", todayStart)
        .lt("scheduled_time", todayEnd)
    ),
    runQuery(() => supabase.from("parts_requests").select("request_id", { count: "exact", head: true })),
    runQuery(() =>
      supabase
        .from("users")
        .select("user_id", { count: "exact", head: true })
        .gte("created_at", weekStart)
        .lte("created_at", todayEnd)
    ),
    runQuery(() =>
      supabase
        .from("hr_absences")
        .select("absence_id,user_id,type,start_date,end_date,user:user_id(first_name,last_name,email)")
        .eq("type", "Holiday")
        .gte("start_date", todayStart)
        .lte("start_date", dayjs().add(7, "day").endOf("day").toISOString())
        .order("start_date", { ascending: true })
        .limit(6)
    ),
    runQuery(() =>
      supabase
        .from("notifications")
        .select("notification_id,message,target_role,created_at")
        .order("created_at", { ascending: false })
        .limit(5)
    ),
  ]);

  const holidays = (holidaysRes || []).map((row) => ({
    ...row,
    userName: formatUserName(row.user),
  }));

  return {
    totalJobs: jobsRes.count || 0,
    appointmentsToday: appointmentsRes.count || 0,
    partsRequests: partsRes.count || 0,
    newUsers: usersRes.count || 0,
    holidays,
    notices: noticesRes,
  };
};
