// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/invoices/create.js
import { createClient } from "@supabase/supabase-js";
import { getVehicleRegistration, pickMileageValue } from "@/lib/canonical/fields";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

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

export default async function handler(req, res) {
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
    const invoicePayload = {
      job_id: jobId,
      customer_id: customerId || null,
      account_id: jobContext.accountId || null,
      total_parts: Number(totals.partsTotal ?? 0),
      total_labour: Number(totals.labourTotal ?? 0),
      total_vat: Number(totals.vatTotal ?? 0),
      total: Number(totals.total ?? 0),
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
      service_total: Number(totals.partsTotal || 0) + Number(totals.labourTotal || 0),
      vat_total: Number(totals.vatTotal || 0),
      invoice_total: Number(totals.total || 0)
    };

    const { data: invoice, error: invoiceError } = await dbClient
      .from("invoices")
      .insert(invoicePayload)
      .select()
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

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

    if (Number(totals.labourTotal)) {
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
        throw itemsError;
      }
    }

    // TODO: Persist full proforma-to-invoice structured request rows once invoice_requests
    // is expanded to support request linkage and authored proforma metadata consistently.

    await insertNotification({
      jobNumber,
      method: "invoice_created",
      targetRole: "accounts",
      message: `Invoice ${invoice.invoice_number || invoice.id} created and ready for payment or delivery`
    });

    return res.status(201).json({
      success: true,
      invoice,
      provider: null
    });
  } catch (error) {
    console.error("❌ create invoice error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create invoice" });
  }
}
