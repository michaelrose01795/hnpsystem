// file location: src/pages/api/website/actions.js
// Single dispatch endpoint for customer-portal actions that the
// customer cannot complete end-to-end without a member of staff
// (book a service, request a payment link, request a statement,
// request an invoice PDF, request a service-history pack, send a
// message, request data export, request account deletion).
//
// Every action writes a row to public.customer_activity_events with
// an activity_type that staff workflows (or future automation) can
// pick up. The payload jsonb carries whatever extra detail the action
// needs. Staff will see these in the customer's activity feed in the
// dashboard and process them through the existing channels.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

const ACTION_MAP = {
  book_service: "booking_request",
  send_message: "message_customer",
  request_payment_link: "payment_link_requested",
  request_statement: "statement_requested",
  request_invoice_pdf: "invoice_pdf_requested",
  request_service_history: "service_history_requested",
  request_data_export: "data_export_requested",
  request_account_deletion: "account_deletion_requested",
  // Buy / sell / specialist quotes — written for staff to pick up.
  request_valuation: "valuation_request",
  request_body_repair: "body_repair_request",
  request_smart_repair: "smart_repair_request",
  request_valet: "valet_request",
  request_parts_enquiry: "parts_enquiry",
  request_vehicle_callback: "vehicle_callback_request",
  request_finance_quote: "finance_quote_request",
  request_test_drive: "test_drive_request",
  request_motability: "motability_enquiry",
  request_warranty_claim: "warranty_claim",
  // Account self-service that staff still need to action.
  add_vehicle_request: "vehicle_add_request",
  authorise_vhc_item: "vhc_reauthorise_request",
  refer_friend: "referral",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }

  const action = String(req.body?.action ?? "").trim();
  const activityType = ACTION_MAP[action];
  if (!activityType) {
    return res
      .status(400)
      .json({ success: false, message: "Unknown action." });
  }

  const payload = req.body?.payload || {};
  // Light validation per action — keep enforcement loose because
  // staff still review every activity event before acting on it.
  if (action === "book_service") {
    if (!payload.description || String(payload.description).trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: "Tell us a little about what you need.",
      });
    }
  }
  if (action === "send_message") {
    if (!payload.body || String(payload.body).trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Message can't be empty." });
    }
  }

  const insert = {
    customer_id: session.customerId,
    activity_type: activityType,
    activity_source: "customer_portal",
    activity_payload: payload,
    job_id: payload.job_id ?? null,
    vehicle_id: payload.vehicle_id ?? null,
  };

  const { data, error } = await db()
    .from("customer_activity_events")
    .insert(insert)
    .select(
      "event_id, job_id, vehicle_id, activity_type, activity_source, activity_payload, occurred_at",
    )
    .single();

  if (error) {
    console.error("/api/website/actions:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Could not record that request." });
  }

  return res.status(200).json({ success: true, event: data });
}
