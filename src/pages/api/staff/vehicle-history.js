import { supabaseService } from "@/lib/database/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { syncStaffVehiclePayrollDeduction } from "@/lib/profile/staffVehiclePayrollDeductions";

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

async function handler(req, res, session) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key missing" });
  }

  if (!["POST", "PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    if (req.method === "DELETE") {
      const { historyId } = req.body || {};
      if (!historyId) {
        return res.status(400).json({ success: false, error: "historyId is required" });
      }

      const { error } = await supabaseService
        .from("staff_vehicle_history")
        .delete()
        .eq("history_id", historyId);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    const {
      historyId,
      vehicleId,
      jobNumber,
      description,
      cost,
      deductFromPayroll,
      recordedAt,
    } = req.body || {};

    if (req.method === "POST" && !vehicleId) {
      return res.status(400).json({ success: false, error: "vehicleId is required" });
    }
    if (req.method === "PUT" && !historyId) {
      return res.status(400).json({ success: false, error: "historyId is required" });
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

    let effectiveVehicleId = vehicleId;
    let existingHistoryRow = null;
    if (req.method === "PUT") {
      const { data: existingHistory, error: existingHistoryError } = await supabaseService
        .from("staff_vehicle_history")
        .select("history_id, vehicle_id, job_id, description, cost, deduct_from_payroll, recorded_at")
        .eq("history_id", historyId)
        .single();

      if (existingHistoryError || !existingHistory?.vehicle_id) {
        return res.status(404).json({ success: false, error: "Vehicle history entry not found" });
      }

      existingHistoryRow = existingHistory;
      effectiveVehicleId = existingHistory.vehicle_id;
    }

    const { data: vehicleRow, error: vehicleError } = await supabaseService
      .from("staff_vehicles")
      .select("vehicle_id, user_id")
      .eq("vehicle_id", effectiveVehicleId)
      .single();

    if (vehicleError || !vehicleRow?.user_id) {
      return res.status(404).json({ success: false, error: "Vehicle not found" });
    }

    const payload = {
      vehicle_id: effectiveVehicleId,
      job_id:
        req.method === "PUT" && !jobNumber
          ? existingHistoryRow?.job_id ?? null
          : resolvedJobId,
      description:
        description === undefined
          ? existingHistoryRow?.description ?? null
          : description?.trim() || null,
      cost:
        cost === undefined
          ? Number(existingHistoryRow?.cost ?? 0)
          : Number(cost ?? 0),
      deduct_from_payroll:
        deductFromPayroll === undefined
          ? req.method === "PUT"
            ? existingHistoryRow?.deduct_from_payroll !== false
            : true
          : Boolean(deductFromPayroll),
    };
    if (recordedAt || existingHistoryRow?.recorded_at) {
      payload.recorded_at = recordedAt || existingHistoryRow?.recorded_at;
    }

    const query =
      req.method === "POST"
        ? supabaseService.from("staff_vehicle_history").insert([payload])
        : supabaseService.from("staff_vehicle_history").update(payload).eq("history_id", historyId);

    const { data, error } = await query
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

    await syncStaffVehiclePayrollDeduction(
      {
        historyId: data.history_id,
        vehicleId: data.vehicle_id,
        userId: vehicleRow.user_id,
        recordedAt: data.recorded_at,
        cost: data.cost,
        deductFromPayroll: data.deduct_from_payroll,
      },
      supabaseService
    );

    return res.status(req.method === "POST" ? 201 : 200).json({ success: true, history: mapHistory(data) });
  } catch (error) {
    console.error("❌ staff/vehicle-history error", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to add vehicle history" });
  }
}

export default withRoleGuard(handler);
