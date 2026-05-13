// file location: src/pages/api/website/profile.js
// One round-trip bundle for the customer portal at /website/profile.
//
// Returns everything the profile page needs: identity, vehicles (with
// MOT / warranty / service-due cues), jobs (live workflow status),
// invoices (with totals), appointments, the trade/retail account row,
// saved payment methods, pending booking requests, recorded service
// history (with mileage points for the chart), VHC traffic-light
// summaries per job, an activity timeline, and the message thread
// (modelled as customer/staff activity events). Filters strictly by
// the session's customer_id.

import { getCustomerSessionFromReq } from "@/lib/auth/customerSession";
import { getCustomerById } from "@/lib/database/customers";
import { supabaseService, supabase } from "@/lib/database/supabaseClient";

const db = () => supabaseService || supabase;

const summariseVhc = (rows) => {
  const byJob = new Map();
  for (const row of rows || []) {
    const key = row.job_id;
    if (!key) continue;
    const bucket = byJob.get(key) || { red: 0, amber: 0, green: 0, total: 0 };
    const sev = (row.severity || row.display_status || "").toLowerCase();
    if (sev === "red") bucket.red += 1;
    else if (sev === "amber") bucket.amber += 1;
    else if (sev === "green") bucket.green += 1;
    bucket.total += 1;
    byJob.set(key, bucket);
  }
  return Object.fromEntries(byJob);
};

