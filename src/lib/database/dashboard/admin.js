import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { runQuery } from "@/lib/database/dashboard/utils";
import { ALL_ACCESS_EMAIL, withoutAllAccessUser } from "@/lib/database/allAccessVisibility";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { fetchApprovedStaffAbsences } from "@/lib/hr/staffAbsences";
import {
  dashboardRows, dashboardCount, dashboardWindow, dailySeries, dailySumSeries,
  tally, bucket, delta, sum, readAppointmentWindow, userDisplayName,
} from "@/lib/database/dashboard/managementInsights";

// Invoices are read over a fixed 180-day trailing window rather than the whole
// ledger: it bounds the query, and anything older than six months belongs in
// the accounts reports, not on an at-a-glance admin dashboard.
export const LEDGER_DAYS = 180;

const SETTLED_STATUSES = new Set(["paid", "settled", "cancelled", "void", "credited", "written off"]);
const DRAFT_STATUSES = new Set(["draft", "pending", ""]);

const isSettled = (invoice) => invoice.paid === true || SETTLED_STATUSES.has(String(invoice.payment_status || "").toLowerCase());
const isDraft = (invoice) => !isSettled(invoice) && DRAFT_STATUSES.has(String(invoice.payment_status || "").toLowerCase().trim());

const DEBT_BUCKETS = [
  { label: "Not yet due", test: (days) => days < 0 },
  { label: "0–30 days", test: (days) => days <= 30 },
  { label: "31–60 days", test: (days) => days <= 60 },
  { label: "61–90 days", test: (days) => days <= 90 },
  { label: "Over 90 days", test: () => true },
];

// Booking demand is only readable against the working day, so the strip runs
// 07:00–18:00 and folds anything outside it into a single out-of-hours column.
const BOOKING_HOURS = Array.from({ length: 12 }, (_, index) => index + 7);

const invoiceValue = (invoice) => Number(invoice.grand_total) || Number(invoice.total) || 0;
const invoiceDueDate = (invoice) => invoice.due_date || invoice.invoice_date || invoice.created_at;

