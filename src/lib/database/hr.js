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
      } catch (error) {
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

/* ============================================
   EMPLOYEE DIRECTORY
============================================ */
function deriveProbationEnd(startDate) {
  if (!startDate) return null;
  return dayjs(startDate).add(6, "month").format("YYYY-MM-DD");
}

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

// Helper that loads user names for any referenced IDs so we can resolve approvers and employees.
async function fetchUsersByIds(ids = []) {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean))); // ensure IDs are unique and truthy

  if (!uniqueIds.length) {
    return new Map(); // return empty map when we have nothing to resolve
  }

  const { data, error } = await supabase
    .from("users")
    .select("user_id, first_name, last_name, email")
    .in("user_id", uniqueIds);

  if (error) {
    console.error("❌ fetchUsersByIds error", error); // log the Supabase error for debugging
    throw error; // propagate so API handlers can surface a 500
  }

  const map = new Map(); // map user_id -> friendly display name
  (data || []).forEach((user) => {
    map.set(user.user_id, formatEmployee(user).name); // use existing formatter for consistent naming
  });

  return map;
}

// Translate the raw approval status into a friendly state for UI widgets.
function mapLeaveStatus(status, startDate, endDate) {
  const normalized = (status || "").toLowerCase(); // normalize for comparisons
  if (normalized === "pending") return "Pending"; // still awaiting approval
  if (normalized === "rejected") return "Rejected"; // explicitly declined

  if (normalized === "approved") {
    const today = dayjs(); // capture today for comparisons
    if (startDate && dayjs(startDate).isAfter(today, "day")) return "Scheduled"; // future-approved leave
    if (endDate && dayjs(endDate).isBefore(today, "day")) return "Completed"; // already finished
    return "Approved"; // otherwise active/ongoing
  }

  return status || "Pending"; // default fallback mirrors legacy behaviour
}

// Inclusive day count helper so we can total the amount of leave taken.
function calculateAbsenceDays(startDate, endDate) {
  if (!startDate || !endDate) return 0; // guard against incomplete ranges
  const start = dayjs(startDate); // parse start date
  const end = dayjs(endDate); // parse end date
  if (!start.isValid() || !end.isValid()) return 0; // ignore malformed dates
  return Math.max(end.diff(start, "day") + 1, 0); // inclusive difference, clamped to zero
}

// Rough entitlement estimator so part-time staff get a reduced allowance by default.
function estimateAnnualEntitlement(employmentType) {
  const normalized = (employmentType || "").toLowerCase(); // case-insensitive comparison
  if (normalized.includes("part")) return 15; // part-time contract default
  if (normalized.includes("contract")) return 10; // contractors typically have smaller banks
  return 25; // full-time default allowance
}

// Pull structured leave requests from hr_absences with approver details resolved.
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
    console.error("❌ getLeaveRequests error", error); // log Supabase failure for debugging
    throw error; // bubble to caller so API can return 500
  }

  const approverIds = (data || []).map((row) => row.approved_by).filter(Boolean); // collect approver references
  const approverMap = await fetchUsersByIds(approverIds); // resolve approver names

  return (data || []).map((row) => {
    const employee = formatEmployee(row.user); // consistent employee naming
    const approver = approverMap.get(row.approved_by) || "Awaiting approval"; // fallback when unresolved

    return {
      id: `LR-${row.absence_id}`, // stable identifier for UI lists
      employeeId: `EMP-${row.user_id}`, // align with employee directory formatting
      employee: employee.name, // readable employee name
      type: row.type, // leave type
      startDate: row.start_date, // request start
      endDate: row.end_date, // request end
      status: mapLeaveStatus(row.approval_status, row.start_date, row.end_date), // friendly status label
      submittedOn: row.created_at, // request creation timestamp
      approver, // resolved approver display name
    };
  });
}

// Aggregate leave balances by employee using approved hr_absences rows.
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
    console.error("❌ getLeaveBalances profiles error", profileError); // bubble profile fetch issues
    throw profileError;
  }

  if (absencesError) {
    console.error("❌ getLeaveBalances absences error", absencesError); // bubble absence fetch issues
    throw absencesError;
  }

  const approvedTotals = new Map(); // track total approved days per employee
  (absences || []).forEach((absence) => {
    if ((absence.approval_status || "").toLowerCase() !== "approved") return; // only count approved leave
    const days = calculateAbsenceDays(absence.start_date, absence.end_date); // inclusive days off
    if (!days) return; // skip zero length
    const current = approvedTotals.get(absence.user_id) || 0; // current running total
    approvedTotals.set(absence.user_id, current + days); // accumulate
  });

  return (profiles || []).map((profile) => {
    const userId = profile.user_id; // supabase user key
    const entitlement = estimateAnnualEntitlement(profile.employment_type); // derive baseline allowance
    const taken = approvedTotals.get(userId) || 0; // total approved time
    const remaining = Math.max(entitlement - taken, 0); // guard against negatives

    return {
      employeeId: `EMP-${userId}`, // align with other HR UI keys
      employee: formatEmployee(profile.user).name, // user-friendly name
      department: profile.department || "Unassigned", // default when missing
      entitlement, // annual allowance estimate
      taken, // days already used
      remaining, // days remaining
    };
  });
}

