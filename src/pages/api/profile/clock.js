// API endpoint for clock-in / clock-out
// Uses the existing time_records table for attendance tracking
// POST { action: "clock-in" } or { action: "clock-out" }
// GET returns the active clock-in record (if any), auto-closing stale records from previous days
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";

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
  if (!session?.user) throw new Error("Authentication required");

  const identifier = session.user.email || session.user.name;
  if (!identifier) throw new Error("Unable to resolve user identity");

  let query = supabase.from("users").select("user_id").limit(1);
  if (session.user.email) {
    query = query.eq("email", session.user.email);
  } else {
    query = query.or(`first_name.ilike.${session.user.name},last_name.ilike.${session.user.name}`);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("User profile not found");
  return data.user_id;
}

// Auto-close a stale record from a previous day at midnight of that day
async function autoCloseStaleRecord(record) {
  const clockOutTime = `${record.date}T23:59:59.000Z`;
  const clockInTime = new Date(record.clock_in);
  const clockOut = new Date(clockOutTime);
  const hoursWorked = Number(((clockOut - clockInTime) / (1000 * 60 * 60)).toFixed(2));

  const dayOfWeek = new Date(record.date).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const notes = isWeekend ? "Weekend - Auto-closed at midnight" : "Auto-closed at midnight";

  const { error } = await supabase
    .from("time_records")
    .update({
      clock_out: clockOutTime,
      hours_worked: hoursWorked,
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  if (error) {
    console.error("Failed to auto-close stale record:", record.id, error);
  } else {
    console.log(`Auto-closed stale record ${record.id} from ${record.date} (${hoursWorked} hrs)`);
  }

  return { closedRecord: record, error };
}

export default async function handler(req, res) {
  try {
    const userId = await resolveUserId(req, res);
    const today = new Date().toISOString().split("T")[0];

    if (req.method === "GET") {
      // Find ANY active (un-clocked-out) record for this user
      const { data: activeRecord, error } = await supabase
        .from("time_records")
        .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
        .eq("user_id", userId)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch active clock record:", error);
        return res.status(500).json({ success: false, message: "Failed to check clock status." });
      }

      // If there's an active record from a previous day, auto-close it at midnight
      if (activeRecord && activeRecord.date < today) {
        await autoCloseStaleRecord(activeRecord);
        return res.status(200).json({
          success: true,
          data: {
            isClockedIn: false,
            activeRecord: null,
            autoClosedRecord: {
              id: activeRecord.id,
              date: activeRecord.date,
              message: "Previous session was auto-closed at midnight.",
            },
          },
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          isClockedIn: !!activeRecord,
          activeRecord: activeRecord
            ? {
                id: activeRecord.id,
                clockIn: activeRecord.clock_in,
                date: activeRecord.date,
              }
            : null,
        },
      });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "clock-in") {
        // Check for ANY active (un-clocked-out) record across all dates
        const { data: existing } = await supabase
          .from("time_records")
          .select("id, date, clock_in")
          .eq("user_id", userId)
          .is("clock_out", null)
          .order("clock_in", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          if (existing.date === today) {
            // Already clocked in today — reject
            return res.status(400).json({
              success: false,
              message: "Already clocked in. Please clock out first.",
            });
          }

          // Stale record from a previous day — auto-close it at midnight
          await autoCloseStaleRecord(existing);
        }

        const now = new Date().toISOString();

        const { data: inserted, error: insertError } = await supabase
          .from("time_records")
          .insert({
            user_id: userId,
            date: today,
            clock_in: now,
            clock_out: null,
            hours_worked: 0,
            break_minutes: 0,
            notes: null,
          })
          .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
          .single();

        if (insertError) {
          console.error("Clock-in insert error:", insertError);
          return res.status(500).json({ success: false, message: "Failed to clock in." });
        }

        return res.status(200).json({
          success: true,
          message: existing ? "Previous session auto-closed at midnight. Clocked in successfully." : "Clocked in successfully.",
          data: {
            id: inserted.id,
            clockIn: inserted.clock_in,
            date: inserted.date,
          },
        });
      }

      if (action === "clock-out") {
        // Find the active clock-in record (any date)
        const { data: activeRecord, error: findError } = await supabase
          .from("time_records")
          .select("id, clock_in, date")
          .eq("user_id", userId)
          .is("clock_out", null)
          .order("clock_in", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError || !activeRecord) {
          return res.status(400).json({
            success: false,
            message: "No active clock-in found. Please clock in first.",
          });
        }

        const now = new Date();
        const clockInTime = new Date(activeRecord.clock_in);
        const hoursWorked = Number(((now - clockInTime) / (1000 * 60 * 60)).toFixed(2));

        const recordDate = new Date(activeRecord.date);
        const dayOfWeek = recordDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const { data: updated, error: updateError } = await supabase
          .from("time_records")
          .update({
            clock_out: now.toISOString(),
            hours_worked: hoursWorked,
            notes: isWeekend ? "Weekend" : null,
          })
          .eq("id", activeRecord.id)
          .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
          .single();

        if (updateError) {
          console.error("Clock-out update error:", updateError);
          return res.status(500).json({ success: false, message: "Failed to clock out." });
        }

        return res.status(200).json({
          success: true,
          message: "Clocked out successfully.",
          data: {
            id: updated.id,
            clockIn: updated.clock_in,
            clockOut: updated.clock_out,
            date: updated.date,
            hoursWorked: Number(updated.hours_worked || 0),
          },
        });
      }

      return res.status(400).json({ success: false, message: "Invalid action. Use 'clock-in' or 'clock-out'." });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Clock API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
