// file location: src/lib/database/warranty.js
// All raw Supabase access for the job-card Warranty tab (CLAUDE.md §5).
// Covers the warranty_claims header, its warranty_requests rows, and the
// derived parts + labour totals shown on the tab. Every function degrades
// gracefully (null / zeroed totals) if the warranty_* tables don't exist yet
// or a query fails, so the tab renders an empty state rather than throwing.
import { supabase } from "@/lib/database/supabaseClient";

const DEFAULT_VAT_RATE = 20; // matches src/lib/invoices/detailService.js
const DEFAULT_LABOUR_RATE = 85; // matches src/lib/invoices/detailService.js
const RATE_KEYS = ["vat_rate", "default_labour_rate"];

// parts_job_items statuses that should not count toward a claim total.
const EXCLUDED_PART_STATUSES = new Set(["cancelled", "removed", "unavailable"]);

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

/* ============================================
   COMPANY RATES (VAT + labour)
   Mirrors detailService.js so warranty totals match invoice totals exactly.
============================================ */
export const fetchCompanyRates = async () => {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .in("setting_key", RATE_KEYS);
    if (error) throw error;
    const map = Object.fromEntries(
      (data || []).map((entry) => [entry.setting_key, entry.setting_value])
    );
    return {
      vatRate: Number(map.vat_rate) || DEFAULT_VAT_RATE,
      labourRate: Number(map.default_labour_rate) || DEFAULT_LABOUR_RATE,
    };
  } catch (error) {
    console.warn("fetchCompanyRates (warranty) error", error);
    return { vatRate: DEFAULT_VAT_RATE, labourRate: DEFAULT_LABOUR_RATE };
  }
};

/* ============================================
   COMPUTE WARRANTY TOTALS (parts + labour)
   parts: unit_price is VAT-INCLUSIVE (gross); net = gross / (1 + vat/100)
          over quantity_allocated (detailService.js:477-483).
   labour: hours from job_requests.hours; net = hours × labourRate (detailService.js:455).
============================================ */
export const computeWarrantyTotals = async (warrantyJobId) => {
  const { vatRate, labourRate } = await fetchCompanyRates();
  const vatFactor = 1 + vatRate / 100;
  const empty = {
    labour: { net: 0, gross: 0, hours: 0 },
    parts: { net: 0, gross: 0 },
    total: { net: 0, gross: 0 },
    vatRate,
    labourRate,
  };
  if (!warrantyJobId) return empty;

  try {
    const [partsResult, requestsResult] = await Promise.all([
      supabase
        .from("parts_job_items")
        .select("unit_price, quantity_allocated, status")
        .eq("job_id", warrantyJobId),
      supabase
        .from("job_requests")
        .select("hours")
        .eq("job_id", warrantyJobId),
    ]);

    if (partsResult.error) throw partsResult.error;
    if (requestsResult.error) throw requestsResult.error;

    let partsGross = 0;
    for (const item of partsResult.data || []) {
      if (EXCLUDED_PART_STATUSES.has(String(item.status || "").toLowerCase())) continue;
      const qty = Number(item.quantity_allocated) || 0;
      const unitGross = Number(item.unit_price) || 0;
      partsGross += unitGross * qty;
    }
    const partsNet = vatFactor > 0 ? partsGross / vatFactor : partsGross;

    let labourHours = 0;
    for (const request of requestsResult.data || []) {
      labourHours += Number(request.hours) || 0;
    }
    const labourNet = labourHours * labourRate;
    const labourGross = labourNet * vatFactor;

    return {
      labour: { net: round2(labourNet), gross: round2(labourGross), hours: round2(labourHours) },
      parts: { net: round2(partsNet), gross: round2(partsGross) },
      total: { net: round2(labourNet + partsNet), gross: round2(labourGross + partsGross) },
      vatRate,
      labourRate,
    };
  } catch (error) {
    console.warn("computeWarrantyTotals error", error);
    return empty;
  }
};

