import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { runQuery } from "@/lib/database/dashboard/utils";
import { ALL_ACCESS_EMAIL } from "@/lib/database/allAccessVisibility";
import {
  dashboardRows, dashboardCount, dashboardWindow, dailySeries, dailySumSeries, dailyAverageSeries,
  tally, bucket, delta, sum, average, median, userDisplayName,
} from "@/lib/database/dashboard/managementInsights";
import { TECHNICIAN_ROLES } from "@/lib/auth/roles";
import { NORMALIZE, STATUSES, DISPLAY } from "@/lib/status/catalog/job";

const TECHNICIAN_ROLE_KEYS = new Set(TECHNICIAN_ROLES.map((role) => role.toLowerCase()));

// Where an open job is actually stuck. Ordered from the end of the workflow
// backwards so the most advanced blocking state wins — a job with parts on
// order is reported as waiting on parts, not as "in workshop".
export function stageOf(job) {
  if (!job.checked_in_at) return "Awaiting arrival";
  if (job.wash_started_at) return "Wash and valet";
  if ((job.parts_ordered_at || job.warranty_parts_ordered_at) && !job.additional_work_started_at) return "Awaiting parts";
  if (job.additional_work_authorized_at && !job.additional_work_started_at) return "Authorised, not started";
  if (job.vhc_sent_at && !job.additional_work_authorized_at) return "Awaiting authorisation";
  if (job.vhc_required && job.workshop_started_at && !job.vhc_completed_at) return "VHC outstanding";
  if (job.workshop_started_at) return "In workshop";
  if (!job.assigned_to) return "Awaiting allocation";
  return "Allocated, not started";
}

const AGE_BUCKETS = [
  { label: "Not checked in", test: (days) => days == null },
  { label: "0–1 days", test: (days) => days < 2 },
  { label: "2–3 days", test: (days) => days < 4 },
  { label: "4–7 days", test: (days) => days < 8 },
  { label: "8+ days", test: () => true },
];

const TURNAROUND_BUCKETS = [
  { label: "Same day", test: (hours) => hours < 12 },
  { label: "Within 24 hours", test: (hours) => hours < 24 },
  { label: "1–2 days", test: (hours) => hours < 48 },
  { label: "3–4 days", test: (hours) => hours < 96 },
  { label: "5+ days", test: () => true },
];

const PARTS_AGE_BUCKETS = [
  { label: "Under 4 hours", test: (hours) => hours < 4 },
  { label: "4–24 hours", test: (hours) => hours < 24 },
  { label: "1–2 days", test: (hours) => hours < 48 },
  { label: "3+ days", test: () => true },
];

const hoursBetween = (from, to) => {
  if (!from || !to) return null;
  const startAt = dayjs(from);
  const endAt = dayjs(to);
  if (!startAt.isValid() || !endAt.isValid()) return null;
  const value = endAt.diff(startAt, "minute") / 60;
  return value >= 0 ? Math.round(value * 10) / 10 : null;
};

