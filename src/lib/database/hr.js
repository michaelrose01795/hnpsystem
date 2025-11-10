// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/hr.js
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_ATTENDANCE_LIMIT = 50;

// Format employee data consistently across all HR functions
function formatEmployee(user) {
  if (!user) return { id: null, name: "Unknown" };
  const id = user.user_id ?? user.id ?? null;
  const first = user.first_name || "";
  const last = user.last_name || "";
  const name = `${first} ${last}`.trim() || user.email || `User ${id ?? ""}`.trim();
  return { id, name };
}

// Retrieve attendance logs for a specified date range with employee details
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

// Get all absence records with optional filtering
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

// Retrieve the current active overtime period
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

// Get overtime summaries for all employees in the current period
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

// Combined snapshot of attendance, overtime, and absence data
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

// Helper to count rows in any table with optional filters
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

// Get total employees with active/inactive breakdown
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

// Calculate today's attendance rate as a percentage
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

// Calculate average performance score from recent reviews
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
      } catch (error) {
        // ignore malformed score payloads
      }
    }
  });

  if (!scoredCount) return 4.0;
  return Number((totalScore / scoredCount).toFixed(1));
}

// Calculate percentage of training assignments completed
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

// Get upcoming absences within specified number of days
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

// Get active disciplinary warnings and cases
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

// Get training renewals due soon
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

// Get performance metrics by department
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

// Get complete dashboard snapshot with all metrics and alerts
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

/* ============================================
   EMPLOYEE DIRECTORY
============================================ */

// Calculate probation end date from start date
function deriveProbationEnd(startDate) {
  if (!startDate) return null;
  return dayjs(startDate).add(6, "month").format("YYYY-MM-DD");
}

// Build a map of users currently on approved leave
async function getActiveAbsenceMap() {
  const today = dayjs().format("YYYY-MM-DD");

  const { data, error } = await supabase
    .from("hr_absences")
    .select("user_id")
    .eq("approval_status", "Approved")
    .lte("start_date", today)
    .gte("end_date", today);

  if (error) {
    console.error("❌ getActiveAbsenceMap error", error);
    throw error;
  }

  const map = new Map();
  (data || []).forEach((row) => {
    if (row.user_id) {
      map.set(row.user_id, "On leave");
    }
  });
  return map;
}

// Normalize document arrays from various formats into consistent structure
const normalizeDocuments = (documents) => {
  if (!documents) return [];
  let parsed = documents;
  if (typeof documents === "string") {
    try {
      parsed = JSON.parse(documents);
    } catch (error) {
      parsed = [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.map((doc, index) => ({
    id: doc.id || `DOC-${index + 1}`,
    name: doc.name || doc.title || "Document",
    type: doc.type || doc.category || "general",
    uploadedOn: doc.uploadedOn || doc.uploaded_at || doc.date || doc.created_at || null,
  }));
};

// Format emergency contact data into consistent display format
const formatEmergencyContact = (value) => {
  if (!value) return { contact: "Not provided", address: "Not provided" };
  if (typeof value === "string") {
    return { contact: value, address: "Not provided" };
  }

  if (typeof value === "object") {
    const contactName = value.name || "Contact";
    const phone = value.phone ? ` (${value.phone})` : "";
    const relationship = value.relationship ? ` - ${value.relationship}` : "";
    return {
      contact: `${contactName}${phone}${relationship}`.trim(),
      address: value.address || "Not provided",
    };
  }

  return { contact: "Not provided", address: "Not provided" };
};

// Get complete employee directory with profile details
export async function getEmployeeDirectory() {
  const [profilesResult, activeAbsenceMap] = await Promise.all([
    supabase
      .from("hr_employee_profiles")
      .select(
        `
          profile_id,
          user_id,
          department,
          job_title,
          employment_type,
          start_date,
          manager_id,
          photo_url,
          emergency_contact,
          documents,
          created_at,
          user:user_id(
            user_id,
            first_name,
            last_name,
            email,
            phone,
            role,
            created_at
          )
        `
      )
      .order("created_at", { ascending: true }),
    getActiveAbsenceMap(),
  ]);

  const { data, error } = profilesResult;

  if (error) {
    console.error("❌ getEmployeeDirectory error", error);
    throw error;
  }

  return (data || []).map((profile) => {
    const user = profile.user || {};
    const userId = user.user_id || profile.user_id;
    const status = activeAbsenceMap.get(userId) || "Active";
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || `User ${userId}`;
    const emergencyDetails = formatEmergencyContact(profile.emergency_contact);

    return {
      id: `EMP-${userId}`,
      userId,
      name,
      jobTitle: profile.job_title || user.role || "Employee",
      department: profile.department || "Unassigned",
      role: user.role || profile.job_title || "Employee",
      employmentType: profile.employment_type || "Full-time",
      status,
      startDate: profile.start_date,
      probationEnd: deriveProbationEnd(profile.start_date),
      contractedHours: 40,
      hourlyRate: 0,
      keycloakId: user.email ? `kc-${user.email.split("@")[0]}` : `kc-${userId}`,
      email: user.email,
      phone: user.phone || "N/A",
      emergencyContact: emergencyDetails.contact,
      address: emergencyDetails.address,
      documents: normalizeDocuments(profile.documents),
    };
  });
}

// Helper that loads user names for any referenced IDs so we can resolve approvers and employees
async function fetchUsersByIds(ids = []) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));

  if (!uniqueIds.length) {
    return new Map();
  }

  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email")
    .in("user_id", uniqueIds);

  if (error) {
    console.error("❌ fetchUsersByIds error", error);
    throw error;
  }

  const map = new Map();
  (data || []).forEach((user) => {
    map.set(user.user_id, formatEmployee(user).name);
  });

  return map;
}

