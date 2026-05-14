import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { runQuery } from "@/lib/database/dashboard/utils";
import { getMockRows } from "@/features/presentation/mockData";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";

const formatUserName = (user) => {
  if (!user) return "Unknown user";
  const parts = [user.first_name, user.last_name].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || user.email || "Unknown user";
};

const buildPresentationAdminDashboardData = () => {
  const today = dayjs();
  const jobs = getMockRows("jobs");
  const appointments = getMockRows("appointments");
  const partsOrders = getMockRows("parts_orders");

  const appointmentsToday = appointments.filter((row) =>
    row?.scheduled_time && dayjs(row.scheduled_time).isSame(today, "day")
  ).length;
  const openPartsRequests = partsOrders.filter((row) =>
    ["pending", "confirmed", "ordered"].includes(String(row?.status || "").toLowerCase())
  ).length;

  const holidayNames = [
    "Amelia Brooks",
    "Daniel Carter",
    "Sophie Patel",
    "Ryan Hughes",
    "Leah Morgan",
    "Oliver James",
  ];

  const holidays = holidayNames.map((userName, index) => {
    const start = today.add(index + 1, "day");
    const end = start.add(index % 3 === 0 ? 2 : index % 2, "day");
    return {
      absence_id: `demo-admin-holiday-${index + 1}`,
      user_id: `demo-admin-user-${index + 1}`,
      userName,
      type: "Holiday",
      start_date: start.toISOString(),
      end_date: end.toISOString(),
    };
  });

  const noticeMessages = [
    "Three leave requests are awaiting admin approval before tomorrow's rota is finalised.",
    "Workshop capacity has been increased for afternoon service bookings.",
    "Parts desk stocktake is scheduled for 16:30 with bay handover support.",
    "Two new user accounts need role checks before access is confirmed.",
    "Accounts team has posted the daily cash-up and supplier invoice summary.",
  ];

  const notices = noticeMessages.map((message, index) => ({
    notification_id: `demo-admin-notice-${index + 1}`,
    message,
    target_role: index % 2 === 0 ? "Admin Manager" : "All Managers",
    created_at: today.subtract(index * 2 + 1, "hour").toISOString(),
  }));

  return {
    totalJobs: jobs.length || 18,
    appointmentsToday: appointmentsToday || 6,
    partsRequests: openPartsRequests || 5,
    newUsers: 6,
    holidays,
    notices,
  };
};

export const getAdminDashboardData = async () => {
  if (isPresentationMode()) {
    return buildPresentationAdminDashboardData();
  }

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
