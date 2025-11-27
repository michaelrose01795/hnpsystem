import { supabaseService } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ success: false, message: "customerId is required" });
  }

  if (!supabaseService) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is required for this endpoint.");
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  try {
    const { data, error } = await supabaseService
      .from("delivery_stops")
      .select(
        `
        id,
        stop_number,
        status,
        notes,
        mileage_for_leg,
        estimated_fuel_cost,
        delivery:deliveries(
          id,
          delivery_date,
          driver_id,
          vehicle_reg,
          fuel_type
        ),
        job:jobs(
          id,
          job_number,
          delivery_confirmed_at
        )
      `
      )
      .eq("customer_id", customerId)
      .order("stop_number", { ascending: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({
      success: true,
      stops: data || [],
    });
  } catch (err) {
    console.error("Unable to load customer deliveries:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to load deliveries",
    });
  }
}
