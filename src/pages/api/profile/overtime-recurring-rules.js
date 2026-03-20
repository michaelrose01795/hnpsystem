// API route for managing recurring overtime rules per day of week
// GET — fetch user's rules, PUT — upsert rules array, DELETE — remove rules by id
// Supports pattern_type (weekly/alternate) and week_parity (odd/even) for recurring patterns
// file location: src/pages/api/profile/overtime-recurring-rules.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { supabase } from "@/lib/supabaseClient";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";

const SELECT_FIELDS = "rule_id, day_of_week, hours, active, pattern_type, week_parity, label"; // fields returned to client

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

// Find an existing rule matching the composite unique key (user_id, day_of_week, pattern_type, week_parity)
async function findExistingRule(userId, row) {
  let query = supabase
    .from("overtime_recurring_rules")
    .select("rule_id")
    .eq("user_id", userId)
    .eq("day_of_week", row.day_of_week)
    .eq("pattern_type", row.pattern_type);

  // Handle NULL week_parity correctly — .is() for null, .eq() for values
  if (row.week_parity === null || row.week_parity === undefined) {
    query = query.is("week_parity", null);
  } else {
    query = query.eq("week_parity", row.week_parity);
  }

  const { data } = await query.maybeSingle(); // returns null if not found
  return data;
}

export default async function handler(req, res) {
  try {
    const userId = await resolveUserId(req, res); // authenticate user

    // ── GET — fetch all recurring rules for this user ──
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("overtime_recurring_rules")
        .select(SELECT_FIELDS)
        .eq("user_id", userId)
        .order("day_of_week"); // 0=Sun, 1=Mon, ... 6=Sat

      if (error) {
        console.error("Failed to fetch recurring rules:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch recurring rules." });
      }

      return res.status(200).json({ success: true, data: data || [] }); // return rules array
    }

    // ── PUT — upsert rules (find-then-update-or-insert for composite unique key) ──
    if (req.method === "PUT") {
      const { rules } = req.body || {}; // expect { rules: [{ dayOfWeek, hours, active, patternType?, weekParity?, label? }] }

      if (!Array.isArray(rules)) {
        return res.status(400).json({ success: false, message: "rules must be an array" });
      }

      // Validate each rule before saving
      for (const rule of rules) {
        if (rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
          return res.status(400).json({ success: false, message: `Invalid day_of_week: ${rule.dayOfWeek}` });
        }
        if (rule.active && (!rule.hours || Number(rule.hours) <= 0)) {
          return res.status(400).json({ success: false, message: `Hours must be > 0 for active rules (day ${rule.dayOfWeek})` });
        }
        const pt = rule.patternType || "weekly"; // default to weekly
        const wp = rule.weekParity || null;
        if (!["weekly", "alternate"].includes(pt)) {
          return res.status(400).json({ success: false, message: `Invalid pattern_type: ${pt}` });
        }
        if (pt === "alternate" && !["odd", "even"].includes(wp)) {
          return res.status(400).json({ success: false, message: `Alternate rules require weekParity (odd/even) for day ${rule.dayOfWeek}` });
        }
        if (pt === "weekly" && wp) {
          return res.status(400).json({ success: false, message: `Weekly rules must not have weekParity (day ${rule.dayOfWeek})` });
        }
      }

      // Build normalised row objects
      const rows = rules.map((r) => ({
        user_id: userId,
        day_of_week: r.dayOfWeek,
        hours: Number(r.hours) || 0,
        active: r.active !== false,
        pattern_type: r.patternType || "weekly",
        week_parity: r.weekParity || null,
        label: r.label || null,
        updated_at: new Date().toISOString(),
      }));

      const savedRules = []; // collect all saved rule data for response
      const errors = [];

      // Process each rule individually — find existing then update or insert
      for (const row of rows) {
        try {
          const existing = await findExistingRule(userId, row); // match composite key

          if (existing) {
            // Update existing rule
            const { data: updated, error: updateErr } = await supabase
              .from("overtime_recurring_rules")
              .update({ hours: row.hours, active: row.active, label: row.label, updated_at: row.updated_at })
              .eq("rule_id", existing.rule_id)
              .select(SELECT_FIELDS)
              .single();
            if (updateErr) throw updateErr;
            if (updated) savedRules.push(updated);
          } else {
            // Insert new rule
            const { data: inserted, error: insertErr } = await supabase
              .from("overtime_recurring_rules")
              .insert(row)
              .select(SELECT_FIELDS)
              .single();
            if (insertErr) throw insertErr;
            if (inserted) savedRules.push(inserted);
          }
        } catch (rowErr) {
          console.error(`Failed to save rule for day ${row.day_of_week}:`, rowErr);
          errors.push({ dayOfWeek: row.day_of_week, error: rowErr.message });
        }
      }

      if (errors.length > 0 && savedRules.length === 0) {
        return res.status(500).json({ success: false, message: "Failed to save recurring rules.", errors });
      }

      return res.status(200).json({ success: true, data: savedRules, errors: errors.length > 0 ? errors : undefined });
    }

    // ── DELETE — remove rules by rule_id array ──
    if (req.method === "DELETE") {
      const { ruleIds } = req.body || {}; // expect { ruleIds: [1, 2, 3] }

      if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
        return res.status(400).json({ success: false, message: "ruleIds must be a non-empty array" });
      }

      // Only delete rules belonging to this user (security: prevent deleting other users' rules)
      const { error } = await supabase
        .from("overtime_recurring_rules")
        .delete()
        .eq("user_id", userId)
        .in("rule_id", ruleIds);

      if (error) {
        console.error("Failed to delete recurring rules:", error);
        return res.status(500).json({ success: false, message: "Failed to delete rules." });
      }

      return res.status(200).json({ success: true, deleted: ruleIds.length });
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("overtime recurring rules API error:", error);
    return res
      .status(error.message === "Authentication required" ? 401 : 500)
      .json({ success: false, message: error.message });
  }
}
