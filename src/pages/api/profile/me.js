// API endpoint for fetching the authenticated user's own profile data
// This endpoint does NOT require HR/admin permissions - any authenticated user can access their own data
// file location: src/pages/api/profile/me.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";
import { getDatabaseClient } from "@/lib/database/client";
import dayjs from "dayjs";

const adminDb = getDatabaseClient();

// Format employee data consistently
function formatEmployee(user) {
  if (!user) return { id: null, name: "Unknown" };
  const id = user.user_id ?? user.id ?? null;
  const first = user.first_name || "";
  const last = user.last_name || "";
  const name = `${first} ${last}`.trim() || user.email || `User ${id ?? ""}`.trim();
  return { id, name };
}

// Get user's attendance logs
async function getUserAttendanceLogs(userId, limit = 50) {
  const effectiveEnd = dayjs().format("YYYY-MM-DD");
  const effectiveStart = dayjs(effectiveEnd).subtract(30, "day").format("YYYY-MM-DD");

  const { data, error } = await supabase
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
    )
    .eq("user_id", userId)
    .gte("date", effectiveStart)
    .lte("date", effectiveEnd)
    .order("clock_in", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("❌ getUserAttendanceLogs error", error);
    throw error;
  }

  return (data || []).map((record) => {
    const hours = Number(record.hours_worked || 0);
    let status = "Clocked In";
    if (record.clock_out && hours >= 9) status = "Overtime";
    else if (record.clock_out) status = "On Time";

    return {
      id: record.id,
      employeeId: userId,
      date: record.date,
      clockIn: record.clock_in,
      clockOut: record.clock_out,
      totalHours: hours,
      status,
    };
  });
}

// Get user's overtime summary
async function getUserOvertimeSummary(userId) {
  // Get current overtime period
  const { data: period, error: periodError } = await supabase
    .from("overtime_periods")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (periodError && periodError.code !== "PGRST116") {
    console.error("❌ getUserOvertimeSummary period error", periodError);
    throw periodError;
  }

  if (!period) return null;

  // Get user's overtime sessions for this period
  const { data, error } = await supabase
    .from("overtime_sessions")
    .select(
      `
        session_id,
        period_id,
        user_id,
        date,
        total_hours
      `
    )
    .eq("period_id", period.period_id)
    .eq("user_id", userId);

  if (error) {
    console.error("❌ getUserOvertimeSummary error", error);
    throw error;
  }

  if (!data || data.length === 0) return null;

  const totalOvertimeHours = data.reduce((sum, session) => {
    return sum + Number(session.total_hours || 0);
  }, 0);

  return {
    id: userId,
    status: totalOvertimeHours >= 10 ? "Ready" : "In Progress",
    periodStart: period.period_start,
    periodEnd: period.period_end,
    overtimeHours: Number(totalOvertimeHours.toFixed(2)),
    overtimeRate: 1.5,
    bonus: Number((totalOvertimeHours * 5).toFixed(2)),
  };
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
    .select("start_date, end_date, approval_status")
    .eq("user_id", userId)
    .eq("approval_status", "Approved");

  if (error) {
    console.error("❌ getUserLeaveBalance error", error);
    throw error;
  }

  const calculateDays = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = dayjs(startDate);
    const end = dayjs(endDate);
    if (!start.isValid() || !end.isValid()) return 0;
    return Math.max(end.diff(start, "day") + 1, 0);
  };

  const taken = (absences || []).reduce((sum, absence) => {
    return sum + calculateDays(absence.start_date, absence.end_date);
  }, 0);

  const remaining = Math.max(entitlement - taken, 0);

  return {
    entitlement,
    taken,
    remaining,
  };
}

// Get user's profile from HR employee profiles
async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from("hr_employee_profiles")
    .select(
      `
        profile_id,
        user_id,
        department,
        job_title,
        employment_type,
        start_date,
        photo_url,
        emergency_contact,
        user:user_id(
          user_id,
          first_name,
          last_name,
          email,
          phone,
          role
        )
      `
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ getUserProfile error", error);
    throw error;
  }

  if (!data) return null;

  const user = data.user || {};
  const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || `User ${userId}`;

  // Format emergency contact
  const formatEmergencyContact = (value) => {
    if (!value) return "Not provided";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const contactName = value.name || "Contact";
      const phone = value.phone ? ` (${value.phone})` : "";
      const relationship = value.relationship ? ` - ${value.relationship}` : "";
      return `${contactName}${phone}${relationship}`.trim();
    }
    return "Not provided";
  };

  const formatAddress = (value) => {
    if (!value) return "Not provided";
    if (typeof value === "string") return value;
    if (typeof value === "object" && value.address) return value.address;
    return "Not provided";
  };

  return {
    id: `EMP-${userId}`,
    userId,
    name,
    jobTitle: data.job_title || user.role || "Employee",
    department: data.department || "Unassigned",
    role: user.role || data.job_title || "Employee",
    employmentType: data.employment_type || "Full-time",
    startDate: data.start_date,
    hourlyRate: 0, // Hidden for privacy unless admin
    keycloakId: user.email ? `kc-${user.email.split("@")[0]}` : `kc-${userId}`,
    email: user.email,
    phone: user.phone || "N/A",
    emergencyContact: formatEmergencyContact(data.emergency_contact),
    address: formatAddress(data.emergency_contact),
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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // Check authentication - but don't require specific roles
    // ANY authenticated user can access their own profile
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Get the user's ID from session
    // First, find the user by email or username from the session
    const sessionEmail = session.user.email;
    const sessionName = session.user.name;

    if (!sessionEmail && !sessionName) {
      return res.status(400).json({ success: false, message: "Unable to identify user from session" });
    }

    // Find user in database
    let userQuery = supabase.from("users").select("user_id, first_name, last_name, email, role");

    if (sessionEmail) {
      userQuery = userQuery.eq("email", sessionEmail);
    } else if (sessionName) {
      // Try to match by name if email not available
      userQuery = userQuery.or(`first_name.ilike.${sessionName},last_name.ilike.${sessionName}`);
    }

    const { data: userData, error: userError } = await userQuery.maybeSingle();

    if (userError) {
      console.error("❌ Error finding user:", userError);
      return res.status(500).json({ success: false, message: "Error finding user in database" });
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User profile not found. Please contact HR to create your employee profile."
      });
    }

    const userId = userData.user_id;

    // Fetch all user-specific data in parallel
    const [profile, attendanceLogs, overtimeSummary, leaveBalance, staffVehicles] = await Promise.all([
      getUserProfile(userId),
      getUserAttendanceLogs(userId),
      getUserOvertimeSummary(userId),
      getUserLeaveBalance(userId, null), // Will fetch employment type from profile
      getUserStaffVehicles(userId),
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
        overtimeSummary,
        leaveBalance: finalLeaveBalance,
        staffVehicles,
      },
    });
  } catch (error) {
    console.error("❌ /api/profile/me error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load profile data",
      error: error.message,
    });
  }
}