// Pull historical payroll adjustments to display pay rate changes and bonuses.
export async function getPayRateHistory({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from("hr_payroll_adjustments")
    .select("adjustment_id, payroll_id, user_id, type, amount, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getPayRateHistory error", error); // record failure for diagnostics
    throw error;
  }

  const payrollIds = Array.from(new Set((data || []).map((row) => row.payroll_id).filter(Boolean))); // unique payroll runs
  let payrollRuns = [];

  if (payrollIds.length) {
    const { data: payrollData, error: payrollError } = await supabase
      .from("hr_payroll_runs")
      .select("payroll_id, period_start, processed_by")
      .in("payroll_id", payrollIds);

    if (payrollError) {
      console.error("❌ getPayRateHistory payroll error", payrollError); // log related failure
      throw payrollError;
    }

    payrollRuns = payrollData || []; // hold onto run metadata for later mapping
  }

  const payrollMap = new Map(); // map payroll_id -> payroll run details
  payrollRuns.forEach((run) => {
    payrollMap.set(run.payroll_id, run); // store for quick lookup
  });

  const approverIds = payrollRuns.map((run) => run.processed_by).filter(Boolean); // gather processed_by references
  const employeeIds = (data || []).map((row) => row.user_id).filter(Boolean); // gather employee IDs involved
  const nameMap = await fetchUsersByIds([...approverIds, ...employeeIds]); // resolve all required names in one call

  return (data || []).map((row) => {
    const payroll = payrollMap.get(row.payroll_id); // associated payroll run
    const approverName = payroll?.processed_by ? nameMap.get(payroll.processed_by) : null; // who processed the payroll
    const employeeName = nameMap.get(row.user_id) || `Employee ${row.user_id}`; // fallback when no profile exists
    const effectiveDate = payroll?.period_start || row.created_at; // use payroll period when available

    return {
      id: `PAY-${row.adjustment_id}`, // unique identifier for UI keys
      employeeId: `EMP-${row.user_id}`, // match directory format
      employee: employeeName, // resolved employee name
      effectiveDate, // when the change took effect
      rate: Number(row.amount || 0), // numeric representation of adjustment value
      type: row.type || "Adjustment", // categorize change type
      approvedBy: approverName || "Payroll Team", // default label when unresolved
    };
  });
}

// Aggregate frequently used HR datasets so UI hooks can hydrate multiple widgets in one request.
export async function getHrOperationsSnapshot() {
  const [attendanceSnapshot, dashboardSnapshot, employeeDirectory, leaveRequests, leaveBalances, payRateHistory] =
    await Promise.all([
      getHrAttendanceSnapshot(), // attendance, overtime, absence summaries
      getHrDashboardSnapshot(), // top-level dashboard metrics and alerts
      getEmployeeDirectory(), // staff roster details
      getLeaveRequests(), // individual leave requests for approval lists
      getLeaveBalances(), // entitlement vs usage totals
      getPayRateHistory(), // payroll adjustment history
    ]);

  return {
    hrDashboardMetrics: dashboardSnapshot.hrDashboardMetrics, // summary metrics for dashboard cards
    upcomingAbsences: dashboardSnapshot.upcomingAbsences, // near-term leave events
    activeWarnings: dashboardSnapshot.activeWarnings, // outstanding disciplinary cases
    departmentPerformance: dashboardSnapshot.departmentPerformance, // productivity breakdown
    trainingRenewals: dashboardSnapshot.trainingRenewals, // soon-to-expire training assignments
    employeeDirectory, // directory for selection lists
    attendanceLogs: attendanceSnapshot.attendanceLogs, // clocking entries
    absenceRecords: attendanceSnapshot.absenceRecords, // historical absences list
    overtimeSummaries: attendanceSnapshot.overtimeSummaries, // overtime totals by employee
    payRateHistory, // payroll change history
    leaveRequests, // pending and historical leave requests
    leaveBalances, // entitlement usage per employee
  };
}
