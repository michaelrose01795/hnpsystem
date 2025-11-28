// ✅ Connected to Supabase (server-side)
// file location: src/pages/api/invoices/create.js
import { createClient } from "@supabase/supabase-js";
import { PAYMENT_PROVIDERS, buildPaymentUrl } from "@/lib/payments/paymentProviders";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    jobId,
    jobNumber,
    customerId,
    customerEmail,
    providerId,
    totals = {},
    requests = [],
    partLines = [],
    sendEmail = false,
    sendPortal = false
  } = req.body || {};

  if (!jobId || !jobNumber) {
    return res.status(400).json({ success: false, error: "Missing jobId or jobNumber" });
  }

  try {
    const provider =
      PAYMENT_PROVIDERS.find((item) => item.id === providerId) || PAYMENT_PROVIDERS[0];

    const now = new Date().toISOString();
    const invoicePayload = {
      job_id: jobId,
      customer_id: customerId || null,
      total_parts: Number(totals.partsTotal ?? 0),
      total_labour: Number(totals.labourTotal ?? 0),
      total_vat: Number(totals.vatTotal ?? 0),
      total: Number(totals.total ?? 0),
      payment_method: provider.label,
      sent_email_at: sendEmail ? now : null,
      sent_portal_at: sendPortal ? now : null,
      created_at: now,
      updated_at: now
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

    const checkoutUrl = buildPaymentUrl(provider, {
      invoiceId: invoice.id,
      jobNumber,
      amount: invoice.total
    });
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const { data: paymentLink, error: linkError } = await dbClient
      .from("payment_links")
      .insert({
        invoice_id: invoice.id,
        provider: provider.label,
        checkout_url: checkoutUrl,
        expires_at: expiresAt
      })
      .select()
      .single();

    if (linkError) {
      throw linkError;
    }

    if (sendEmail && customerEmail) {
      await insertNotification({
        jobNumber,
        method: "email",
        targetRole: "customer",
        message: `Invoice ${invoice.id} sent to ${customerEmail}`
      });
    }

    if (sendPortal) {
      await insertNotification({
        jobNumber,
        method: "portal",
        targetRole: "customer_portal",
        message: `Invoice ${invoice.id} published to the customer portal`
      });
    }

    return res.status(201).json({
      success: true,
      invoice,
      paymentLink,
      provider: provider.id
    });
  } catch (error) {
    console.error("❌ create invoice error:", error);
    return res.status(500).json({ success: false, error: error.message || "Failed to create invoice" });
  }
}