/* ============================================
   GET WARRANTY JOB REQUESTS (descriptions)
   Powers the "Linked Warranty Job" section — the warranty job's own work lines.
============================================ */
export const getWarrantyJobRequests = async (warrantyJobId) => {
  if (!warrantyJobId) return [];
  try {
    const { data, error } = await supabase
      .from("job_requests")
      .select("request_id, description, hours, status, job_type, sort_order")
      .eq("job_id", warrantyJobId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.warn("getWarrantyJobRequests error", error);
    return [];
  }
};

/* ============================================
   GET WARRANTY CLAIM (header + requests)
   Keyed on the warranty job id. Returns null when no claim row exists.
============================================ */
export const getWarrantyClaimForJob = async (warrantyJobId) => {
  if (!warrantyJobId) return null;
  try {
    const { data, error } = await supabase
      .from("warranty_claims")
      .select(
        `
        *,
        requests:warranty_requests(
          id,
          claim_id,
          warranty_job_id,
          request_date,
          request_type,
          status,
          amount,
          requested_by,
          note,
          created_at,
          updated_at,
          requestedByUser:requested_by(user_id, first_name, last_name, email)
        )
      `
      )
      .eq("warranty_job_id", warrantyJobId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.warn("getWarrantyClaimForJob error", error);
    return null;
  }
};

/* ============================================
   ENSURE WARRANTY CLAIM
   Creates the claim row on first use; returns the existing row otherwise.
============================================ */
export const ensureWarrantyClaim = async (warrantyJobId, hostJobId = null, userId = null) => {
  if (!warrantyJobId) {
    return { success: false, error: { message: "Warranty job id is required" } };
  }
  try {
    const existing = await getWarrantyClaimForJob(warrantyJobId);
    if (existing) return { success: true, data: existing };

    const { data, error } = await supabase
      .from("warranty_claims")
      .insert([
        {
          warranty_job_id: warrantyJobId,
          host_job_id: hostJobId || null,
          created_by: userId || null,
          updated_by: userId || null,
        },
      ])
      .select("*")
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("ensureWarrantyClaim error", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   UPDATE WARRANTY CLAIM
   patch may carry customer_liability, authorisation_status / _reference, and any
   of the timeline timestamps. updated_at / updated_by are always stamped.
============================================ */
export const updateWarrantyClaim = async (claimId, patch = {}, userId = null) => {
  if (!claimId) {
    return { success: false, error: { message: "Claim id is required" } };
  }
  try {
    const { data, error } = await supabase
      .from("warranty_claims")
      .update({
        ...patch,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .select("*")
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("updateWarrantyClaim error", error);
    return { success: false, error: { message: error.message } };
  }
};

/* ============================================
   CREATE / UPDATE WARRANTY REQUEST
============================================ */
export const createWarrantyRequest = async ({
  claimId,
  warrantyJobId,
  requestType,
  amount = 0,
  note = "",
  requestedBy = null,
}) => {
  if (!claimId || !warrantyJobId) {
    return { success: false, error: { message: "Claim and warranty job are required" } };
  }
  if (!requestType || !String(requestType).trim()) {
    return { success: false, error: { message: "Request type is required" } };
  }
  try {
    const { data, error } = await supabase
      .from("warranty_requests")
      .insert([
        {
          claim_id: claimId,
          warranty_job_id: warrantyJobId,
          request_type: String(requestType).trim(),
          amount: Number(amount) || 0,
          note: note ? String(note).trim() : null,
          requested_by: requestedBy || null,
        },
      ])
      .select(
        `*, requestedByUser:requested_by(user_id, first_name, last_name, email)`
      )
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("createWarrantyRequest error", error);
    return { success: false, error: { message: error.message } };
  }
};

export const updateWarrantyRequest = async (requestId, patch = {}) => {
  if (!requestId) {
    return { success: false, error: { message: "Request id is required" } };
  }
  try {
    const { data, error } = await supabase
      .from("warranty_requests")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select(
        `*, requestedByUser:requested_by(user_id, first_name, last_name, email)`
      )
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error("updateWarrantyRequest error", error);
    return { success: false, error: { message: error.message } };
  }
};
