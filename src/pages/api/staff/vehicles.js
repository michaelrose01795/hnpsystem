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

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
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
  } catch (error) {
    console.error("❌ staff/vehicles error", error);
    return res
      .status(500)
      .json({ success: false, error: error.message || "Failed to add staff vehicle" });
  }
}
