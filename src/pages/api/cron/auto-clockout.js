// Cron endpoint to auto-close all stale clocking records at midnight
// Finds all time_records where clock_out IS NULL and date < today
// Sets clock_out to 23:59:59 of the record's date and calculates hours_worked
// Can be called by Vercel Cron, external scheduler, or manually
import { supabase } from "@/lib/supabaseClient";

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
    const today = new Date().toISOString().split("T")[0];

    // Find all stale active records from before today
    const { data: staleRecords, error: fetchError } = await supabase
      .from("time_records")
      .select("id, user_id, date, clock_in")
      .is("clock_out", null)
      .lt("date", today);

    if (fetchError) {
      console.error("Failed to fetch stale records:", fetchError);
      return res.status(500).json({ success: false, message: "Failed to fetch stale records." });
    }

    if (!staleRecords || staleRecords.length === 0) {
      return res.status(200).json({ success: true, message: "No stale records found.", closed: 0 });
    }

    let closed = 0;
    const errors = [];

    for (const record of staleRecords) {
      const clockOutTime = `${record.date}T23:59:59.000Z`;
      const clockInTime = new Date(record.clock_in);
      const clockOut = new Date(clockOutTime);
      const hoursWorked = Number(((clockOut - clockInTime) / (1000 * 60 * 60)).toFixed(2));

      const dayOfWeek = new Date(record.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const notes = isWeekend ? "Weekend - Auto-closed at midnight" : "Auto-closed at midnight";

      const { error: updateError } = await supabase
        .from("time_records")
        .update({
          clock_out: clockOutTime,
          hours_worked: hoursWorked,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.id);

      if (updateError) {
        console.error(`Failed to close record ${record.id}:`, updateError);
        errors.push({ id: record.id, error: updateError.message });
      } else {
        closed++;
        console.log(`Auto-closed record ${record.id} for user ${record.user_id} from ${record.date} (${hoursWorked} hrs)`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Auto-closed ${closed} of ${staleRecords.length} stale records.`,
      closed,
      total: staleRecords.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Auto-clockout cron error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
