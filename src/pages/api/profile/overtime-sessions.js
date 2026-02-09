// API route for logging overtime — inserts into time_records (same as attendance)
// file location: src/pages/api/profile/overtime-sessions.js
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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { date, start, end } = req.body || {};

    if (!date || !start || !end) {
      return res.status(400).json({ success: false, message: "date, start, and end fields are required" });
    }

    const userId = await resolveUserId(req, res);

    // Build full timestamps from date + time
    const clockIn = `${date}T${start}:00`;
    const clockOut = `${date}T${end}:00`;

    const startMs = new Date(clockIn).getTime();
    const endMs = new Date(clockOut).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return res.status(400).json({ success: false, message: "End time must be after start time." });
    }

    const hoursWorked = Number(((endMs - startMs) / (1000 * 60 * 60)).toFixed(2));

    // Insert into time_records — same table as regular attendance, tagged as Overtime via notes
    const { data: inserted, error: insertError } = await supabase
      .from("time_records")
      .insert({
        user_id: userId,
        date,
        clock_in: clockIn,
        clock_out: clockOut,
        hours_worked: hoursWorked,
        break_minutes: 0,
        notes: "Overtime",
      })
      .select("id, user_id, date, clock_in, clock_out, hours_worked, notes")
      .single();

    if (insertError) {
      console.error("Failed to insert overtime record:", insertError);
      return res.status(500).json({ success: false, message: "Failed to save overtime log." });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: inserted.id,
        userId: inserted.user_id,
        date: inserted.date,
        clockIn: inserted.clock_in,
        clockOut: inserted.clock_out,
        totalHours: Number(inserted.hours_worked || 0),
        status: "Overtime",
      },
    });
  } catch (error) {
    console.error("overtime log API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
