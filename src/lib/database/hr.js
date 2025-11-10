// file location: src/lib/database/hr.js
import dayjs from "dayjs";
import { supabase } from "../supabaseClient";

const DEFAULT_ATTENDANCE_LIMIT = 50;

function formatEmployee(user) {
  if (!user) return { id: null, name: "Unknown" };
  const id = user.user_id ?? user.id ?? null;
  const first = user.first_name || "";
  const last = user.last_name || "";
  const name = `${first} ${last}`.trim() || user.email || `User ${id ?? ""}`.trim();
  return { id, name };
}

export async function getAttendanceLogs({ startDate, endDate, limit = DEFAULT_ATTENDANCE_LIMIT } = {}) {
  const effectiveEnd = endDate || dayjs().format("YYYY-MM-DD");
  const effectiveStart =
    startDate || dayjs(effectiveEnd).subtract(30, "day").format("YYYY-MM-DD");

  let query = supabase
    .from("time_records")
    .select(
      `
        id,
        user_id,
        job_id,
        job_number,
        date,
        clock_in,
        clock_out,
        hours_worked,
        break_minutes,
        notes,
        user:user_id (
          user_id,
          first_name,
          last_name,
          email
        )
      `
    )
    .gte("date", effectiveStart)
    .lte("date", effectiveEnd)
    .order("clock_in", { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("❌ getAttendanceLogs error", error);
    throw error;
  }

  return (data || []).map((record) => {
    const employee = formatEmployee(record.user);
    const hours = Number(record.hours_worked || 0);

    let status = "Clocked In";
    if (record.clock_out && hours >= 9) status = "Overtime";
    else if (record.clock_out) status = "On Time";

    return {
      id: record.id,
      employeeId: employee.name,
      employeeName: employee.name,
      date: record.date,
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      totalHours: hours,
      status,
    };
  });
}

export async function getAbsenceRecords({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("hr_absences")
    .select(
      `
        absence_id,
        user_id,
        type,
        start_date,
        end_date,
        approval_status,
        notes,
        user:user_id(
          user_id,
          first_name,
          last_name,
          email
        )
      `
    )
    .order("start_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getAbsenceRecords error", error);
    throw error;
  }

  return (data || []).map((absence) => {
    const employee = formatEmployee(absence.user);
    return {
      id: absence.absence_id,
      employee: employee.name,
      type: absence.type,
      startDate: absence.start_date,
      endDate: absence.end_date,
      approvalStatus: absence.approval_status,
      notes: absence.notes,
    };
  });
}

export async function getCurrentOvertimePeriod() {
  const { data, error } = await supabase
    .from("overtime_periods")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("❌ getCurrentOvertimePeriod error", error);
    throw error;
  }

  return data || null;
}

export async function getOvertimeSummaries() {
  const period = await getCurrentOvertimePeriod();
  if (!period) return [];

  const { data, error } = await supabase
    .from("overtime_sessions")
    .select(
      `
        session_id,
        period_id,
        user_id,
        date,
        total_hours,
        user:user_id(
          user_id,
          first_name,
          last_name,
          email
        )
      `
    )
    .eq("period_id", period.period_id);

  if (error) {
    console.error("❌ getOvertimeSummaries error", error);
    throw error;
  }

  const summaries = new Map();

  (data || []).forEach((session) => {
    const employee = formatEmployee(session.user);
    const hours = Number(session.total_hours || 0);

    if (!summaries.has(session.user_id)) {
      summaries.set(session.user_id, {
        id: session.user_id,
        employee: employee.name,
        status: "In Progress",
        periodStart: period.period_start,
        periodEnd: period.period_end,
        overtimeHours: 0,
        overtimeRate: 1.5,
        bonus: 0,
      });
    }

    const entry = summaries.get(session.user_id);
    entry.overtimeHours += hours;
    entry.bonus = Number(entry.overtimeHours * 5).toFixed(2);
    entry.status = entry.overtimeHours >= 10 ? "Ready" : "In Progress";
  });

  return Array.from(summaries.values()).map((entry) => ({
    ...entry,
    overtimeHours: Number(entry.overtimeHours.toFixed(2)),
    overtimeRate: Number(entry.overtimeRate),
    bonus: Number(entry.bonus),
  }));
}

