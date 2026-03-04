// file location: src/pages/api/invoices/proforma-overrides.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);
const BILLING_OPTIONS = new Set([
  "Customer",
  "Warranty",
  "Sales Goodwill",
  "Service Goodwill",
  "Internal",
  "Insurance",
  "Lease Company",
  "Staff",
]);

const toNullableNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toNullableText = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

export default async function handler(req, res) {
  if (req.method === "GET") {
    const rawJobId = req.query?.jobId;
    const jobId = Number(rawJobId);
    if (!Number.isFinite(jobId) || jobId <= 0) {
      return res.status(400).json({ success: false, error: "jobId is required" });
    }

    const { data, error } = await dbClient
      .from("proforma_request_overrides")
      .select("*")
      .eq("job_id", jobId)
      .order("updated_at", { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data: data || [] });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    jobId,
    requestKey,
    requestId,
    requestKind,
    requestNumber,
    titleOverride,
    summaryOverride,
    labourHoursOverride,
    partsTotalOverride,
    labourTotalOverride,
    taxTotalOverride,
    totalOverride,
    updatedBy,
  } = req.body || {};

  const parsedJobId = Number(jobId);
  if (!Number.isFinite(parsedJobId) || parsedJobId <= 0) {
    return res.status(400).json({ success: false, error: "Valid jobId is required" });
  }
  if (!requestKey || typeof requestKey !== "string") {
    return res.status(400).json({ success: false, error: "requestKey is required" });
  }

  const now = new Date().toISOString();
  const payload = {
    job_id: parsedJobId,
    request_key: requestKey.trim(),
    request_id: toNullableNumber(requestId),
    request_kind: String(requestKind || "request").toLowerCase() === "authorised" ? "authorised" : "request",
    request_number: toNullableNumber(requestNumber),
    title_override: toNullableText(titleOverride),
    summary_override: toNullableText(summaryOverride),
    labour_hours_override: toNullableNumber(labourHoursOverride),
    parts_total_override: toNullableNumber(partsTotalOverride),
    labour_total_override: toNullableNumber(labourTotalOverride),
    tax_total_override: toNullableNumber(taxTotalOverride),
    total_override: toNullableNumber(totalOverride),
    updated_by: toNullableText(updatedBy),
    updated_at: now,
  };

  const { data, error } = await dbClient
    .from("proforma_request_overrides")
    .upsert(
      [{ ...payload, created_at: now }],
      { onConflict: "job_id,request_key", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  const billingValue = toNullableText(summaryOverride);
  if (payload.request_id && billingValue && BILLING_OPTIONS.has(billingValue)) {
    const { error: requestUpdateError } = await dbClient
      .from("job_requests")
      .update({
        job_type: billingValue,
        updated_at: now,
      })
      .eq("request_id", payload.request_id);
    if (requestUpdateError) {
      return res.status(500).json({ success: false, error: requestUpdateError.message });
    }
  }

  return res.status(200).json({ success: true, data });
}
