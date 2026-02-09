import { supabaseService } from "@/lib/supabaseClient";

const mapHistory = (row = {}) => ({
  id: row.history_id,
  vehicleId: row.vehicle_id,
  jobId: row.job_id,
  description: row.description || "",
  cost: Number(row.cost ?? 0),
  deductFromPayroll: row.deduct_from_payroll !== false,
  recordedAt: row.recorded_at,
  payrollProcessedAt: row.payroll_processed_at || null,
});

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key missing" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { vehicleId, jobNumber, description, cost, deductFromPayroll = true } = req.body || {};

    if (!vehicleId) {
      return res.status(400).json({ success: false, error: "vehicleId is required" });
    }

    let resolvedJobId = null;
    if (jobNumber && String(jobNumber).trim()) {
      const { data: jobRow, error: jobError } = await supabaseService
        .from("jobs")
        .select("id")
        .eq("job_number", String(jobNumber).trim())
        .single();

      if (jobError || !jobRow?.id) {
        return res.status(400).json({
          success: false,
          error: "Job number not found. Please enter a valid job number.",
        });
      }
      resolvedJobId = jobRow.id;
    }

    const payload = {
      vehicle_id: vehicleId,
      job_id: resolvedJobId,
      description: description?.trim() || null,
      cost: Number(cost ?? 0),
      deduct_from_payroll: Boolean(deductFromPayroll),
    };

    const { data, error } = await supabaseService
      .from("staff_vehicle_history")
      .insert([payload])
      .select(
        `
          history_id,
          vehicle_id,
          job_id,
          description,
          cost,
          deduct_from_payroll,
          recorded_at,
          payroll_processed_at
        `
      )
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ success: true, history: mapHistory(data) });
  } catch (error) {
    console.error("❌ staff/vehicle-history error", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to add vehicle history" });
  }
}
