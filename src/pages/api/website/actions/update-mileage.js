// file location: src/pages/api/website/actions/update-mileage.js
// Lets a logged-in customer record a fresh mileage reading for one of
// their vehicles. Writes a real row to customer_job_history so the
// mileage chart on the profile updates immediately, and updates the
// vehicles.mileage column so staff see the latest figure in the DMS.
// Also logs a customer_activity_events row so it appears on the
// timeline and staff are aware the reading was self-reported.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const vehicleId = Number(req.body?.vehicle_id);
  const mileage = Number(req.body?.mileage);
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Pick a vehicle." });
  }
  if (!Number.isFinite(mileage) || mileage <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Enter a valid mileage." });
  }

  const client = db();
  // Confirm the vehicle belongs to this customer before touching anything.
  const { data: vehicle, error: vErr } = await client
    .from("vehicles")
    .select("vehicle_id, customer_id, reg_number, make, model")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (vErr || !vehicle || vehicle.customer_id !== session.customerId) {
    return res
      .status(404)
      .json({ success: false, message: "Vehicle not found." });
  }

  const now = new Date().toISOString();
  await Promise.all([
    client.from("customer_job_history").insert({
      customer_id: session.customerId,
      vehicle_reg: vehicle.reg_number,
      vehicle_make_model: [vehicle.make, vehicle.model].filter(Boolean).join(" "),
      mileage_at_service: mileage,
      status_snapshot: "self_reported_mileage",
      recorded_at: now,
    }),
    client
      .from("vehicles")
      .update({ mileage, updated_at: now })
      .eq("vehicle_id", vehicleId),
    client.from("customer_activity_events").insert({
      customer_id: session.customerId,
      vehicle_id: vehicleId,
      activity_type: "mileage_self_reported",
      activity_source: "customer_portal",
      activity_payload: { mileage, reg: vehicle.reg_number },
    }),
  ]);

  return res.status(200).json({ success: true, mileage });
}
