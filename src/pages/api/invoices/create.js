// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/invoices/create.js
import { createClient } from "@supabase/supabase-js";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "@/lib/auth/roles";
import {
  persistStructuredInvoiceRequests,
  SNAPSHOT_VERSION,
} from "@/lib/invoices/persistence";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

// Postgres "undefined column" error code — used to retry inserts when the
// migration that adds snapshot_version / meta has not been applied yet.
const COLUMN_MISSING_CODE = "42703";
let warnedHeaderColumnsMissing = false;

const insertNotification = async ({ jobNumber, method, targetRole, message }) => {
  return dbClient.from("notifications").insert({
    user_id: null,
    type: "invoice_delivery",
    message,
    target_role: targetRole,
    job_number: jobNumber,
    created_at: new Date().toISOString()
  });
};

const generateInvoiceNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const { data } = await dbClient
    .from("invoices")
    .select("invoice_number")
    .not("invoice_number", "is", null)
    .ilike("invoice_number", `${prefix}%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastSequence = data?.invoice_number ? Number(data.invoice_number.split("-")[2]) : 0;
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  return `${prefix}${String(nextSequence).padStart(5, "0")}`;
};

const toDateOnly = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const addDaysToDateOnly = (value, days = 0) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
};

const round2 = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100) / 100;
};

const looksLikeMissingColumn = (error) => {
  if (!error) return false;
  if (error.code === COLUMN_MISSING_CODE) return true;
  const message = String(error.message || "").toLowerCase();
  return (
    (message.includes("snapshot_version") || message.includes("meta")) &&
    message.includes("column")
  );
};

const fetchJobContext = async (jobId) => {
  const { data: job, error: jobError } = await dbClient
    .from("jobs")
    .select("id, job_number, customer_id, vehicle_id, account_id, account_number, vehicle_reg, vehicle_make_model, milage, account:account_id(account_id, billing_name, credit_terms)")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError) {
    throw jobError;
  }
  if (!job) {
    throw new Error("Job not found");
  }
  let customer = null;
  if (job?.customer_id) {
    const { data, error } = await dbClient
      .from("customers")
      .select("firstname, lastname, name, email, mobile, telephone, address, postcode")
      .eq("id", job.customer_id)
      .maybeSingle();
    if (error) throw error;
    customer = data;
  }
  let vehicle = null;
  if (job?.vehicle_id) {
    const { data, error } = await dbClient
      .from("vehicles")
      .select("registration, reg_number, make, model, make_model, chassis, engine, engine_number, mileage, month_of_first_registration")
      .eq("vehicle_id", job.vehicle_id)
      .maybeSingle();
    if (error) throw error;
    vehicle = data;
  }
  const buildAddress = (record) => {
    if (!record) {
      return { name: job?.customer || "Customer", lines: [], postcode: "", phone: "", email: "" };
    }
    const name =
      record.name ||
      [record.firstname, record.lastname].filter(Boolean).join(" ").trim() ||
      job?.customer ||
      "Customer";
    const lines = (record.address || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      name,
      lines,
      postcode: record.postcode || "",
      phone: record.mobile || record.telephone || "",
      email: record.email || ""
    };
  };
  const buildVehicleSnapshot = () => ({
    reg: job?.vehicle_reg || getVehicleRegistration(vehicle),
    vehicle:
      vehicle?.make_model ||
      [vehicle?.make, vehicle?.model].filter(Boolean).join(" ").trim() ||
      job?.vehicle_make_model ||
      "",
    chassis: vehicle?.chassis || "",
    engine: vehicle?.engine || vehicle?.engine_number || "",
    reg_date: vehicle?.month_of_first_registration || "",
    mileage: pickMileageValue(vehicle?.mileage, job?.milage) || ""
  });
  return {
    accountId: job?.account_id || null,
    accountNumber: job?.account_number || job?.account_id || null,
    accountLabel: job?.account?.billing_name || job?.account_number || job?.account_id || null,
    creditTerms: Number(job?.account?.credit_terms || 30) || 30,
    invoiceTo: buildAddress(customer),
    deliverTo: buildAddress(customer),
    vehicleDetails: buildVehicleSnapshot()
  };
};

// Compute totals breakdown from the structured request payload so the snapshot
// is internally consistent even if the caller passed slightly different totals.
const summariseStructuredRequests = (requests = []) => {
  let labourNet = 0;
  let partsNet = 0;
  let vatTotal = 0;
  let gross = 0;
  (Array.isArray(requests) ? requests : []).forEach((request) => {
    const totals = request?.totals || {};
    const requestNet = Number(totals.request_total_net || 0);
    const requestVat = Number(totals.request_total_vat || 0);
    const requestGross = Number(totals.request_total_gross || requestNet + requestVat);
    const labour = Number(request?.labour?.net || 0);
    labourNet += labour;
    partsNet += Math.max(requestNet - labour, 0);
    vatTotal += requestVat;
    gross += requestGross;
  });
  return {
    labourNet: round2(labourNet),
    partsNet: round2(partsNet),
    vatTotal: round2(vatTotal),
    gross: round2(gross),
  };
};

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    jobId,
    jobNumber,
    orderNumber,
    customerId,
    customerEmail,
    totals = {},
    requests = [],
    structuredRequests = [],
    partLines = [],
  } = req.body || {};

  if (!jobId || !jobNumber) {
    return res.status(400).json({ success: false, error: "Missing jobId or jobNumber" });
  }

  try {
    const invoiceNumber = await generateInvoiceNumber(); // derive friendly sequential invoice number
    const jobContext = await fetchJobContext(jobId); // capture customer and vehicle snapshot

    const now = new Date().toISOString();
    const invoiceDate = toDateOnly(now);
    const dueDate = addDaysToDateOnly(invoiceDate, jobContext.creditTerms || 30);

    // Prefer the totals derived from structured requests so the persisted header
    // is internally consistent with the persisted line items.
    const structuredTotals = summariseStructuredRequests(structuredRequests);
    const hasStructured = Array.isArray(structuredRequests) && structuredRequests.length > 0;

    const headerLabour = hasStructured
      ? structuredTotals.labourNet
      : Number(totals.labourTotal ?? 0);
    const headerParts = hasStructured
      ? structuredTotals.partsNet
      : Number(totals.partsTotal ?? 0);
    const headerVat = hasStructured
      ? structuredTotals.vatTotal
      : Number(totals.vatTotal ?? 0);
    const headerGross = hasStructured
      ? structuredTotals.gross
      : Number(totals.total ?? 0);

    // Header-level meta blob captures everything the read path used to derive
    // from live company_settings/profile + per-request totals breakdown so we
    // can rebuild the entire payload without consulting live job state.
    const headerMeta = {
      snapshot_version: SNAPSHOT_VERSION,
      created_from: hasStructured ? "structuredRequests" : "totals",
      totals_breakdown: {
        labour_net: headerLabour,
        parts_net: headerParts,
        vat_total: headerVat,
        gross_total: headerGross,
      },
      request_count: Array.isArray(structuredRequests) ? structuredRequests.length : 0,
      account_label: jobContext.accountLabel || null,
      credit_terms: jobContext.creditTerms,
    };

    const baseInvoicePayload = {
      job_id: jobId,
      customer_id: customerId || null,
      account_id: jobContext.accountId || null,
      total_parts: headerParts,
      total_labour: headerLabour,
      total_vat: headerVat,
      total: headerGross,
      payment_method: null,
      payment_status: "Draft",
      sent_email_at: null,
      sent_portal_at: null,
      created_at: now,
      updated_at: now,
      invoice_number: invoiceNumber,
      job_number: jobNumber,
      order_number: orderNumber || null,
      account_number: jobContext.accountNumber || null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      invoice_to: jobContext.invoiceTo,
      deliver_to: jobContext.deliverTo,
      vehicle_details: jobContext.vehicleDetails,
      service_total: headerLabour + headerParts,
      vat_total: headerVat,
      invoice_total: headerGross,
    };

    // Insert with snapshot_version + meta first; retry without on missing column.
    const fullPayload = {
      ...baseInvoicePayload,
      snapshot_version: SNAPSHOT_VERSION,
      meta: headerMeta,
    };

    let { data: invoice, error: invoiceError } = await dbClient
      .from("invoices")
      .insert(fullPayload)
      .select()
      .single();

    if (invoiceError && looksLikeMissingColumn(invoiceError)) {
      if (!warnedHeaderColumnsMissing) {
        console.warn(
          "[invoices] invoices.snapshot_version/meta missing — falling back to legacy header insert. Apply migration 20260410120000_invoice_snapshot_v1.sql to enable full snapshotting."
        );
        warnedHeaderColumnsMissing = true;
      }
      const retry = await dbClient
        .from("invoices")
        .insert(baseInvoicePayload)
        .select()
        .single();
      invoice = retry.data;
      invoiceError = retry.error;
    }

    if (invoiceError) {
      throw invoiceError;
    }

    // ── 1. Persist the structured snapshot (per-request labour/parts/metadata) ──
    let structuredPersistResult = { requestCount: 0, itemCount: 0, columnsMissing: false };
    if (hasStructured) {
      try {
        structuredPersistResult = await persistStructuredInvoiceRequests({
          client: dbClient,
          invoiceId: invoice.id,
          structuredRequests,
        });
      } catch (structuredError) {
        // Roll back the just-written invoice header so we don't leave a partial
        // record that the read path will then try to rebuild from live data.
        await dbClient.from("invoices").delete().eq("id", invoice.id);
        throw structuredError;
      }
    }

    // ── 2. Legacy flat invoice_items rows (kept for backward compatibility) ──
    const lineItems = [];

    requests.forEach((line, index) => {
      lineItems.push({
        invoice_id: invoice.id,
        description: line.description || `Request ${index + 1}`,
        quantity: Number(line.quantity ?? 1),
        unit_price: Number(line.unitPrice ?? 0),
        total:
          Number(line.total ?? 0) ||
          Number(line.quantity ?? 1) * Number(line.unitPrice ?? 0)
      });
    });

    partLines.forEach((line) => {
      lineItems.push({
        invoice_id: invoice.id,
        description: line.name || line.partNumber || "Part",
        quantity: Number(line.quantity ?? 1),
        unit_price: Number(line.unitPrice ?? 0),
        total: Number(line.quantity ?? 1) * Number(line.unitPrice ?? 0)
      });
    });

    // Derive flat invoice_items entries from structuredRequests as well, so the
    // legacy table is populated even when the caller only sends structuredRequests.
    if (hasStructured) {
      structuredRequests.forEach((request, index) => {
        const labourNet = Number(request?.labour?.net || 0);
        if (labourNet > 0) {
          lineItems.push({
            invoice_id: invoice.id,
            description: request?.title
              ? `Labour — ${request.title}`
              : `Labour — Request ${index + 1}`,
            quantity: 1,
            unit_price: round2(labourNet),
            total: round2(labourNet),
          });
        }
        (Array.isArray(request?.parts) ? request.parts : []).forEach((part) => {
          const qty = Number(part?.qty) || 0;
          const unitNet = Number(part?.price) || 0;
          if (qty <= 0 || unitNet <= 0) return;
          lineItems.push({
            invoice_id: invoice.id,
            description: part?.description || part?.part_number || "Part",
            quantity: qty,
            unit_price: round2(unitNet),
            total: round2(unitNet * qty),
          });
        });
      });
    } else if (Number(totals.labourTotal)) {
      // Preserve original behaviour when no structuredRequests were sent.
      lineItems.push({
        invoice_id: invoice.id,
        description: "Labour",
        quantity: 1,
        unit_price: Number(totals.labourTotal),
        total: Number(totals.labourTotal)
      });
    }

    if (lineItems.length > 0) {
      const { error: itemsError } = await dbClient.from("invoice_items").insert(lineItems);
      if (itemsError) {
        // Don't roll back here — the structured snapshot is the source of
        // truth; legacy invoice_items is only a compatibility shim.
        console.warn("[invoices] legacy invoice_items insert failed:", itemsError.message);
      }
    }

    await insertNotification({
      jobNumber,
      method: "invoice_created",
      targetRole: "accounts",
      message: `Invoice ${invoice.invoice_number || invoice.id} created and ready for payment or delivery`
    });

    return res.status(201).json({
      success: true,
      invoice,
      provider: null,
      snapshot: {
        version: SNAPSHOT_VERSION,
        request_count: structuredPersistResult.requestCount,
        item_count: structuredPersistResult.itemCount,
        columns_missing: structuredPersistResult.columnsMissing,
      },
    });
  } catch (error) {
    console.error("❌ create invoice error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create invoice" });
  }
}

export default withRoleGuard(handler, { allow: [...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES] });
