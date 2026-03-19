// Cron endpoint to auto-log overtime from recurring rules for today
// Queries overtime_recurring_rules for today's day-of-week, skips if already logged
// Inserts into time_records + overtime_sessions for each active rule
// Can be called by Vercel Cron, external scheduler, or manually
// file location: src/pages/api/cron/overtime-recurring.js
import { supabase } from "@/lib/supabaseClient";
import { getOvertimePeriodBounds } from "@/lib/database/hr";

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

    // Fetch all active rules for today's day of week
    const { data: rules, error: rulesError } = await supabase
      .from("overtime_recurring_rules")
      .select("rule_id, user_id, day_of_week, hours")
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

    let created = 0;
    const errors = [];

    for (const rule of rules) {
      // Check if overtime already exists for this user on today's date
      const { data: existing } = await supabase
        .from("overtime_sessions")
        .select("session_id")
        .eq("user_id", rule.user_id)
        .eq("date", today)
        .limit(1)
        .maybeSingle();

      if (existing) {
        continue; // skip — already logged for today
      }

      // Calculate start and end times — default start 17:00, end calculated from hours
      const startTime = "17:00"; // default overtime start
      const hoursNum = Number(rule.hours);
      const startMs = new Date(`${today}T${startTime}:00`).getTime();
      const endMs = startMs + hoursNum * 60 * 60 * 1000; // add hours in ms
      const endDate = new Date(endMs);
      const endTime = endDate.toTimeString().slice(0, 5); // "HH:MM" format

      const clockIn = `${today}T${startTime}:00`; // full timestamp for time_records
      const clockOut = `${today}T${endTime}:00`; // full timestamp for time_records

      // Insert into time_records (general attendance table, tagged as Overtime)
      const { data: inserted, error: insertError } = await supabase
        .from("time_records")
        .insert({
          user_id: rule.user_id,
          date: today,
          clock_in: clockIn,
          clock_out: clockOut,
          hours_worked: hoursNum,
          break_minutes: 0,
          notes: "Overtime - Recurring",
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(`Failed to insert time_record for user ${rule.user_id}:`, insertError);
        errors.push({ userId: rule.user_id, error: insertError.message });
        continue;
      }

      // Insert into overtime_sessions for HR payroll tracking
      if (period) {
        const { error: overtimeError } = await supabase
          .from("overtime_sessions")
          .insert({
            period_id: period.period_id,
            user_id: rule.user_id,
            date: today,
            start_time: startTime,
            end_time: endTime,
            total_hours: hoursNum,
            approved_by: rule.user_id, // auto-approved
            notes: "Overtime - Recurring",
          });

        if (overtimeError) {
          console.warn(`Failed to insert overtime_session for user ${rule.user_id} (non-critical):`, overtimeError);
        }
      }

      created++;
      console.log(`Auto-logged ${hoursNum}h recurring overtime for user ${rule.user_id} on ${today}`);
    }

    return res.status(200).json({
      success: true,
      message: `Created ${created} recurring overtime sessions for ${today} (day ${dayOfWeek}).`,
      created,
      total: rules.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Recurring overtime cron error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
