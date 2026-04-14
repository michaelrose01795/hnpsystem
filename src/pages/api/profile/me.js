// API endpoint for fetching the authenticated user's own profile data
// This endpoint does NOT require HR/admin permissions - any authenticated user can access their own data
// file location: src/pages/api/profile/me.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/database/supabaseClient";
import { getDatabaseClient } from "@/lib/database/client";
import { getDisplayName } from "@/lib/users/displayName";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import dayjs from "dayjs";
import { calculateLeaveRequestDayTotals, parseLeaveRequestNotes } from "@/lib/hr/leaveRequests";
import { getOvertimePeriodBounds } from "@/lib/database/hr";
import { getStaffVehiclePayrollDeductionsForUser } from "@/lib/profile/staffVehiclePayrollDeductions";

const adminDb = getDatabaseClient();

// Auto-close any stale active records from previous days for this user
async function autoCloseStaleRecords(userId) {
  const today = dayjs().format("YYYY-MM-DD");

  const { data: staleRecords, error: fetchError } = await supabase
    .from("time_records")
    .select("id, user_id, date, clock_in")
    .eq("user_id", userId)
    .is("clock_out", null)
    .lt("date", today);

  if (fetchError || !staleRecords || staleRecords.length === 0) return;

  for (const record of staleRecords) {
    const clockOutTime = `${record.date}T23:59:59.000Z`;
    const clockInTime = new Date(record.clock_in);
    const clockOut = new Date(clockOutTime);
    const hoursWorked = Number(((clockOut - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    const dayOfWeek = new Date(record.date).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const notes = isWeekend ? "Weekend - Auto-closed at midnight" : "Auto-closed at midnight";

    await supabase
      .from("time_records")
      .update({
        clock_out: clockOutTime,
        hours_worked: hoursWorked,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    console.log(`Auto-closed stale record ${record.id} for user ${userId} from ${record.date}`);
  }
}

// Get user's attendance logs
async function getUserAttendanceLogs(userId, limit = 500) {
  // Auto-close any stale records before fetching
  await autoCloseStaleRecords(userId);

  const effectiveEnd = dayjs().format("YYYY-MM-DD");
  const effectiveStart = dayjs(effectiveEnd).subtract(365, "day").format("YYYY-MM-DD");

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
        notes
      `
    );

  query = query.eq("user_id", userId);

  const { data, error } = await query
    .gte("date", effectiveStart)
    .lte("date", effectiveEnd)
    .order("date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("getUserAttendanceLogs error", error);
    throw error;
  }

  return (data || []).map((record) => {
    const hours = Number(record.hours_worked || 0);
    const isRecurringOvertime = record.notes === "Overtime - Recurring";
    const isBulkOvertime = record.notes && record.notes.startsWith("Bulk Overtime");

    // Determine if this is a weekend (Saturday=6, Sunday=0)
    const recordDate = new Date(record.date);
    const dayOfWeek = recordDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Determine type: Overtime (explicitly marked), Weekend, or Weekday
    let type = "Weekday";
    if (record.notes === "Overtime" || record.notes === "Overtime - Auto-approved" || (record.notes && record.notes.startsWith("Bulk Overtime")) || isRecurringOvertime) {
      type = "Overtime";
    } else if (isWeekend) {
      type = "Weekend";
    }

    // Legacy status for backward compatibility
    let status = "Clocked In";
    if (type === "Overtime") status = "Overtime";
    else if (record.clock_out && hours >= 9) status = "Overtime";
    else if (record.clock_out) status = "On Time";

    return {
      id: record.id,
      employeeId: userId,
      date: record.date,
      clockIn: isBulkOvertime ? null : isRecurringOvertime ? "AUTO" : record.clock_in,
      clockOut: isBulkOvertime ? null : isRecurringOvertime ? "AUTO" : record.clock_out,
      totalHours: hours,
      status, // Legacy field
      type,   // New field: "Weekday", "Weekend", or "Overtime"
      origin: isRecurringOvertime ? "auto" : isBulkOvertime ? "bulk" : "manual", // Source: "auto" = cron-created from a recurring rule; "manual" = user-logged (or inherent clocking)
      bulk: isBulkOvertime || false, // Bulk overtime — year-level, not per-month
    };
  });
}

// Get user's overtime summary + individual sessions for the active period
async function getUserOvertimeSnapshot(userId) {
  // Find the most recent overtime period, or auto-create one for the 26th-to-25th cycle
  let period = null;
  const { data: existingPeriod, error: periodError } = await supabase
    .from("overtime_periods")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError && periodError.code !== "PGRST116") {
    console.error("❌ getUserOvertimeSnapshot period error", periodError);
    throw periodError;
  }

  // Check if the most recent period covers today
  const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  if (existingPeriod && todayStr >= existingPeriod.period_start && todayStr <= existingPeriod.period_end) {
    period = existingPeriod; // existing period covers today
  } else {
    // Auto-create a period for the current 26th-to-25th cycle
    const now = new Date();
    const { periodStart, periodEnd } = getOvertimePeriodBounds(now);

    const { data: created, error: createError } = await supabase
      .from("overtime_periods")
      .insert({ period_start: periodStart, period_end: periodEnd, status: "open" })
      .select("*")
      .single();

    if (createError) {
      console.error("❌ Failed to auto-create overtime period:", createError);
      return { summary: null, sessions: [] };
    }
    period = created;
  }

  // Fetch ALL overtime sessions for this user (across all periods) so the
  // personal finance tab can break them down by month for historical views.
  const cutoffDate = dayjs().subtract(365, "day").format("YYYY-MM-DD");
  const { data, error } = await supabase
    .from("overtime_sessions")
    .select(
      `
        session_id,
        period_id,
        user_id,
        date,
        start_time,
        end_time,
        total_hours,
        notes,
        created_at,
        updated_at
      `
    )
    .eq("user_id", userId)
    .gte("date", cutoffDate)
    .order("date", { ascending: false });

  if (error) {
    console.error("❌ getUserOvertimeSnapshot sessions error", error);
    throw error;
  }

  const sessions = (data || []).map((session) => ({
    id: session.session_id,
    periodId: session.period_id,
    userId: session.user_id,
    date: session.date,
    start: session.start_time,
    end: session.end_time,
    totalHours: Number(session.total_hours || 0),
    notes: session.notes || "",
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  }));

  // Summary is scoped to the current period for backward compatibility
  const currentPeriodSessions = sessions.filter((s) => s.periodId === period.period_id);
  const totalOvertimeHours = currentPeriodSessions.reduce((sum, session) => sum + Number(session.totalHours || 0), 0);

  const summary = {
    id: userId,
    periodId: period.period_id,
    status: totalOvertimeHours >= 10 ? "Ready" : "In Progress",
    periodStart: period.period_start,
    periodEnd: period.period_end,
    overtimeHours: Number(totalOvertimeHours.toFixed(2)),
    overtimeRate: 1.5,
    bonus: Number((totalOvertimeHours * 5).toFixed(2)),
  };

  return { summary, sessions };
}

// Get user's leave balance
async function getUserLeaveBalance(userId, employmentType) {
  // Estimate entitlement based on employment type
  const estimateEntitlement = (type) => {
    const normalized = (type || "").toLowerCase();
    if (normalized.includes("part")) return 15;
    if (normalized.includes("contract")) return 10;
    return 25;
  };

  const entitlement = estimateEntitlement(employmentType);

  // Calculate days taken from approved absences
  const { data: absences, error } = await supabase
    .from("hr_absences")
    .select("start_date, end_date, approval_status, notes")
    .eq("user_id", userId)
    .eq("approval_status", "Approved");

  if (error) {
    console.error("❌ getUserLeaveBalance error", error);
    throw error;
  }

  const taken = (absences || []).reduce((sum, absence) => {
    const noteData = parseLeaveRequestNotes(absence.notes);
    const totals = calculateLeaveRequestDayTotals({
      startDate: absence.start_date,
      endDate: absence.end_date,
      halfDay: noteData.halfDay,
      fallbackTotalDays: noteData.totalDays,
    });
    return sum + totals.workDays;
  }, 0);

  const remaining = Math.max(entitlement - taken, 0);

  return {
    entitlement,
    taken,
    remaining,
  };
}

async function getUserLeaveRequests(userId, limit = 100) {
  const { data, error } = await supabase
    .from("hr_absences")
    .select("absence_id, type, start_date, end_date, approval_status, notes, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to load leave requests for profile:", error);
    throw error;
  }

  return (data || []).map((row) => {
    const noteData = parseLeaveRequestNotes(row.notes);
    const totals = calculateLeaveRequestDayTotals({
      startDate: row.start_date,
      endDate: row.end_date,
      halfDay: noteData.halfDay,
      fallbackTotalDays: noteData.totalDays,
    });
    return {
      id: row.absence_id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.approval_status || "Pending",
      requestNotes: noteData.requestNotes || "",
      declineReason: noteData.declineReason || "",
      halfDay: noteData.halfDay || "None",
      totalDays: totals.workDays,
      calendarDays: totals.calendarDays,
      createdAt: row.created_at,
    };
  });
}

// Get user's profile directly from users table
async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("users")
    .select(
      `
        user_id,
        first_name,
        last_name,
        email,
        phone,
        role,
        department,
        job_title,
        employment_type,
        start_date,
        photo_url,
        emergency_contact,
        home_address,
        manager_id,
        dark_mode,
        accent_color,
        hourly_rate,
        overtime_rate,
        contracted_hours_per_week,
        annual_salary
      `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ getUserProfile error", error);
    throw error;
  }

  if (!data) return null;

  const name = getDisplayName(data);

  // Format emergency contact — handles both structured JSON and legacy { raw: "..." } format
  const formatEmergencyContact = (value) => {
    if (!value) return "Not provided";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      if (value.name) {
        const parts = [value.name, value.phone, value.relationship].filter(Boolean);
        return parts.join(", ");
      }
      if (value.raw) return value.raw;
    }
    return "Not provided";
  };

  return {
    id: `EMP-${userId}`,
    userId,
    name,
    jobTitle: data.job_title || "Employee",
    department: data.department || "Unassigned",
    role: data.role || "Employee",
    employmentType: data.employment_type || "Full-time",
    startDate: data.start_date,
    hourlyRate: Number(data.hourly_rate ?? 0),
    overtimeRate: Number(data.overtime_rate ?? 0),
    contractedWeeklyHours: Number(data.contracted_hours_per_week ?? 0),
    annualSalary: Number(data.annual_salary ?? 0),
    keycloakId: data.email ? `kc-${data.email.split("@")[0]}` : `kc-${userId}`,
    email: data.email,
    phone: data.phone || "N/A",
    emergencyContact: formatEmergencyContact(data.emergency_contact),
    address: data.home_address || "Not provided",
    managerId: Number.isInteger(data.manager_id) ? data.manager_id : null,
    themeMode:
      data.dark_mode === null || typeof data.dark_mode === "undefined"
        ? "system"
        : typeof data.dark_mode === "boolean"
          ? data.dark_mode
            ? "dark"
            : "light"
          : data.dark_mode,
    accentColor: typeof data.accent_color === "string" && data.accent_color.length > 0 ? data.accent_color : "red",
  };
}

// Get user's staff vehicles
async function getUserStaffVehicles(userId) {
  const { data, error } = await adminDb
    .from("staff_vehicles")
    .select(
      `
        vehicle_id,
        user_id,
        make,
        model,
        registration,
        vin,
        colour,
        payroll_deduction_enabled,
        payroll_deduction_reference,
        created_at,
        updated_at,
        history:staff_vehicle_history(
          history_id,
          vehicle_id,
          job_id,
          description,
          cost,
          deduct_from_payroll,
          recorded_at,
          payroll_processed_at
        )
      `
    )
    .eq("user_id", userId);

  if (error) {
    console.error("❌ getUserStaffVehicles error", error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.vehicle_id,
    userId: row.user_id,
    make: row.make || "",
    model: row.model || "",
    registration: row.registration || "",
    vin: row.vin || "",
    colour: row.colour || "",
    payrollDeductionEnabled: row.payroll_deduction_enabled !== false,
    payrollDeductionReference: row.payroll_deduction_reference || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    history: Array.isArray(row.history)
      ? row.history.map((h) => ({
          id: h.history_id,
          vehicleId: h.vehicle_id,
          jobId: h.job_id,
          description: h.description || "",
          cost: Number(h.cost ?? 0),
          deductFromPayroll: h.deduct_from_payroll !== false,
          recordedAt: h.recorded_at,
          payrollProcessedAt: h.payroll_processed_at || null,
        }))
      : [],
  }));
}

async function getUserStaffVehiclePayrollDeductions(userId) {
  return getStaffVehiclePayrollDeductionsForUser(userId, adminDb);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Support both NextAuth (Keycloak) and dev authentication bypass
    // Enable bypass when env flag is set or when a dev role cookie exists in non-production
    const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
    const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
    const allowDevBypass =
      devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

    let userId = null;

    if (allowDevBypass) {
      // In dev mode, accept userId from query params (for testing)
      // Or use a default test user
      const queryUserId = req.query.userId;

      if (queryUserId) {
        userId = parseInt(queryUserId, 10);
      } else {
        // Try to get user from header or default to first user
        const { data: firstUser, error: firstUserError } = await supabase
          .from("users")
          .select("user_id, first_name, last_name, email, role")
          .limit(1)
          .single();

        if (firstUserError) {
          console.error("❌ Error finding default user in dev mode:", firstUserError);
          return res.status(500).json({
            success: false,
            message: "Dev mode enabled but no users found. Please create a user first."
          });
        }

        userId = firstUser.user_id;
        console.log("🔧 Dev mode: Using default user", userId, firstUser.email);
      }
    } else {
      // Production mode - require NextAuth session
      const session = await getServerSession(req, res, authOptions);

      if (!session?.user) {
        return res.status(401).json({ success: false, message: "Authentication required" });
      }

      userId = await resolveSessionUserId(session);
    }

    // Fetch all user-specific data in parallel
    const [profile, attendanceLogs, overtimeSnapshot, leaveBalance, leaveRequests, staffVehicles, staffVehiclePayrollDeductions] = await Promise.all([
      getUserProfile(userId),
      getUserAttendanceLogs(userId, 500),
      getUserOvertimeSnapshot(userId),
      getUserLeaveBalance(userId, null),
      getUserLeaveRequests(userId, 100),
      getUserStaffVehicles(userId),
      getUserStaffVehiclePayrollDeductions(userId),
    ]);

    // If profile exists, recalculate leave balance with correct employment type
    let finalLeaveBalance = leaveBalance;
    if (profile?.employmentType) {
      finalLeaveBalance = await getUserLeaveBalance(userId, profile.employmentType);
    }

    // Return user's profile data
    return res.status(200).json({
      success: true,
      data: {
        profile,
        attendanceLogs,
        overtimeSummary: overtimeSnapshot.summary,
        overtimeSessions: overtimeSnapshot.sessions,
        leaveBalance: finalLeaveBalance,
        leaveRequests,
        staffVehicles,
        staffVehiclePayrollDeductions,
      },
    });
  } catch (error) {
    console.error("❌ /api/profile/me error", error);
    const statusCode = error?.message === "Authentication required" ? 401 : 500;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to load profile data",
      error: error.message,
    });
  }
}