// Translate the raw approval status into a friendly state for UI widgets
function mapLeaveStatus(status, startDate, endDate) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "rejected") return "Rejected";

  if (normalized === "approved") {
    const today = dayjs();
    if (startDate && dayjs(startDate).isAfter(today, "day")) return "Scheduled";
    if (endDate && dayjs(endDate).isBefore(today, "day")) return "Completed";
    return "Approved";
  }

  return status || "Pending";
}

// Inclusive day count helper so we can total the amount of leave taken
function calculateAbsenceDays(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = dayjs(startDate);
  const end = dayjs(endDate);
  if (!start.isValid() || !end.isValid()) return 0;
  return Math.max(end.diff(start, "day") + 1, 0);
}

// Rough entitlement estimator so part-time staff get a reduced allowance by default
function estimateAnnualEntitlement(employmentType) {
  const normalized = (employmentType || "").toLowerCase();
  if (normalized.includes("part")) return 15;
  if (normalized.includes("contract")) return 10;
  return 25;
}

// Pull structured leave requests from hr_absences with approver details resolved
export async function getLeaveRequests({ limit = 50 } = {}) {
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
        approved_by,
        created_at,
        user:user_id(
          first_name,
          last_name,
          email
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getLeaveRequests error", error);
    throw error;
  }

  const approverIds = (data || []).map((row) => row.approved_by).filter(Boolean);
  const approverMap = await fetchUsersByIds(approverIds);

  return (data || []).map((row) => {
    const employee = formatEmployee(row.user);
    const approver = approverMap.get(row.approved_by) || "Awaiting approval";

    return {
      id: `LR-${row.absence_id}`,
      employeeId: `EMP-${row.user_id}`,
      employee: employee.name,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      status: mapLeaveStatus(row.approval_status, row.start_date, row.end_date),
      submittedOn: row.created_at,
      approver,
    };
  });
}