export function buildAdminInsights(appointments, window, extras = {}) {
  const { invoices = [], attendance = [], staff = [], absences = [], recentJobs = [] } = extras;
  const inWindow = (value, from, to) => value && dayjs(value).isValid() && !dayjs(value).isBefore(from) && dayjs(value).isBefore(to);

  const current = appointments.filter((row) => inWindow(row.scheduled_time, window.start, window.end));
  const previous = appointments.filter((row) => inWindow(row.scheduled_time, window.previousStart, window.start));
  const today = appointments.filter((row) => dayjs(row.scheduled_time).isSame(window.today, "day"));
  const upcoming = appointments.filter((row) => !dayjs(row.scheduled_time).isBefore(window.today));
  const cancelled = current.filter((row) => String(row.status || "").toLowerCase().includes("cancel"));

  const statuses = new Map();
  for (const row of today) {
    const label = row.status || "Unknown";
    statuses.set(label, (statuses.get(label) || 0) + 1);
  }

  const hourCounts = new Map();
  for (const row of upcoming) {
    const at = dayjs(row.scheduled_time);
    if (!at.isValid()) continue;
    const hour = at.hour();
    const key = BOOKING_HOURS.includes(hour) ? hour : "other";
    hourCounts.set(key, (hourCounts.get(key) || 0) + 1);
  }
  const bookingHours = [
    ...BOOKING_HOURS.map((hour) => ({ label: `${String(hour).padStart(2, "0")}:00`, value: hourCounts.get(hour) || 0 })),
    ...(hourCounts.get("other") ? [{ label: "Other", value: hourCounts.get("other") }] : []),
  ];

  const weekdayCounts = new Map();
  for (const row of current) {
    const at = dayjs(row.scheduled_time);
    if (at.isValid()) weekdayCounts.set(at.format("ddd"), (weekdayCounts.get(at.format("ddd")) || 0) + 1);
  }
  const bookingWeekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .map((label) => ({ label, value: weekdayCounts.get(label) || 0 }));

  const priced = invoices.map((invoice) => ({ ...invoice, value: invoiceValue(invoice) }));
  const currentInvoices = priced.filter((invoice) => inWindow(invoice.created_at, window.start, window.end));
  const previousInvoices = priced.filter((invoice) => inWindow(invoice.created_at, window.previousStart, window.start));
  const outstanding = priced.filter((invoice) => !isSettled(invoice) && !isDraft(invoice));
  const drafts = priced.filter(isDraft);
  const daysOverdue = (invoice) => {
    const due = invoiceDueDate(invoice);
    return due && dayjs(due).isValid() ? window.today.diff(dayjs(due).startOf("day"), "day") : 0;
  };

  const staffById = new Map(staff.map((user) => [user.user_id, user]));
  const attendanceToday = attendance.filter((row) => row.date === window.today.format("YYYY-MM-DD") || dayjs(row.clock_in).isSame(window.today, "day"));
  const onSite = attendanceToday.filter((row) => row.clock_in && !row.clock_out);
  const onBreak = attendanceToday.filter((row) => row.break_start && !row.break_end);

  const activeStaff = staff.filter((user) => user.is_active !== false);
  const absenceToday = absences.filter((row) =>
    !dayjs(row.start_date).isAfter(window.today, "day") && !dayjs(row.end_date).isBefore(window.today, "day"));

  const invoicedTotal = sum(currentInvoices, (invoice) => invoice.value);

  return {
    appointmentsToday: today.length,
    appointmentsUpcoming: upcoming.length,
    appointmentsPeriod: current.length,
    appointmentsDelta: delta(current.length, previous.length),
    cancelledCount: cancelled.length,
    cancellationRate: current.length ? Math.round((cancelled.length / current.length) * 1000) / 10 : null,
    appointments: today,
    upcomingAppointments: upcoming.filter((row) => !dayjs(row.scheduled_time).isSame(window.today, "day")).slice(0, 15),
    appointmentSeries: dailySeries(current, "scheduled_time", window.start, window.days),
    bookingForecast: dailySeries(upcoming, "scheduled_time", window.today, 7),
    appointmentStatuses: [...statuses].map(([label, value]) => ({ label, value })),
    bookingHours,
    bookingWeekdays,

    invoicedTotal,
    invoicedCount: currentInvoices.length,
    invoicedDelta: delta(invoicedTotal, sum(previousInvoices, (invoice) => invoice.value)),
    averageInvoice: currentInvoices.length ? invoicedTotal / currentInvoices.length : 0,
    invoicedSeries: dailySumSeries(currentInvoices, "created_at", "value", window.start, window.days),
    settledTotal: sum(currentInvoices.filter(isSettled), (invoice) => invoice.value),
    outstandingTotal: sum(outstanding, (invoice) => invoice.value),
    outstandingCount: outstanding.length,
    draftTotal: sum(drafts, (invoice) => invoice.value),
    draftCount: drafts.length,
    debtAgeing: bucket(outstanding, DEBT_BUCKETS, daysOverdue),
    oldestOutstanding: [...outstanding].sort((a, b) => daysOverdue(b) - daysOverdue(a)).slice(0, 10)
      .map((invoice) => ({ ...invoice, daysOverdue: daysOverdue(invoice) })),
    paymentMix: tally(priced.filter(isSettled), (invoice) => invoice.payment_method, { limit: 5, fallback: "Not recorded" }),
    ledgerDays: LEDGER_DAYS,

    onSiteCount: onSite.length,
    onBreakCount: onBreak.length,
    attendanceCount: attendanceToday.length,
    activeStaffCount: activeStaff.length,
    inactiveStaffCount: staff.length - activeStaff.length,
    absentTodayCount: absenceToday.length,
    attendance: attendanceToday.map((row) => ({
      ...row,
      name: userDisplayName(staffById.get(row.user_id)),
      role: staffById.get(row.user_id)?.role || "Not recorded",
      state: row.break_start && !row.break_end ? "On break" : row.clock_in && !row.clock_out ? "On site" : row.clock_out ? "Clocked out" : "Not clocked in",
    })).sort((a, b) => a.name.localeCompare(b.name)),
    absences: absences.map((row) => ({ ...row, userName: row.userName || userDisplayName(row.user || staffById.get(row.user_id)) })),
    roleMix: tally(activeStaff, (user) => user.role, { limit: 8 }),
    departmentMix: tally(activeStaff, (user) => user.department, { limit: 8 }),

    jobIntakeSeries: dailySeries(recentJobs, "created_at", window.start, window.days),
    jobSourceMix: tally(recentJobs, (job) => job.job_source, { limit: 5 }),
    jobDivisionMix: tally(recentJobs, (job) => job.job_division),
    jobIntakeCount: recentJobs.length,
  };
}

