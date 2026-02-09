import { supabaseService } from "@/lib/supabaseClient";

const mapVehicle = (row = {}) => ({
  id: row.vehicle_id,
  userId: row.user_id,
  make: row.make || "",
  model: row.model || "",
  registration: row.registration || "",
  vin: row.vin || "",
  colour: row.colour || "",
  payrollDeductionEnabled: row.payroll_deduction_enabled !== false,
  payrollDeductionReference: row.payroll_deduction_reference || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  history: [],
});

export default async function handler(req, res) {
  if (!supabaseService) {
    return res.status(500).json({ success: false, error: "Service role key missing" });
  }

  if (!["POST", "PUT", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", ["POST", "PUT", "DELETE"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    if (req.method === "POST") {
      const {
        userId,
        make,
        model,
        registration,
        vin,
        colour,
        payrollDeductionEnabled = true,
        payrollDeductionReference,
      } = req.body || {};

      if (!userId || !registration) {
        return res.status(400).json({
          success: false,
          error: "userId and registration are required",
        });
      }

      const payload = {
        user_id: Number(userId),
        make: make?.trim() || null,
        model: model?.trim() || null,
        registration: registration.trim().toUpperCase(),
        vin: vin?.trim() || null,
        colour: colour?.trim() || null,
        payroll_deduction_enabled: Boolean(payrollDeductionEnabled),
        payroll_deduction_reference: payrollDeductionReference?.trim() || null,
      };

      const { data, error } = await supabaseService
        .from("staff_vehicles")
        .insert([payload])
        .select(
          `
            vehicle_id,
            user_id,
            make,
            model,
            registration,
            vin,
            colour,
            payroll_deduction_enabled,
            payroll_deduction_reference,
            created_at,
            updated_at
          `
        )
        .single();

      if (error) {
        throw error;
      }

      return res.status(201).json({ success: true, vehicle: mapVehicle(data) });
    }

    if (req.method === "PUT") {
      const {
        vehicleId,
        make,
        model,
        registration,
        vin,
        colour,
        payrollDeductionEnabled,
        payrollDeductionReference,
      } = req.body || {};

      if (!vehicleId) {
        return res.status(400).json({ success: false, error: "vehicleId is required" });
      }

      const payload = {
        make: make?.trim() || null,
        model: model?.trim() || null,
        registration: registration?.trim() ? registration.trim().toUpperCase() : null,
        vin: vin?.trim() || null,
        colour: colour?.trim() || null,
        payroll_deduction_enabled:
          payrollDeductionEnabled === undefined ? true : Boolean(payrollDeductionEnabled),
        payroll_deduction_reference: payrollDeductionReference?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseService
        .from("staff_vehicles")
        .update(payload)
        .eq("vehicle_id", vehicleId)
        .select(
          `
            vehicle_id,
            user_id,
            make,
            model,
            registration,
            vin,
            colour,
            payroll_deduction_enabled,
            payroll_deduction_reference,
            created_at,
            updated_at
          `
        )
        .single();

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true, vehicle: mapVehicle(data) });
    }

    if (req.method === "DELETE") {
      const { vehicleId } = req.body || {};
      if (!vehicleId) {
        return res.status(400).json({ success: false, error: "vehicleId is required" });
      }

      const { error: historyError } = await supabaseService
        .from("staff_vehicle_history")
        .delete()
        .eq("vehicle_id", vehicleId);

      if (historyError) {
        throw historyError;
      }

      const { error } = await supabaseService
        .from("staff_vehicles")
        .delete()
        .eq("vehicle_id", vehicleId);

      if (error) {
        throw error;
      }

      return res.status(200).json({ success: true });
    }
  } catch (error) {
    console.error("❌ staff/vehicles error", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to update staff vehicle" });
  }
}