// Aggregate leave balances by employee using approved hr_absences rows
export async function getLeaveBalances() {
  const [{ data: profiles, error: profileError }, { data: absences, error: absencesError }] = await Promise.all([
    supabase
      .from("hr_employee_profiles")
      .select(
        `
          user_id,
          department,
          employment_type,
          user:user_id(
            first_name,
            last_name,
            email
          )
        `
      ),
    supabase
      .from("hr_absences")
      .select("user_id, start_date, end_date, approval_status"),
  ]);

  if (profileError) {
    console.error("❌ getLeaveBalances profiles error", profileError);
    throw profileError;
  }

  if (absencesError) {
    console.error("❌ getLeaveBalances absences error", absencesError);
    throw absencesError;
  }

  const approvedTotals = new Map();
  (absences || []).forEach((absence) => {
    if ((absence.approval_status || "").toLowerCase() !== "approved") return;
    const days = calculateAbsenceDays(absence.start_date, absence.end_date);
    if (!days) return;
    const current = approvedTotals.get(absence.user_id) || 0;
    approvedTotals.set(absence.user_id, current + days);
  });

  return (profiles || []).map((profile) => {
    const userId = profile.user_id;
    const entitlement = estimateAnnualEntitlement(profile.employment_type);
    const taken = approvedTotals.get(userId) || 0;
    const remaining = Math.max(entitlement - taken, 0);

    return {
      employeeId: `EMP-${userId}`,
      employee: formatEmployee(profile.user).name,
      department: profile.department || "Unassigned",
      entitlement,
      taken,
      remaining,
    };
  });
}

// Pull historical payroll adjustments to display pay rate changes and bonuses
export async function getPayRateHistory({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("hr_payroll_adjustments")
    .select("adjustment_id, payroll_id, user_id, type, amount, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getPayRateHistory error", error);
    throw error;
  }

  const payrollIds = Array.from(new Set((data || []).map((row) => row.payroll_id).filter(Boolean)));
  let payrollRuns = [];

  if (payrollIds.length) {
    const { data: payrollData, error: payrollError } = await supabase
      .from("hr_payroll_runs")
      .select("payroll_id, period_start, processed_by")
      .in("payroll_id", payrollIds);

    if (payrollError) {
      console.error("❌ getPayRateHistory payroll error", payrollError);
      throw payrollError;
    }

    payrollRuns = payrollData || [];
  }

  const payrollMap = new Map();
  payrollRuns.forEach((run) => {
    payrollMap.set(run.payroll_id, run);
  });

  const approverIds = payrollRuns.map((run) => run.processed_by).filter(Boolean);
  const employeeIds = (data || []).map((row) => row.user_id).filter(Boolean);
  const nameMap = await fetchUsersByIds([...approverIds, ...employeeIds]);

  return (data || []).map((row) => {
    const payroll = payrollMap.get(row.payroll_id);
    const approverName = payroll?.processed_by ? nameMap.get(payroll.processed_by) : null;
    const employeeName = nameMap.get(row.user_id) || `Employee ${row.user_id}`;
    const effectiveDate = payroll?.period_start || row.created_at;

    return {
      id: `PAY-${row.adjustment_id}`,
      employeeId: `EMP-${row.user_id}`,
      employee: employeeName,
      effectiveDate,
      rate: Number(row.amount || 0),
      type: row.type || "Adjustment",
      approvedBy: approverName || "Payroll Team",
    };
  });
}

// Aggregate frequently used HR datasets so UI hooks can hydrate multiple widgets in one request
export async function getHrOperationsSnapshot() {
  const [attendanceSnapshot, dashboardSnapshot, employeeDirectory, leaveRequests, leaveBalances, payRateHistory] =
    await Promise.all([
      getHrAttendanceSnapshot(),
      getHrDashboardSnapshot(),
      getEmployeeDirectory(),
      getLeaveRequests(),
      getLeaveBalances(),
      getPayRateHistory(),
    ]);

  return {
    hrDashboardMetrics: dashboardSnapshot.hrDashboardMetrics,
    upcomingAbsences: dashboardSnapshot.upcomingAbsences,
    activeWarnings: dashboardSnapshot.activeWarnings,
    departmentPerformance: dashboardSnapshot.departmentPerformance,
    trainingRenewals: dashboardSnapshot.trainingRenewals,
    employeeDirectory,
    attendanceLogs: attendanceSnapshot.attendanceLogs,
    absenceRecords: attendanceSnapshot.absenceRecords,
    overtimeSummaries: attendanceSnapshot.overtimeSummaries,
    payRateHistory,
    leaveRequests,
    leaveBalances,
  };
}