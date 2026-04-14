// API route for logging overtime — inserts into time_records (same as attendance)
// file location: src/pages/api/profile/overtime-sessions.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/database/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { getOvertimePeriodBounds } from "@/lib/database/hr";

async function resolveUserId(req, res) {
  const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null;
  const allowDevBypass =
    devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie));

  if (allowDevBypass) {
    const queryUserId = req.query.userId || req.body?.userId;
    if (queryUserId) return parseInt(queryUserId, 10);

    const { data: firstUser, error: firstUserError } = await supabase
      .from("users")
      .select("user_id")
      .limit(1)
      .single();

    if (firstUserError) throw new Error("Dev bypass enabled but no default user found");
    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions);
  return resolveSessionUserId(session);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const payload = req.body || {};
    const isBulk = payload.bulk === true;
    const userId = await resolveUserId(req, res);

    // --- Bulk overtime: just total hours, no date/login/logout needed ---
    if (isBulk) {
      const totalHours = Number(payload.totalHours ?? 0);
      if (!(totalHours > 0)) {
        return res.status(400).json({ success: false, message: "Total hours must be greater than 0." });
      }

      const today = new Date().toISOString().slice(0, 10);
      const bulkNote = payload.note ? `Bulk Overtime - ${payload.note}` : "Bulk Overtime";

      const { data: inserted, error: insertError } = await supabase
        .from("time_records")
        .insert({
          user_id: userId,
          date: today,
          clock_in: `${today}T00:00:00`,
          clock_out: `${today}T00:00:00`,
          hours_worked: totalHours,
          break_minutes: 0,
          notes: bulkNote,
        })
        .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
        .single();

      if (insertError) {
        console.error("Failed to insert bulk overtime record:", insertError);
        return res.status(500).json({ success: false, message: "Failed to save bulk overtime." });
      }

      // Also insert into overtime_sessions for payroll tracking
      let period = null;
      const { data: existingPeriod } = await supabase
        .from("overtime_periods")
        .select("*")
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPeriod && today >= existingPeriod.period_start && today <= existingPeriod.period_end) {
        period = existingPeriod;
      } else {
        const sessionDate = new Date(today);
        const { periodStart: pStart, periodEnd: pEnd } = getOvertimePeriodBounds(sessionDate);
        const { data: created } = await supabase
          .from("overtime_periods")
          .insert({ period_start: pStart, period_end: pEnd, status: "open" })
          .select("*")
          .single();
        period = created;
      }

      if (period) {
        await supabase.from("overtime_sessions").insert({
          period_id: period.period_id,
          user_id: userId,
          date: today,
          start_time: null,
          end_time: null,
          total_hours: totalHours,
          approved_by: userId,
          notes: bulkNote,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: inserted.id,
          userId: inserted.user_id,
          date: inserted.date,
          start: null,
          end: null,
          clockIn: null,
          clockOut: null,
          totalHours,
          status: "Overtime",
          type: "Overtime",
          notes: bulkNote,
        },
      });
    }

    // --- Single overtime entry (existing logic) ---
    const date = payload.date;
    const start = payload.start || payload.login || null;
    let end = payload.end || payload.logout || null;
    let totalHours = Number(payload.totalHours ?? payload.hours ?? 0);

    if (!date || !start) {
      return res.status(400).json({ success: false, message: "date and login time are required" });
    }

    if (!end && !(totalHours > 0)) {
      return res.status(400).json({ success: false, message: "Provide either logout time or total hours." });
    }

    const clockIn = `${date}T${start}:00`;
    const startMs = new Date(clockIn).getTime();

    if (Number.isNaN(startMs)) {
      return res.status(400).json({ success: false, message: "Invalid login time." });
    }

    let endMs = null;
    if (end) {
      endMs = new Date(`${date}T${end}:00`).getTime();
      if (Number.isNaN(endMs) || endMs <= startMs) {
        return res.status(400).json({ success: false, message: "Logout time must be after login time." });
      }
      totalHours = Number(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));
    } else {
      endMs = startMs + totalHours * 60 * 60 * 1000;
      const computedEnd = new Date(endMs);
      end = computedEnd.toTimeString().slice(0, 5);
      totalHours = Number(totalHours.toFixed(2));
    }

    if (!(totalHours > 0)) {
      return res.status(400).json({ success: false, message: "Total hours must be greater than 0." });
    }

    const clockOut = `${date}T${end}:00`;

    // Insert into time_records — same table as regular attendance, tagged as Overtime via notes
    const { data: inserted, error: insertError } = await supabase
      .from("time_records")
      .insert({
        user_id: userId,
        date,
        clock_in: clockIn,
        clock_out: clockOut,
        hours_worked: totalHours,
        break_minutes: 0,
        notes: "Overtime",
      })
      .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
      .single();

    if (insertError) {
      console.error("Failed to insert overtime record into time_records:", insertError);
      return res.status(500).json({ success: false, message: "Failed to save overtime log." });
    }

    // Also insert into overtime_sessions for HR payroll tracking
    // Auto-create an overtime period for the 26th-to-25th cycle if none exists
    let period = null;
    const { data: existingPeriod } = await supabase
      .from("overtime_periods")
      .select("*")
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Check if the most recent period covers the session date
    if (existingPeriod && date >= existingPeriod.period_start && date <= existingPeriod.period_end) {
      period = existingPeriod; // existing period covers the session date
    } else {
      const sessionDate = new Date(date); // use the session date for period bounds
      const { periodStart: pStart, periodEnd: pEnd } = getOvertimePeriodBounds(sessionDate);
      const { data: created } = await supabase
        .from("overtime_periods")
        .insert({ period_start: pStart, period_end: pEnd, status: "open" })
        .select("*")
        .single();
      period = created;
    }

    if (period) {
      // Auto-approve overtime sessions (no HR approval needed)
      // Set approved_by to the user's own ID for automatic payroll inclusion
      const { error: overtimeError } = await supabase
        .from("overtime_sessions")
        .insert({
          period_id: period.period_id,
          user_id: userId,
          date,
          start_time: start,
          end_time: end,
          total_hours: totalHours,
          approved_by: userId, // Auto-approved for payroll
          notes: "Overtime - Auto-approved",
        });

      if (overtimeError) {
        console.warn("Failed to insert into overtime_sessions (non-critical):", overtimeError);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        id: inserted.id,
        userId: inserted.user_id,
        date: inserted.date,
        start,
        end,
        clockIn: inserted.clock_in,
        clockOut: inserted.clock_out,
        totalHours: Number(inserted.hours_worked || 0),
        status: "Overtime",
        type: "Overtime",
      },
    });
  } catch (error) {
    console.error("overtime log API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