export function buildManagerInsights(openRows, activity, window, extras = {}) {
  const { clocking = [], staff = [], invoices = [], partsQueue = [] } = extras;
  const open = openRows.filter((job) => !job.completed_at &&
    ![STATUSES.RELEASED, STATUSES.CANCELLED].includes(NORMALIZE(job.status)));
  const age = (job) => job.checked_in_at && dayjs(job.checked_in_at).isValid() ? Math.max(0, window.now.diff(dayjs(job.checked_in_at), "day")) : null;
  const overdue = (job) => Boolean(job.next_update_due && dayjs(job.next_update_due).isBefore(window.now));
  const pendingVhc = (job) => Boolean(job.checked_in_at && job.vhc_required && !job.vhc_completed_at);
  const statusCounts = new Map();
  for (const job of open) {
    const label = DISPLAY[NORMALIZE(job.status)] || job.status || "Unknown";
    statusCounts.set(label, (statusCounts.get(label) || 0) + 1);
  }

  const inWindow = (value, from, to) => value && dayjs(value).isValid() && !dayjs(value).isBefore(from) && dayjs(value).isBefore(to);
  const within = (value) => inWindow(value, window.start, window.end);
  const previously = (value) => inWindow(value, window.previousStart, window.start);

  const completed = activity.filter((job) => within(job.completed_at));
  const checkedIn = activity.filter((job) => within(job.checked_in_at));
  const vhcCompleted = activity.filter((job) => within(job.vhc_completed_at));
  const vhcSent = activity.filter((job) => within(job.vhc_sent_at));

  // Turnaround measures the clock the customer feels: arrival to job completion.
  // Jobs completed without a check-in stamp are excluded rather than counted as zero.
  const turnaroundOf = (job) => hoursBetween(job.checked_in_at, job.completed_at);
  const turnarounds = completed.map(turnaroundOf).filter((value) => value != null);
  const previousTurnarounds = activity.filter((job) => previously(job.completed_at)).map(turnaroundOf).filter((value) => value != null);

  const staffById = new Map(staff.map((user) => [user.user_id, user]));
  const hoursByUser = new Map();
  let clockedHours = 0;
  for (const entry of clocking) {
    const hours = hoursBetween(entry.clock_in, entry.clock_out);
    if (hours == null) continue;
    clockedHours += hours;
    hoursByUser.set(entry.user_id, (hoursByUser.get(entry.user_id) || 0) + hours);
  }

  // One row per person carrying work: anybody assigned open jobs, anybody who
  // completed something in the period, and anybody who clocked time. Technicians
  // with a quiet week still appear so a manager can see the gap.
  const workloadIds = new Set([
    ...open.map((job) => job.assigned_to),
    ...completed.map((job) => job.assigned_to),
    ...hoursByUser.keys(),
    ...staff.filter((user) => user.is_active !== false && TECHNICIAN_ROLE_KEYS.has(String(user.role || "").toLowerCase())).map((user) => user.user_id),
  ].filter((id) => id != null));

  const technicians = [...workloadIds].map((userId) => {
    const openJobs = open.filter((job) => job.assigned_to === userId);
    const completedJobs = completed.filter((job) => job.assigned_to === userId);
    const hours = Math.round((hoursByUser.get(userId) || 0) * 10) / 10;
    const jobTurnarounds = completedJobs.map(turnaroundOf).filter((value) => value != null);
    return {
      userId,
      name: userDisplayName(staffById.get(userId)),
      role: staffById.get(userId)?.role || "Not recorded",
      openJobs: openJobs.length,
      overdueJobs: openJobs.filter(overdue).length,
      completedJobs: completedJobs.length,
      hours,
      hoursPerJob: completedJobs.length ? Math.round((hours / completedJobs.length) * 10) / 10 : null,
      avgTurnaroundHours: jobTurnarounds.length ? Math.round(average(jobTurnarounds) * 10) / 10 : null,
    };
  }).sort((a, b) => b.openJobs - a.openJobs || b.completedJobs - a.completedJobs);

  // Invoice totals moved column over time; `grand_total` is the current field
  // and `total` the legacy one, so fall back rather than reporting a false zero.
  const priced = invoices.map((row) => ({
    ...row,
    value: Number(row.grand_total) || Number(row.total) || 0,
    labour: Number(row.labour_total) || Number(row.total_labour) || 0,
    parts: Number(row.parts_total) || Number(row.total_parts) || 0,
  }));
  const previousInvoices = priced.filter((row) => previously(row.created_at));
  const currentInvoices = priced.filter((row) => within(row.created_at));
  const invoicedTotal = sum(currentInvoices, (row) => row.value);

  const authorisedTotal = sum(vhcSent, (job) => job.vhc_authorized_total);
  const declinedTotal = sum(vhcSent, (job) => job.vhc_declined_total);
  const offeredTotal = authorisedTotal + declinedTotal;

  return {
    openCount: open.length,
    agedCount: open.filter((job) => age(job) >= 4).length,
    overdueCount: open.filter(overdue).length,
    unassignedCount: open.filter((job) => job.checked_in_at && !job.assigned_to).length,
    pendingVhcCount: open.filter(pendingVhc).length,
    onSiteCount: open.filter((job) => job.checked_in_at).length,
    waitingCount: open.filter((job) => String(job.waiting_status || "").toLowerCase().includes("wait")).length,

    completedCount: completed.length,
    checkedInCount: checkedIn.length,
    vhcCompletedCount: vhcCompleted.length,
    completedToday: completed.filter((job) => dayjs(job.completed_at).isSame(window.today, "day")).length,
    checkedInToday: checkedIn.filter((job) => dayjs(job.checked_in_at).isSame(window.today, "day")).length,
    dueOutToday: open.filter((job) => job.next_update_due && dayjs(job.next_update_due).isSame(window.today, "day")).length,

    completedDelta: delta(completed.length, activity.filter((job) => previously(job.completed_at)).length),
    checkedInDelta: delta(checkedIn.length, activity.filter((job) => previously(job.checked_in_at)).length),
    turnaroundDelta: delta(
      turnarounds.length ? Math.round(average(turnarounds) * 10) / 10 : 0,
      previousTurnarounds.length ? Math.round(average(previousTurnarounds) * 10) / 10 : 0,
    ),

    completionSeries: dailySeries(completed, "completed_at", window.start, window.days),
    arrivalSeries: dailySeries(checkedIn, "checked_in_at", window.start, window.days),
    vhcSeries: dailySeries(vhcCompleted, "vhc_completed_at", window.start, window.days),
    turnaroundSeries: dailyAverageSeries(completed.filter((job) => turnaroundOf(job) != null), "completed_at", turnaroundOf, window.start, window.days),
    clockedHoursSeries: dailySumSeries(
      clocking.map((entry) => ({ ...entry, hours: hoursBetween(entry.clock_in, entry.clock_out) || 0 })).filter((entry) => within(entry.clock_in)),
      "clock_in", "hours", window.start, window.days,
    ),
    invoicedSeries: dailySumSeries(currentInvoices, "created_at", "value", window.start, window.days),

    statusMix: [...statusCounts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    stageMix: tally(open, stageOf).sort((a, b) => b.value - a.value),
    ageing: bucket(open, AGE_BUCKETS, age),
    typeMix: tally(open, (job) => job.type, { limit: 6 }),
    divisionMix: tally(open, (job) => job.job_division),
    sourceMix: tally(open, (job) => job.job_source, { limit: 5 }),
    turnaroundBuckets: bucket(completed.filter((job) => turnaroundOf(job) != null), TURNAROUND_BUCKETS, turnaroundOf),

    avgTurnaroundHours: turnarounds.length ? Math.round(average(turnarounds) * 10) / 10 : null,
    medianTurnaroundHours: turnarounds.length ? Math.round(median(turnarounds) * 10) / 10 : null,
    clockedHours: Math.round(clockedHours * 10) / 10,
    technicians,

    vhcSentCount: vhcSent.length,
    vhcAuthorisedTotal: authorisedTotal,
    vhcDeclinedTotal: declinedTotal,
    vhcConversionRate: offeredTotal > 0 ? Math.round((authorisedTotal / offeredTotal) * 1000) / 10 : null,

    invoicedTotal,
    invoicedCount: currentInvoices.length,
    labourTotal: sum(currentInvoices, (row) => row.labour),
    partsTotal: sum(currentInvoices, (row) => row.parts),
    averageInvoice: currentInvoices.length ? invoicedTotal / currentInvoices.length : 0,
    invoicedDelta: delta(invoicedTotal, sum(previousInvoices, (row) => row.value)),

    partsQueue: partsQueue.slice(0, 15).map((request) => ({
      ...request,
      ageHours: hoursBetween(request.created_at, window.now),
    })),
    partsAgeing: bucket(partsQueue, PARTS_AGE_BUCKETS, (request) => hoursBetween(request.created_at, window.now) ?? 0),

    attention: [...open].sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || (age(b) ?? -1) - (age(a) ?? -1))
      .slice(0, 15).map((job) => ({ ...job, ageDays: age(job), stage: stageOf(job), technician: userDisplayName(staffById.get(job.assigned_to)), reason: [overdue(job) && "Update overdue", pendingVhc(job) && "VHC incomplete", job.checked_in_at && !job.assigned_to && "Unassigned"].filter(Boolean).join(" · ") || "Open work" })),
    longestOpen: [...open].filter((job) => age(job) != null).sort((a, b) => (age(b) ?? -1) - (age(a) ?? -1))
      .slice(0, 10).map((job) => ({ ...job, ageDays: age(job), stage: stageOf(job), technician: userDisplayName(staffById.get(job.assigned_to)) })),
  };
}

