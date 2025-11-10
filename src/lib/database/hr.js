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