export const getAdminDashboardData = async (days = 7) => {
  const window = dashboardWindow(days);
  const warnings = [];
  // Leave, notices, revenue and attendance are independent: a failure in one
  // must not erase the operational data the rest of the page is built from.
  const optional = async (label, load) => {
    try { return await load(); } catch { warnings.push(label); return null; }
  };
  const ledgerStart = window.today.subtract(LEDGER_DAYS, "day");

  if (isPresentationMode()) {
    const { getMockRows } = await import("@/features/presentation/mockData");
    const inRange = (value, from, to) => value && dayjs(value).isValid() && !dayjs(value).isBefore(from) && dayjs(value).isBefore(to);
    const appointments = getMockRows("appointments").filter((row) => inRange(row.scheduled_time, window.previousStart, window.today.add(7, "day")));
    const allUsers = withoutAllAccessUser(getMockRows("users"));
    const users = allUsers.filter((row) => inRange(row.created_at, window.start, window.end));
    const parts = getMockRows("parts_requests").filter((row) => row.status === "pending");
    const invoices = getMockRows("invoices").filter((row) => inRange(row.created_at, ledgerStart, window.end));
    const recentJobs = getMockRows("jobs").filter((row) => inRange(row.created_at, window.start, window.end));
    return {
      ...buildAdminInsights(appointments, window, {
        invoices, attendance: getMockRows("clocking"), staff: allUsers, absences: [], recentJobs,
      }),
      totalJobs: getMockRows("jobs").length,
      partsRequests: parts.length, pendingParts: parts.slice(0, 10), newUsers: users.length,
      recentUsers: users.slice(0, 10), holidays: [], notices: getMockRows("notifications").slice(0, 5),
      warnings, days: window.days, updatedAt: window.now.toISOString(),
    };
  }

  const start = window.start.toISOString();
  const end = window.end.toISOString();
  const [totalJobs, appointments, partsRequests, pendingParts, newUsers, recentUsers, staff, invoices, attendance, recentJobs, holidays, notices] = await Promise.all([
    dashboardCount(supabase.from("jobs").select("id", { count: "exact", head: true })),
    readAppointmentWindow(window.previousStart, window.today.add(7, "day")),
    dashboardCount(supabase.from("parts_requests").select("request_id", { count: "exact", head: true }).eq("status", "pending")),
    runQuery(() => supabase.from("parts_requests").select("request_id,description,quantity,created_at,job:job_id(job_number,vehicle_reg)")
      .eq("status", "pending").order("created_at").order("request_id").limit(10)),
    dashboardCount(supabase.from("users").select("user_id", { count: "exact", head: true }).neq("email", ALL_ACCESS_EMAIL).gte("created_at", start).lt("created_at", end)),
    runQuery(() => supabase.from("users").select("user_id,first_name,last_name,role,is_active,created_at")
      .neq("email", ALL_ACCESS_EMAIL).gte("created_at", start).lt("created_at", end).order("created_at", { ascending: false }).order("user_id").limit(10)),
    optional("Staff records are unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("users")
      .select("user_id,first_name,last_name,name,role,department,is_active").neq("email", ALL_ACCESS_EMAIL).order("user_id"))),
    optional("Invoicing figures are unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("invoices")
      .select("invoice_id,invoice_number,job_number,account_number,created_at,invoice_date,due_date,grand_total,total,payment_status,payment_method,paid")
      .gte("created_at", ledgerStart.toISOString()).lt("created_at", end).order("invoice_id"))),
    optional("Attendance is unavailable. Try refreshing.", () => runQuery(() => supabase.from("clocking")
      .select("id,user_id,date,clock_in,clock_out,break_start,break_end,total_hours,status")
      .eq("date", window.today.format("YYYY-MM-DD")).order("user_id").limit(200))),
    optional("Job intake is unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("jobs")
      .select("id,created_at,job_source,job_division,type").gte("created_at", start).lt("created_at", end).order("id"))),
    optional("Holiday cover is unavailable. Try refreshing.", () => fetchApprovedStaffAbsences({
      startDate: window.today.format("YYYY-MM-DD"), endDate: window.today.add(6, "day").format("YYYY-MM-DD"),
    })),
    optional("Notices are unavailable. Try refreshing.", () => runQuery(() => supabase.from("notifications")
      .select("notification_id,message,target_role,created_at").order("created_at", { ascending: false }).limit(5))),
  ]);

  return {
    ...buildAdminInsights(appointments, window, {
      invoices: invoices || [], attendance: attendance || [], staff: staff || [],
      absences: holidays || [], recentJobs: recentJobs || [],
    }),
    totalJobs, partsRequests, pendingParts, newUsers, recentUsers,
    holidays: holidays?.filter((row) => String(row.type || "").toLowerCase() === "holiday")
      .map((row) => ({ ...row, userName: userDisplayName(row.user) })) ?? null,
    hasRevenueData: invoices != null,
    hasAttendanceData: attendance != null,
    notices, warnings, days: window.days, updatedAt: window.now.toISOString(),
  };
};