export default async function handler(req, res) {
  const session = getCustomerSessionFromReq(req);
  if (!session) {
    return res.status(401).json({ success: false, message: "Not signed in." });
  }
  const customerId = session.customerId;
  const customer = await getCustomerById(customerId);
  if (!customer) {
    return res
      .status(404)
      .json({ success: false, message: "Customer not found." });
  }

  const client = db();

  const [
    vehiclesRes,
    jobsRes,
    invoicesRes,
    appointmentsRes,
    accountsRes,
    paymentMethodsRes,
    bookingRequestsRes,
    jobHistoryRes,
    activityRes,
  ] = await Promise.all([
    client
      .from("vehicles")
      .select(
        "vehicle_id, reg_number, registration, make, model, make_model, year, vin, colour, mileage, fuel_type, transmission, mot_due, warranty_type, warranty_expiry, service_history, service_plan_supplier, service_plan_type, service_plan_expiry, insurance_provider, insurance_policy_number",
      )
      .eq("customer_id", customerId)
      .order("updated_at", { ascending: false }),
    client
      .from("jobs")
      .select(
        "id, job_number, vehicle_reg, vehicle_make_model, vehicle_id, type, status, description, created_at, updated_at, checked_in_at, workshop_started_at, vhc_required, vhc_completed_at, vhc_sent_at, wash_started_at, wash_completed_by, completed_at, completion_status, status_updated_at, service_mode, service_address, service_postcode, vhc_authorized_total, vhc_declined_total",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("invoices")
      .select(
        "id, invoice_id, invoice_number, job_number, payment_status, paid, total, grand_total, due_date, created_at",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("appointments")
      .select("appointment_id, job_id, scheduled_time, status, created_at")
      .eq("customer_id", customerId)
      .order("scheduled_time", { ascending: false })
      .limit(40),
    client
      .from("accounts")
      .select(
        "account_id, account_type, balance, credit_limit, status, credit_terms, billing_email",
      )
      .eq("customer_id", customerId),
    client
      .from("customer_payment_methods")
      .select(
        "method_id, nickname, card_brand, last4, expiry_month, expiry_year, is_default, created_at",
      )
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false }),
    client
      .from("job_booking_requests")
      .select(
        "request_id, job_id, vehicle_id, description, status, submitted_at, estimated_completion, price_estimate, confirmation_notes",
      )
      .eq("customer_id", customerId)
      .order("submitted_at", { ascending: false })
      .limit(40),
    client
      .from("customer_job_history")
      .select(
        "history_id, job_id, job_number, vehicle_reg, vehicle_make_model, mileage_at_service, status_snapshot, recorded_at",
      )
      .eq("customer_id", customerId)
      .order("recorded_at", { ascending: false })
      .limit(80),
    client
      .from("customer_activity_events")
      .select(
        "event_id, job_id, vehicle_id, activity_type, activity_source, activity_payload, occurred_at",
      )
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false })
      .limit(150),
  ]);

  // VHC traffic-light summary per job — only for jobs this customer owns.
  const jobsList = jobsRes.data || [];
  const jobIds = jobsList.map((j) => j.id).filter(Boolean);
  const jobNumbers = jobsList
    .map((j) => j.job_number)
    .filter((n) => typeof n === "string" && n.length > 0);
  const accountIds = (accountsRes.data || [])
    .map((a) => a.account_id)
    .filter(Boolean);

  let vhcByJob = {};
  let vhcDeclinations = [];
  let vhcSendHistory = [];
  let vhcMedia = [];
  let transactions = [];
  let jobStatusHistory = [];
  let invoicePayments = [];
  let paymentPlans = [];
  let partsJobItems = [];
  let partsRequests = [];
  let partsOrderCards = [];

  await Promise.all([
    (async () => {
      if (jobIds.length === 0) return;
      const { data } = await client
        .from("vhc_checks")
        .select(
          "vhc_id, job_id, severity, display_status, section, issue_title, issue_description, customer_description, approval_status, parts_cost, total_override",
        )
        .in("job_id", jobIds);
      vhcByJob = summariseVhc(data);
      // Items the customer declined become recommendations to revisit.
      vhcDeclinations = (data || []).filter(
        (r) =>
          (r.approval_status || "").toLowerCase() === "declined" ||
          (r.display_status || "").toLowerCase() === "declined",
      );
    })(),
    (async () => {
      if (jobIds.length === 0) return;
      const { data } = await client
        .from("vhc_send_history")
        .select("id, job_id, sent_at, send_method, customer_email")
        .in("job_id", jobIds)
        .order("sent_at", { ascending: false });
      vhcSendHistory = data || [];
    })(),
    (async () => {
      if (jobNumbers.length === 0) return;
      const { data } = await client
        .from("vhc_customer_media")
        .select(
          "id, job_number, media_type, public_url, context_label, created_at",
        )
        .in("job_number", jobNumbers)
        .order("created_at", { ascending: false })
        .limit(40);
      vhcMedia = data || [];
    })(),
    (async () => {
      if (accountIds.length === 0) return;
      const { data } = await client
        .from("account_transactions")
        .select(
          "transaction_id, account_id, transaction_date, amount, type, description, job_number, payment_method",
        )
        .in("account_id", accountIds)
        .order("transaction_date", { ascending: false })
        .limit(60);
      transactions = data || [];
    })(),
    (async () => {
      if (jobIds.length === 0) return;
      const { data } = await client
        .from("job_status_history")
        .select("id, job_id, from_status, to_status, changed_by, reason, changed_at")
        .in("job_id", jobIds)
        .order("changed_at", { ascending: false })
        .limit(120);
      jobStatusHistory = data || [];
    })(),
    (async () => {
      const invoiceIds = (invoicesRes.data || []).map((invoice) => invoice.id).filter(Boolean);
      if (invoiceIds.length === 0) return;
      const { data } = await client
        .from("invoice_payments")
        .select("payment_id, invoice_id, amount, payment_method, reference, payment_date, created_at")
        .in("invoice_id", invoiceIds)
        .order("payment_date", { ascending: false })
        .limit(80);
      invoicePayments = data || [];
    })(),
    (async () => {
      const { data } = await client
        .from("payment_plans")
        .select("plan_id, customer_id, job_id, invoice_id, name, description, total_amount, balance_due, frequency, next_payment_date, status, created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(40);
      paymentPlans = data || [];
    })(),
    (async () => {
      if (jobIds.length === 0) return;
      const { data } = await client
        .from("parts_job_items")
        .select("id, job_id, status, quantity_requested, quantity_allocated, quantity_fitted, unit_price, request_notes, created_at, updated_at, eta_date, eta_time, part_number_snapshot, part_name_snapshot, row_description, part:parts_catalog(part_number, name, supplier, unit_price)")
        .in("job_id", jobIds)
        .order("updated_at", { ascending: false })
        .limit(80);
      partsJobItems = data || [];
    })(),
    (async () => {
      if (jobIds.length === 0) return;
      const { data } = await client
        .from("parts_requests")
        .select("request_id, job_id, quantity, status, created_at, updated_at, description, part:parts_catalog(part_number, name, supplier, unit_price)")
        .in("job_id", jobIds)
        .order("updated_at", { ascending: false })
        .limit(80);
      partsRequests = data || [];
    })(),
    (async () => {
      const { data } = await client
        .from("parts_order_cards")
        .select("id, order_number, status, priority, vehicle_id, vehicle_reg, vehicle_make, vehicle_model, notes, delivery_type, delivery_eta, delivery_window, delivery_status, invoice_reference, invoice_total, invoice_status, created_at, updated_at")
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(40);
      partsOrderCards = data || [];
    })(),
  ]);

  // Split the activity feed into the message thread vs. the rest of
  // the timeline. Messages are activity events with type starting
  // with "message_" — the payload carries body + sender.
  const activity = activityRes.data || [];
  const messages = activity
    .filter((e) => /^message_/i.test(e.activity_type || ""))
    .sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
  const timeline = activity.filter(
    (e) => !/^message_/i.test(e.activity_type || ""),
  );

  return res.status(200).json({
    success: true,
    customer,
    vehicles: vehiclesRes.data || [],
    jobs: jobsRes.data || [],
    invoices: invoicesRes.data || [],
    appointments: appointmentsRes.data || [],
    accounts: accountsRes.data || [],
    paymentMethods: paymentMethodsRes.data || [],
    bookingRequests: bookingRequestsRes.data || [],
    jobHistory: jobHistoryRes.data || [],
    vhcByJob,
    vhcDeclinations,
    vhcSendHistory,
    vhcMedia,
    transactions,
    jobStatusHistory,
    invoicePayments,
    paymentPlans,
    partsJobItems,
    partsRequests,
    partsOrderCards,
    timeline,
    messages,
  });
}