export async function getHrAttendanceSnapshot() {
  const [attendanceLogs, overtimeSummaries, absenceRecords] = await Promise.all([
    getAttendanceLogs(),
    getOvertimeSummaries(),
    getAbsenceRecords(),
  ]);

  return {
    attendanceLogs,
    overtimeSummaries,
    absenceRecords,
  };
}

/* ============================================
   HR DASHBOARD HELPERS
============================================ */
async function countTableRows(table, column = "*", filters = (query) => query) {
  const { error, count } = await filters(
    supabase.from(table).select(column, { count: "exact", head: true })
  );

  if (error) {
    console.error(`❌ countTableRows error for ${table}`, error);
    throw error;
  }

  return count || 0;
}

async function getTotalEmployeesSnapshot() {
  const totalEmployees = await countTableRows("users", "user_id");

  const today = dayjs().format("YYYY-MM-DD");
  const onLeave = await countTableRows("hr_absences", "*", (query) =>
    query
      .lte("start_date", today)
      .gte("end_date", today)
      .eq("approval_status", "Approved")
  );

  const inactive = Math.min(onLeave, totalEmployees);
  const active = Math.max(totalEmployees - inactive, 0);

  return { totalEmployees, activeEmployees: active, inactiveEmployees: inactive };
}

async function getAttendanceRate(totalEmployees) {
  if (!totalEmployees) return 0;

  const today = dayjs().format("YYYY-MM-DD");
  const { count, error } = await supabase
    .from("time_records")
    .select("id", { count: "exact", head: true })
    .eq("date", today)
    .not("clock_in", "is", null);

  if (error) {
    console.error("❌ getAttendanceRate error", error);
    throw error;
  }

  if (!count) return 0;

  return Math.round((count / totalEmployees) * 100);
}

async function getPerformanceScore() {
  const { data, error } = await supabase
    .from("hr_performance_reviews")
    .select("score, status");

  if (error) {
    console.error("❌ getPerformanceScore error", error);
    throw error;
  }

  if (!data || data.length === 0) return 4.0;

  let totalScore = 0;
  let scoredCount = 0;
  data.forEach((review) => {
    if (review?.score) {
      try {
        const parsed = typeof review.score === "string" ? JSON.parse(review.score) : review.score;
        const overall = Number(parsed?.overall ?? parsed?.score ?? 0);
        if (overall > 0) {
          totalScore += overall;
          scoredCount += 1;
        }
      } catch {
        // ignore malformed score payloads
      }
    }
  });

  if (!scoredCount) return 4.0;
  return Number((totalScore / scoredCount).toFixed(1));
}

async function getTrainingCompliance() {
  const { data, error } = await supabase
    .from("hr_training_assignments")
    .select("status");

  if (error) {
    console.error("❌ getTrainingCompliance error", error);
    throw error;
  }

  if (!data || data.length === 0) return 0;

  const completed = data.filter((assignment) => assignment.status?.toLowerCase() === "completed").length;
  return Math.round((completed / data.length) * 100);
}

export async function getUpcomingAbsences(daysAhead = 14) {
  const today = dayjs().format("YYYY-MM-DD");
  const future = dayjs().add(daysAhead, "day").format("YYYY-MM-DD");

  const { data, error } = await supabase
    .from("hr_absences")
    .select(
      `
        absence_id,
        user_id,
        type,
        start_date,
        end_date,
        approval_status,
        user:user_id(
          first_name,
          last_name
        ),
        profile:hr_employee_profiles!hr_employee_profiles_user_id_fkey(
          department
        )
      `
    )
    .eq("approval_status", "Approved")
    .gte("start_date", today)
    .lte("start_date", future)
    .order("start_date", { ascending: true });

  if (error) {
    console.error("❌ getUpcomingAbsences error", error);
    throw error;
  }

  return (data || []).map((absence) => ({
    id: absence.absence_id,
    employee: formatEmployee(absence.user).name,
    department: absence.profile?.department || "Unknown",
    type: absence.type,
    startDate: absence.start_date,
    endDate: absence.end_date,
  }));
}

