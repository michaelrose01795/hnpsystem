// file location: src/lib/hr/hrTabSummaries.js
// Derives the "at a glance" figures shown by <HrSummaryStrip> at the top of each
// HR manager tab. Pure functions over the datasets the tabs already load
// (getHrOperationsSnapshot / getHrAttendanceSnapshot in
// src/lib/database/hr.js) — no fetching, no fabricated numbers: if a dataset is
// empty the tile reads 0 rather than a placeholder.
//
// Business logic lives here rather than in the page components (CLAUDE.md §4.3).

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const lower = (value) => String(value ?? "").toLowerCase();

const isSameDay = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// True when [start, end] overlaps the window [from, from + days).
const overlapsWindow = (start, end, from, days) => {
  const s = toDate(start);
  if (!s) return false;
  const e = toDate(end) || s;
  const until = new Date(from.getTime() + days * DAY_MS);
  return s < until && e >= from;
};

const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

const round = (value, dp = 1) => {
  const factor = 10 ** dp;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const plural = (count, word) => `${word}${count === 1 ? "" : "s"}`;

/* ------------------------------------------------------------------ Attendance */
export function buildAttendanceSummary({ attendanceLogs = [], overtimeSummaries = [], absenceRecords = [] } = {}) {
  const today = startOfToday();
  const loggedToday = attendanceLogs.filter((log) => isSameDay(toDate(log.date), today));
  const stillClockedIn = loggedToday.filter((log) => log.clockIn && !log.clockOut).length;
  const hoursToday = round(sum(loggedToday, (log) => log.totalHours));
  const overtimeHours = round(sum(overtimeSummaries, (row) => row.overtimeHours));
  const awayToday = absenceRecords.filter((record) =>
    overlapsWindow(record.startDate, record.endDate, today, 1)
  ).length;
  const pendingAbsences = absenceRecords.filter((record) => lower(record.approvalStatus) === "pending").length;

  return [
    {
      icon: "🕒",
      label: "Clocked in today",
      primary: `${loggedToday.length}`,
      secondary: `${stillClockedIn} still on site`,
      tone: "neutral",
    },
    {
      icon: "⏱️",
      label: "Hours logged today",
      primary: `${hoursToday}`,
      secondary: `across ${loggedToday.length} ${plural(loggedToday.length, "shift")}`,
      tone: "neutral",
    },
    {
      icon: "🌴",
      label: "Away today",
      primary: `${awayToday}`,
      secondary: pendingAbsences ? `${pendingAbsences} awaiting approval` : "all absences approved",
      tone: awayToday > 0 ? "warning" : "success",
    },
    {
      icon: "💷",
      label: "Overtime this period",
      primary: `${overtimeHours} hrs`,
      secondary: `${overtimeSummaries.length} ${plural(overtimeSummaries.length, "employee")}`,
      tone: "neutral",
    },
  ];
}

/* --------------------------------------------------------------------- Payroll */
export function buildPayrollSummary({ employeeDirectory = [], overtimeSummaries = [], payRateHistory = [] } = {}) {
  const paid = employeeDirectory.filter((employee) => Number(employee.hourlyRate) > 0);
  const averageRate = paid.length ? round(sum(paid, (e) => e.hourlyRate) / paid.length, 2) : 0;
  // Contracted hours are weekly; 52/12 converts the weekly run rate to a month.
  const monthlyWageBill = Math.round(
    sum(employeeDirectory, (e) => (Number(e.hourlyRate) || 0) * (Number(e.contractedHours) || 0)) * (52 / 12)
  );
  const overtimeHours = round(sum(overtimeSummaries, (row) => row.overtimeHours));
  const overtimeReady = overtimeSummaries.filter((row) => lower(row.status) === "ready").length;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const changesThisMonth = payRateHistory.filter((entry) => {
    const effective = toDate(entry.effectiveDate);
    return effective && effective >= monthStart;
  }).length;

  return [
    {
      icon: "👥",
      label: "On payroll",
      primary: `${employeeDirectory.length}`,
      secondary: `${paid.length} with a rate set`,
      tone: paid.length < employeeDirectory.length ? "warning" : "neutral",
    },
    {
      icon: "💰",
      label: "Est. monthly wage bill",
      primary: `£${monthlyWageBill.toLocaleString("en-GB")}`,
      secondary: "contracted hours × rate",
      tone: "neutral",
    },
    {
      icon: "📈",
      label: "Average hourly rate",
      primary: `£${averageRate.toFixed(2)}`,
      secondary: `${paid.length} ${plural(paid.length, "employee")}`,
      tone: "neutral",
    },
    {
      icon: "⏱️",
      label: "Overtime to pay",
      primary: `${overtimeHours} hrs`,
      secondary: `${overtimeReady} ready to process`,
      tone: overtimeReady > 0 ? "warning" : "neutral",
    },
    {
      icon: "🧾",
      label: "Pay changes this month",
      primary: `${changesThisMonth}`,
      secondary: `${payRateHistory.length} in audit trail`,
      tone: "neutral",
    },
  ];
}

/* ----------------------------------------------------------------------- Leave */
export function buildLeaveSummary({ leaveRequests = [], leaveBalances = [], upcomingAbsences = [] } = {}) {
  const today = startOfToday();
  const pending = leaveRequests.filter((request) => lower(request.status) === "pending").length;
  const approvedUpcoming = leaveRequests.filter((request) => {
    const start = toDate(request.startDate);
    return lower(request.status) === "approved" && start && start >= today;
  }).length;
  const remainingDays = Math.round(sum(leaveBalances, (row) => row.remaining));
  const entitlementDays = Math.round(sum(leaveBalances, (row) => row.entitlement));
  const awayThisWeek = upcomingAbsences.filter((absence) =>
    overlapsWindow(absence.startDate, absence.endDate, today, 7)
  ).length;

  return [
    {
      icon: "📥",
      label: "Awaiting approval",
      primary: `${pending}`,
      secondary: `of ${leaveRequests.length} ${plural(leaveRequests.length, "request")}`,
      tone: pending > 0 ? "warning" : "success",
    },
    {
      icon: "✅",
      label: "Approved upcoming",
      primary: `${approvedUpcoming}`,
      secondary: "booked from today",
      tone: "success",
    },
    {
      icon: "📅",
      label: "Away in next 7 days",
      primary: `${awayThisWeek}`,
      secondary: "check cover before approving",
      tone: awayThisWeek > 0 ? "warning" : "neutral",
    },
    {
      icon: "🏖️",
      label: "Team days remaining",
      primary: `${remainingDays}`,
      secondary: `of ${entitlementDays} entitled (${pct(remainingDays, entitlementDays)}%)`,
      tone: "neutral",
    },
  ];
}

/* ----------------------------------------------------------------- Performance */
export function buildPerformanceSummary({ performanceReviews = [], departmentPerformance = [] } = {}) {
  const today = startOfToday();
  const rated = performanceReviews.filter((review) => Number(review.overall) > 0);
  const averageRating = rated.length ? round(sum(rated, (r) => r.overall) / rated.length, 1) : 0;
  const overdue = performanceReviews.filter((review) => {
    const next = toDate(review.nextReview);
    return next && next < today && lower(review.status) !== "completed";
  }).length;
  const dueThisMonth = performanceReviews.filter((review) =>
    overlapsWindow(review.nextReview, review.nextReview, today, 30)
  ).length;
  const completed = performanceReviews.filter((review) => lower(review.status) === "completed").length;

  return [
    {
      icon: "⭐",
      label: "Average rating",
      primary: rated.length ? `${averageRating} / 5` : "—",
      secondary: `${rated.length} scored ${plural(rated.length, "review")}`,
      tone: averageRating >= 4 ? "success" : averageRating > 0 && averageRating < 3 ? "warning" : "neutral",
    },
    {
      icon: "🗓️",
      label: "Due in next 30 days",
      primary: `${dueThisMonth}`,
      secondary: "schedule the one-to-ones",
      tone: dueThisMonth > 0 ? "warning" : "neutral",
    },
    {
      icon: "⚠️",
      label: "Overdue reviews",
      primary: `${overdue}`,
      secondary: overdue ? "past their review date" : "nothing outstanding",
      tone: overdue > 0 ? "danger" : "success",
    },
    {
      icon: "✅",
      label: "Completed",
      primary: `${completed}`,
      secondary: `of ${performanceReviews.length} tracked`,
      tone: "success",
    },
    {
      icon: "🏢",
      label: "Departments scored",
      primary: `${departmentPerformance.length}`,
      secondary: "rolling 30-day snapshot",
      tone: "neutral",
    },
  ];
}

/* -------------------------------------------------------------------- Training */
// NOTE: getTrainingRenewals() in src/lib/database/hr.js already narrows to
// assignments due between today and +90 days, so every figure here is scoped to
// that same 90-day horizon — exactly the rows the renewals table below shows.
// Nothing here claims to be a whole-company compliance score.
export function buildTrainingSummary({ trainingRenewals = [] } = {}) {
  const today = startOfToday();
  const dueWithin = (days) =>
    trainingRenewals.filter((row) => {
      const due = toDate(row.dueDate);
      return due && due >= today && due < new Date(today.getTime() + days * DAY_MS);
    }).length;

  const due30 = dueWithin(30);
  const overdue = trainingRenewals.filter((row) => lower(row.status) === "overdue").length;
  const dueSoon = trainingRenewals.filter((row) => lower(row.status) === "due soon").length;
  const employees = new Set(trainingRenewals.map((row) => row.employee).filter(Boolean)).size;

  return [
    {
      icon: "🎓",
      label: "Renewals due (90 days)",
      primary: `${trainingRenewals.length}`,
      secondary: `${employees} ${plural(employees, "employee")} affected`,
      tone: "neutral",
    },
    {
      icon: "⏳",
      label: "Due in 30 days",
      primary: `${due30}`,
      secondary: "book the refresher now",
      tone: due30 > 0 ? "warning" : "success",
    },
    {
      icon: "🔔",
      label: "Flagged due soon",
      primary: `${dueSoon}`,
      secondary: "inside the 14-day warning window",
      tone: dueSoon > 0 ? "warning" : "neutral",
    },
    {
      icon: "🚫",
      label: "Overdue",
      primary: `${overdue}`,
      secondary: overdue ? "certification lapsed" : "nothing lapsed",
      tone: overdue > 0 ? "danger" : "success",
    },
  ];
}

/* ---------------------------------------------------------------- Disciplinary */
export function buildDisciplinarySummary({ activeWarnings = [], incidentLog = [] } = {}) {
  const level = (row) => lower(row.warningLevel);
  const finals = activeWarnings.filter((row) => level(row).includes("final")).length;
  const written = activeWarnings.filter((row) => level(row).includes("written")).length;
  const verbal = activeWarnings.filter((row) => level(row).includes("verbal")).length;
  const openCases = activeWarnings.filter((row) => lower(row.status) !== "closed").length;

  return [
    {
      icon: "⚠️",
      label: "Active warnings",
      primary: `${activeWarnings.length}`,
      secondary: `${openCases} still open`,
      tone: activeWarnings.length > 0 ? "warning" : "success",
    },
    {
      icon: "🔴",
      label: "Final warnings",
      primary: `${finals}`,
      secondary: "escalation risk",
      tone: finals > 0 ? "danger" : "success",
    },
    {
      icon: "📝",
      label: "Written warnings",
      primary: `${written}`,
      secondary: `${verbal} verbal on file`,
      tone: "neutral",
    },
    {
      icon: "📋",
      label: "Incidents logged",
      primary: `${incidentLog.length}`,
      secondary: "full audit trail retained",
      tone: "neutral",
    },
  ];
}

/* ----------------------------------------------------------------- Recruitment */
export function buildRecruitmentSummary({
  openRoles = [],
  applicants = [],
  recruitmentTasks = [],
  onboardingTasks = [],
} = {}) {
  const applicantCount = openRoles.length ? sum(openRoles, (role) => role.applicantCount) : applicants.length;
  const interviewing = applicants.filter((applicant) => lower(applicant.stage).includes("interview")).length;
  const offers = applicants.filter((applicant) => lower(applicant.stage).includes("offer")).length;
  const openTasks = recruitmentTasks.filter((task) => lower(task.status) !== "complete").length;
  const onboardingOutstanding = onboardingTasks.filter((task) => lower(task.status) !== "complete").length;

  return [
    {
      icon: "📣",
      label: "Open roles",
      primary: `${openRoles.length}`,
      secondary: "currently advertised",
      tone: "neutral",
    },
    {
      icon: "🧑‍💼",
      label: "Applicants",
      primary: `${applicantCount}`,
      secondary: `${interviewing} at interview stage`,
      tone: "neutral",
    },
    {
      icon: "🤝",
      label: "Offers out",
      primary: `${offers}`,
      secondary: "awaiting acceptance",
      tone: offers > 0 ? "success" : "neutral",
    },
    {
      icon: "✅",
      label: "Hiring tasks open",
      primary: `${openTasks}`,
      secondary: `${onboardingOutstanding} onboarding ${plural(onboardingOutstanding, "step")} left`,
      tone: openTasks > 0 ? "warning" : "success",
    },
  ];
}