export const getManagersDashboardData = async (days = 7) => {
  const window = dashboardWindow(days);
  const start = window.start.toISOString();
  const end = window.end.toISOString();
  // Activity reaches back a full extra period so the same rows serve both the
  // current figures and the period-on-period comparison without a second query.
  const comparisonStart = window.previousStart.toISOString();
  const warnings = [];
  // Team, revenue and parts detail are supporting context: a failure there must
  // not blank out the operational figures a manager opened the page for.
  const optional = async (label, load) => {
    try { return await load(); } catch { warnings.push(label); return null; }
  };

  const [open, activity, pendingParts, partsQueue, clocking, staff, invoices, escalations] = await Promise.all([
    dashboardRows(() => supabase.from("jobs")
      .select("id,job_number,vehicle_reg,vehicle_make_model,status,type,job_division,job_source,waiting_status,checked_in_at,workshop_started_at,completed_at,wash_started_at,vhc_required,vhc_completed_at,vhc_sent_at,additional_work_authorized_at,additional_work_started_at,parts_ordered_at,warranty_parts_ordered_at,assigned_to,next_update_due")
      .is("completed_at", null).order("id")),
    dashboardRows(() => supabase.from("jobs")
      .select("id,job_number,vehicle_reg,status,type,job_division,assigned_to,checked_in_at,completed_at,vhc_completed_at,vhc_sent_at,vhc_authorized_total,vhc_declined_total")
      .or(`and(completed_at.gte.${comparisonStart},completed_at.lt.${end}),and(checked_in_at.gte.${comparisonStart},checked_in_at.lt.${end}),and(vhc_completed_at.gte.${comparisonStart},vhc_completed_at.lt.${end}),and(vhc_sent_at.gte.${comparisonStart},vhc_sent_at.lt.${end})`).order("id")),
    dashboardCount(supabase.from("parts_requests").select("request_id", { count: "exact", head: true }).eq("status", "pending")),
    optional("Parts queue detail is unavailable. Try refreshing.", () => runQuery(() => supabase.from("parts_requests")
      .select("request_id,description,quantity,created_at,job:job_id(job_number,vehicle_reg)")
      .eq("status", "pending").order("created_at").order("request_id").limit(100))),
    optional("Clocked hours are unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("job_clocking")
      .select("id,user_id,job_id,clock_in,clock_out,work_type").gte("clock_in", start).lt("clock_in", end).order("id"))),
    optional("Team names are unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("users")
      .select("user_id,first_name,last_name,name,role,is_active").neq("email", ALL_ACCESS_EMAIL).order("user_id"))),
    optional("Invoiced value is unavailable. Try refreshing.", () => dashboardRows(() => supabase.from("invoices")
      .select("id,job_number,created_at,grand_total,total,labour_total,parts_total,total_labour,total_parts,payment_status,paid")
      .gte("created_at", comparisonStart).lt("created_at", end).order("id"))),
    optional("Notices are unavailable. Try refreshing.", () => runQuery(() => supabase.from("notifications")
      .select("notification_id,message,target_role,created_at").order("created_at", { ascending: false }).limit(5))),
  ]);

  return {
    ...buildManagerInsights(open, activity, window, {
      clocking: clocking || [], staff: staff || [], invoices: invoices || [], partsQueue: partsQueue || [],
    }),
    pendingParts,
    escalations,
    hasTeamData: staff != null,
    hasRevenueData: invoices != null,
    hasClockingData: clocking != null,
    warnings,
    days: window.days,
    updatedAt: window.now.toISOString(),
  };
};
