// API route for managing recurring overtime rules per day of week
// GET — fetch user's rules, PUT — upsert rules array
// file location: src/pages/api/profile/overtime-recurring-rules.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";

async function resolveUserId(req, res) {
  const devBypassEnv = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true"; // dev auth bypass flag
  const devRolesCookie = req.cookies?.["hnp-dev-roles"] || null; // dev roles cookie
  const allowDevBypass =
    devBypassEnv || (process.env.NODE_ENV !== "production" && Boolean(devRolesCookie)); // allow bypass in dev

  if (allowDevBypass) {
    const queryUserId = req.query.userId || req.body?.userId; // check query or body for userId
    if (queryUserId) return parseInt(queryUserId, 10);

    const { data: firstUser, error: firstUserError } = await supabase
      .from("users")
      .select("user_id")
      .limit(1)
      .single(); // fallback to first user in dev

    if (firstUserError) throw new Error("Dev bypass enabled but no default user found");
    return firstUser.user_id;
  }

  const session = await getServerSession(req, res, authOptions); // resolve from NextAuth session
  return resolveSessionUserId(session);
}

export default async function handler(req, res) {
  try {
    const userId = await resolveUserId(req, res); // authenticate user

    if (req.method === "GET") {
      // Fetch all recurring rules for this user, ordered by day of week
      const { data, error } = await supabase
        .from("overtime_recurring_rules")
        .select("rule_id, day_of_week, hours, active")
        .eq("user_id", userId)
        .order("day_of_week"); // 0=Sun, 1=Mon, ... 6=Sat

      if (error) {
        console.error("Failed to fetch recurring rules:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch recurring rules." });
      }

      return res.status(200).json({ success: true, data: data || [] }); // return rules array
    }

    if (req.method === "PUT") {
      const { rules } = req.body || {}; // expect { rules: [{ dayOfWeek, hours, active }] }

      if (!Array.isArray(rules)) {
        return res.status(400).json({ success: false, message: "rules must be an array" });
      }

      // Validate each rule before upserting
      for (const rule of rules) {
        if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
          return res.status(400).json({ success: false, message: `Invalid day_of_week: ${rule.dayOfWeek}` });
        }
        if (rule.active && (!rule.hours || Number(rule.hours) <= 0)) {
          return res.status(400).json({ success: false, message: `Hours must be > 0 for active rules (day ${rule.dayOfWeek})` });
        }
      }

      // Build rows for upsert — one per day of week
      const rows = rules.map((r) => ({
        user_id: userId,
        day_of_week: r.dayOfWeek,
        hours: Number(r.hours) || 0,
        active: r.active !== false,
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase
        .from("overtime_recurring_rules")
        .upsert(rows, { onConflict: "user_id,day_of_week" }) // upsert by unique constraint
        .select("rule_id, day_of_week, hours, active");

      if (error) {
        console.error("Failed to upsert recurring rules:", error);
        return res.status(500).json({ success: false, message: "Failed to save recurring rules." });
      }

      return res.status(200).json({ success: true, data: data || [] }); // return saved rules
    }

    // Method not allowed for anything other than GET/PUT
    res.setHeader("Allow", ["GET", "PUT"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("overtime recurring rules API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
