// Cron endpoint to auto-log overtime from recurring rules for today
// Queries overtime_recurring_rules for today's day-of-week, filters by pattern/parity,
// sums hours across all matching rules per user, creates one overtime entry per user
// Can be called by Vercel Cron, external scheduler, or manually
// file location: src/pages/api/cron/overtime-recurring.js
import { supabase } from "@/lib/database/supabaseClient";
import { getOvertimePeriodBounds } from "@/lib/database/hr";
import { doesRuleMatchDate } from "@/lib/overtime/recurringUtils";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // Verify cron secret (skip in dev mode)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const now = new Date();
    const today = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ... 6=Saturday

    // Skip Sundays — no recurring overtime rules for Sunday
    if (dayOfWeek === 0) {
      return res.status(200).json({ success: true, message: "Sundays are excluded from recurring overtime.", created: 0 });
    }

    // Fetch all active rules for today's day of week (multiple rules per user possible)
    const { data: rules, error: rulesError } = await supabase
      .from("overtime_recurring_rules")
      .select("rule_id, user_id, day_of_week, hours, pattern_type, week_parity") // include pattern fields
      .eq("day_of_week", dayOfWeek)
      .eq("active", true);

    if (rulesError) {
      console.error("Failed to fetch recurring rules:", rulesError);
      return res.status(500).json({ success: false, message: "Failed to fetch recurring rules." });
    }

    if (!rules || rules.length === 0) {
      return res.status(200).json({ success: true, message: "No active rules for today.", created: 0 });
    }

    // Get or create the overtime period for today's 26th-to-25th cycle
    const { periodStart, periodEnd } = getOvertimePeriodBounds(now);
    let period = null;

    const { data: existingPeriod } = await supabase
      .from("overtime_periods")
      .select("*")
      .gte("period_end", today) // period end >= today
      .lte("period_start", today) // period start <= today
      .limit(1)
      .maybeSingle();

    if (existingPeriod) {
      period = existingPeriod; // use existing period that covers today
    } else {
      const { data: created } = await supabase
        .from("overtime_periods")
        .insert({ period_start: periodStart, period_end: periodEnd, status: "open" })
        .select("*")
        .single();
      period = created; // newly created period
    }

    // Group rules by user_id so we can sum matching hours per user
    const rulesByUser = {};
    for (const rule of rules) {
      if (!rulesByUser[rule.user_id]) rulesByUser[rule.user_id] = [];
      rulesByUser[rule.user_id].push(rule);
    }

    let created = 0;
    const errors = [];

    for (const [userIdStr, userRules] of Object.entries(rulesByUser)) {
      const uid = Number(userIdStr);

      // Filter rules that match today's date (weekly always matches, alternate checks parity)
      const matchingRules = userRules.filter((r) => doesRuleMatchDate(r, now));
      if (matchingRules.length === 0) continue; // no pattern matches today for this user

      // Sum hours across all matching rules (additive logic)
      const totalHours = matchingRules.reduce((sum, r) => sum + Number(r.hours), 0);
      if (totalHours <= 0) continue; // safety: skip zero-hour entries

      // Idempotency check — skip if recurring overtime already logged for this user+date
      const { data: existing } = await supabase
        .from("overtime_sessions")
        .select("session_id")
        .eq("user_id", uid)
        .eq("date", today)
        .eq("notes", "Overtime - Recurring") // only check recurring entries, not manual ones
        .limit(1)
        .maybeSingle();

      if (existing) continue; // already processed today

      // Calculate start and end times — default start 17:00, end calculated from total hours
      const startTime = "17:00";
      const startMs = new Date(`${today}T${startTime}:00`).getTime();
      const endMs = startMs + totalHours * 60 * 60 * 1000; // add summed hours in ms
      const endDate = new Date(endMs);
      const endTime = endDate.toTimeString().slice(0, 5); // "HH:MM" format

      const clockIn = `${today}T${startTime}:00`; // full timestamp for time_records
      const clockOut = `${today}T${endTime}:00`; // full timestamp for time_records

      // Insert single time_records entry with summed hours
      const { data: inserted, error: insertError } = await supabase
        .from("time_records")
        .insert({
          user_id: uid,
          date: today,
          clock_in: clockIn,
          clock_out: clockOut,
          hours_worked: totalHours,
          break_minutes: 0,
          notes: "Overtime - Recurring",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`Failed to insert time_record for user ${uid}:`, insertError);
        errors.push({ userId: uid, error: insertError.message });
        continue;
      }

      // Insert single overtime_sessions entry for HR payroll tracking
      if (period) {
        const { error: overtimeError } = await supabase
          .from("overtime_sessions")
          .insert({
            period_id: period.period_id,
            user_id: uid,
            date: today,
            start_time: startTime,
            end_time: endTime,
            total_hours: totalHours,
            approved_by: uid, // auto-approved
            notes: "Overtime - Recurring",
          });

        if (overtimeError) {
          console.warn(`Failed to insert overtime_session for user ${uid} (non-critical):`, overtimeError);
        }
      }

      created++;
      console.log(`Auto-logged ${totalHours}h recurring overtime for user ${uid} on ${today} (${matchingRules.length} rule${matchingRules.length > 1 ? "s" : ""} matched)`);
    }

    return res.status(200).json({
      success: true,
      message: `Created ${created} recurring overtime sessions for ${today} (day ${dayOfWeek}).`,
      created,
      total: Object.keys(rulesByUser).length, // total unique users with rules
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Recurring overtime cron error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