export async function getActiveWarnings(limit = 5) {
  const { data, error } = await supabase
    .from("hr_disciplinary_cases")
    .select(
      `
        case_id,
        user_id,
        incident_type,
        severity,
        status,
        incident_date,
        notes,
        user:user_id(
          first_name,
          last_name
        ),
        profile:hr_employee_profiles!hr_employee_profiles_user_id_fkey(
          department
        )
      `
    )
    .neq("status", "closed")
    .order("incident_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getActiveWarnings error", error);
    throw error;
  }

  return (data || []).map((warning) => ({
    id: warning.case_id,
    employee: formatEmployee(warning.user).name,
    department: warning.profile?.department || "Unknown",
    level: warning.severity || warning.incident_type || "Warning",
    issuedOn: warning.incident_date,
    notes: warning.notes,
  }));
}

export async function getTrainingRenewals(limit = 5) {
  const today = dayjs().format("YYYY-MM-DD");
  const horizon = dayjs().add(90, "day").format("YYYY-MM-DD");

  const { data, error } = await supabase
    .from("hr_training_assignments")
    .select(
      `
        assignment_id,
        due_date,
        status,
        user:user_id(
          first_name,
          last_name
        ),
        course:course_id(title)
      `
    )
    .not("due_date", "is", null)
    .gte("due_date", today)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("❌ getTrainingRenewals error", error);
    throw error;
  }

  return (data || []).map((assignment) => {
    const dueDate = assignment.due_date;
    const due = dayjs(dueDate);
    const now = dayjs();
    let status = assignment.status || "Scheduled";

    if (due.isBefore(now, "day")) status = "Overdue";
    else if (due.diff(now, "day") <= 14 && status?.toLowerCase() !== "completed") status = "Due Soon";

    return {
      id: assignment.assignment_id,
      course: assignment.course?.title || "Training Course",
      employee: formatEmployee(assignment.user).name,
      dueDate,
      status,
    };
  });
}

export async function getDepartmentPerformance() {
  const { data, error } = await supabase
    .from("hr_employee_profiles")
    .select("department")
    .not("department", "is", null);

  if (error) {
    console.error("❌ getDepartmentPerformance error", error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  const counts = data.reduce((acc, row) => {
    acc[row.department] = (acc[row.department] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).map(([department, count]) => {
    const base = 65 + count * 3;
    return {
      id: department.toLowerCase().replace(/\s+/g, "-"),
      department,
      productivity: Math.min(100, Math.round(base)),
      quality: Math.min(100, Math.round(70 + count * 2.5)),
      teamwork: Math.min(100, Math.round(72 + count * 2)),
    };
  });
}

export async function getHrDashboardSnapshot() {
  const { totalEmployees, activeEmployees, inactiveEmployees } = await getTotalEmployeesSnapshot();

  const [
    attendanceRate,
    performanceScore,
    trainingCompliance,
    upcomingAbsences,
    activeWarnings,
    departmentPerformance,
    trainingRenewals,
  ] = await Promise.all([
    getAttendanceRate(totalEmployees),
    getPerformanceScore(),
    getTrainingCompliance(),
    getUpcomingAbsences(),
    getActiveWarnings(),
    getDepartmentPerformance(),
    getTrainingRenewals(),
  ]);

  const hrDashboardMetrics = [
    {
      id: "totalEmployees",
      label: "Total Employees",
      icon: "👥",
      active: activeEmployees,
      inactive: inactiveEmployees,
    },
    {
      id: "attendanceRate",
      label: "Attendance Rate",
      icon: "🕒",
      value: `${attendanceRate}%`,
      trend: null,
    },
    {
      id: "performanceScore",
      label: "Performance Score",
      icon: "📈",
      value: `${performanceScore} / 5`,
      trend: null,
    },
    {
      id: "trainingCompliance",
      label: "Training Compliance",
      icon: "🎓",
      value: `${trainingCompliance}%`,
      trend: null,
    },
  ];

  return {
    hrDashboardMetrics,
    upcomingAbsences,
    activeWarnings,
    departmentPerformance,
    trainingRenewals,
  };
}
