// file location: src/pages/api/messages/customer-requests/[eventId].js
// Fetches a single customer-portal request event so the /create page
// can prefill customer, vehicle, description, and preferred date.

import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";

const db = () => supabaseService || supabase;

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const eventIdRaw = Array.isArray(req.query?.eventId)
    ? req.query.eventId[0]
    : req.query?.eventId;
  const eventId = typeof eventIdRaw === "string" ? eventIdRaw.trim() : "";
  if (!eventId) {
    return res.status(400).json({ success: false, message: "Invalid event id." });
  }

  const client = db();
  const { data: event, error } = await client
    .from("customer_activity_events")
    .select(
      "event_id, customer_id, vehicle_id, job_id, activity_type, activity_payload, occurred_at",
    )
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("/api/messages/customer-requests/[eventId]:", error.message);
    return res.status(500).json({ success: false, message: "Could not load request." });
  }
  if (!event) {
    return res.status(404).json({ success: false, message: "Request not found." });
  }

  const payload = event.activity_payload || {};
  const [{ data: customer = null } = {}, { data: vehicle = null } = {}] =
    await Promise.all([
      event.customer_id
        ? client
            .from("customers")
            .select(
              "id, firstname, lastname, email, mobile, telephone, address, postcode, contact_preference",
            )
            .eq("id", event.customer_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      event.vehicle_id
        ? client
            .from("vehicles")
            .select(
              "vehicle_id, reg_number, make, model, make_model, mileage, vin, engine, colour",
            )
            .eq("vehicle_id", event.vehicle_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  return res.status(200).json({
    success: true,
    event,
    customer,
    vehicle,
    payload,
  });
}

export default withRoleGuard(handler, { allow: SERVICE_ACTION_ROLES });
