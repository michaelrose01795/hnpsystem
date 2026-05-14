// file location: src/pages/api/messages/customer-requests.js
// Returns the queue of customer-portal request events that staff still
// need to action (book service, valet, parts enquiry, etc.). Used by
// the /messages system-notification feed so each request renders as an
// inbox card with a 'Create job' button.
//
// Source: public.customer_activity_events, filtered to actionable
// activity types and excluding rows that have already been processed
// (activity_type stamped with the '_processed' suffix or carrying
// activity_payload.processed_job_id).

import { supabaseService, supabase } from "@/lib/database/supabaseClient";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { SERVICE_ACTION_ROLES } from "@/lib/auth/serviceActionRoles";

const db = () => supabaseService || supabase;

export const ACTIONABLE_REQUEST_TYPES = [
  "booking_request",
  "valet_request",
  "smart_repair_request",
  "body_repair_request",
  "parts_enquiry",
  "valuation_request",
  "vehicle_callback_request",
  "finance_quote_request",
  "test_drive_request",
  "motability_enquiry",
  "warranty_claim",
  "vhc_reauthorise_request",
  "referral",
];

const REQUEST_TYPE_LABELS = {
  booking_request: "Service booking",
  valet_request: "Valet booking",
  smart_repair_request: "Smart repair quote",
  body_repair_request: "Body repair quote",
  parts_enquiry: "Parts enquiry",
  valuation_request: "Vehicle valuation",
  vehicle_callback_request: "Sales callback",
  finance_quote_request: "Finance quote",
  test_drive_request: "Test drive",
  motability_enquiry: "Motability enquiry",
  warranty_claim: "Warranty claim",
  vhc_reauthorise_request: "VHC re-authorise",
  referral: "Friend referral",
};

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const client = db();

  const { data: events, error } = await client
    .from("customer_activity_events")
    .select(
      `event_id, customer_id, vehicle_id, job_id, activity_type,
       activity_source, activity_payload, occurred_at`,
    )
    .in("activity_type", ACTIONABLE_REQUEST_TYPES)
    .order("occurred_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("/api/messages/customer-requests:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not load customer requests." });
  }

  const unprocessed = (events || []).filter((row) => {
    const payload = row.activity_payload || {};
    return !payload.processed_job_id && !payload.processed_at;
  });

  const customerIds = Array.from(
    new Set(unprocessed.map((r) => r.customer_id).filter(Boolean)),
  );
  const vehicleIds = Array.from(
    new Set(unprocessed.map((r) => r.vehicle_id).filter(Boolean)),
  );

  const [{ data: customers = [] } = {}, { data: vehicles = [] } = {}] =
    await Promise.all([
      customerIds.length
        ? client
            .from("customers")
            .select("id, firstname, lastname, email, mobile")
            .in("id", customerIds)
        : Promise.resolve({ data: [] }),
      vehicleIds.length
        ? client
            .from("vehicles")
            .select("vehicle_id, reg_number, make, model, make_model")
            .in("vehicle_id", vehicleIds)
        : Promise.resolve({ data: [] }),
    ]);

  const customerMap = new Map((customers || []).map((c) => [c.id, c]));
  const vehicleMap = new Map(
    (vehicles || []).map((v) => [v.vehicle_id, v]),
  );

  const items = unprocessed.map((row) => {
    const payload = row.activity_payload || {};
    const customer = customerMap.get(row.customer_id) || null;
    const vehicle = vehicleMap.get(row.vehicle_id) || null;
    const customerName = customer
      ? [customer.firstname, customer.lastname].filter(Boolean).join(" ") ||
        customer.email ||
        "Customer"
      : "Customer";
    const vehicleLabel = vehicle
      ? `${vehicle.reg_number || ""}${
          vehicle.make_model || vehicle.make
            ? ` · ${vehicle.make_model || [vehicle.make, vehicle.model].filter(Boolean).join(" ")}`
            : ""
        }`.trim()
      : payload.reg || null;
    return {
      event_id: row.event_id,
      activity_type: row.activity_type,
      type_label: REQUEST_TYPE_LABELS[row.activity_type] || row.activity_type,
      occurred_at: row.occurred_at,
      customer_id: row.customer_id,
      customer_name: customerName,
      customer_email: customer?.email || null,
      customer_mobile: customer?.mobile || null,
      vehicle_id: row.vehicle_id,
      vehicle_label: vehicleLabel,
      vehicle_reg:
        vehicle?.reg_number || (payload.reg ? String(payload.reg).toUpperCase() : null),
      description: payload.description || payload.body || payload.notes || null,
      preferred_date: payload.preferred_date || null,
      service_type: payload.service_type || null,
      payload,
    };
  });

  return res.status(200).json({ success: true, items });
}

export default withRoleGuard(handler, { allow: SERVICE_ACTION_ROLES });
