// API endpoint for clock-in / clock-out
// Uses the existing time_records table for attendance tracking
// POST { action: "clock-in" } or { action: "clock-out" }
// GET returns today's active clock-in record (if any)
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

export default async function handler(req, res) {
  try {
    const userId = await resolveUserId(req, res);
    const today = new Date().toISOString().split("T")[0];

    if (req.method === "GET") {
      // Return today's active (un-clocked-out) record
      const { data: activeRecord, error } = await supabase
        .from("time_records")
        .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
        .eq("user_id", userId)
        .eq("date", today)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Failed to fetch active clock record:", error);
        return res.status(500).json({ success: false, message: "Failed to check clock status." });
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
        // Check if already clocked in today
        const { data: existing } = await supabase
          .from("time_records")
          .select("id")
          .eq("user_id", userId)
          .eq("date", today)
          .is("clock_out", null)
          .limit(1)
          .maybeSingle();

        if (existing) {
          return res.status(400).json({
            success: false,
            message: "Already clocked in. Please clock out first.",
          });
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
          message: "Clocked in successfully.",
          data: {
            id: inserted.id,
            clockIn: inserted.clock_in,
            date: inserted.date,
          },
        });
      }

      if (action === "clock-out") {
        // Find the active clock-in record for today
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
