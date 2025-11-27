import { supabaseService } from "@/lib/supabaseClient";

const DEFAULT_STATUS = ["planned", "en_route"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  if (!supabaseService) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY for delivery scheduling.");
    return res.status(500).json({ success: false, message: "Server misconfiguration." });
  }

  const {
    jobId,
    deliveryId,
    createDelivery = null,
    address,
    postcode,
    notes,
  } = req.body || {};

  if (!jobId) {
    return res.status(400).json({ success: false, message: "jobId is required." });
  }

  try {
    const { data: jobRow, error: jobError } = await supabaseService
      .from("jobs")
      .select("id, customer_id, customer:customers(firstname, lastname, name, address, postcode)")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    if (!jobRow) {
      return res.status(404).json({ success: false, message: "Job not found." });
    }

    let targetDeliveryId = deliveryId;
    if (!targetDeliveryId && createDelivery) {
      const { data: newDelivery, error: deliveryError } = await supabaseService
        .from("deliveries")
        .insert([
          {
            delivery_date: createDelivery.deliveryDate || new Date().toISOString().slice(0, 10),
            vehicle_reg: createDelivery.vehicleReg || null,
            fuel_type: createDelivery.fuelType || null,
            notes: createDelivery.notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select("id")
        .single();

      if (deliveryError) throw deliveryError;
      targetDeliveryId = newDelivery.id;
    }

    if (!targetDeliveryId) {
      return res
        .status(400)
        .json({ success: false, message: "Delivery selection or new route creation is required." });
    }

    const { data: lastStop, error: lastStopError } = await supabaseService
      .from("delivery_stops")
      .select("stop_number")
      .eq("delivery_id", targetDeliveryId)
      .order("stop_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastStopError) throw lastStopError;

    const nextStopNumber = (lastStop?.stop_number || 0) + 1;

    const stopPayload = {
      delivery_id: targetDeliveryId,
      stop_number: nextStopNumber,
      job_id: jobRow.id,
      customer_id: jobRow.customer_id,
      address: address || jobRow.customer?.address || null,
      postcode: postcode || jobRow.customer?.postcode || null,
      notes: notes || null,
      status: "planned",
      mileage_for_leg: 0,
      estimated_fuel_cost: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: inserted, error: insertError } = await supabaseService
      .from("delivery_stops")
      .insert([stopPayload])
      .select("*, delivery:deliveries(id, delivery_date)")
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({ success: true, stop: inserted, deliveryId: targetDeliveryId });
  } catch (error) {
    console.error("Failed to schedule stop:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Unable to schedule stop." });
  }
}
