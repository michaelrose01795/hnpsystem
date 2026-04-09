import { createClient } from "@supabase/supabase-js";
import { findPaymentFlowMethod } from "@/lib/payments/paymentFlow";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { HR_CORE_ROLES, MANAGER_SCOPED_ROLES } from "@/lib/auth/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration for invoice payment simulation");
}

const dbClient = createClient(supabaseUrl, serviceRoleKey);

const PAYMENT_SUCCESS_OUTCOMES = new Set(["success"]);
const COMMUNICATION_METHODS = new Set(["email", "portal_publish"]);

const setInvoiceSentState = async (invoice, methodId, timestamp) => {
  const updates = {
    updated_at: timestamp,
  };

  if (methodId === "email") {
    updates.sent_email_at = timestamp;
  }

  if (methodId === "portal_publish") {
    updates.sent_portal_at = timestamp;
  }

  if (!invoice?.paid) {
    updates.payment_status = "Sent";
  }

  const { data, error } = await dbClient
    .from("invoices")
    .update(updates)
    .eq("id", invoice.id)
    .select("id, invoice_id, payment_status, sent_email_at, sent_portal_at, paid, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

const recordInvoicePayment = async ({
  invoice,
  method,
  amount,
  reference,
  timestamp,
}) => {
  const paymentDate = new Date(timestamp).toISOString().slice(0, 10);

  const { data: paymentRow, error: paymentError } = await dbClient
    .from("invoice_payments")
    .insert({
      invoice_id: invoice.id,
      amount,
      payment_method: method.label,
      reference,
      payment_date: paymentDate,
      created_at: timestamp,
    })
    .select("*")
    .single();

  if (paymentError) {
    throw paymentError;
  }

  const invoiceUpdates = {
    paid: true,
    payment_status: "Paid",
    payment_method: method.label,
    updated_at: timestamp,
  };

  const { data: invoiceRow, error: invoiceError } = await dbClient
    .from("invoices")
    .update(invoiceUpdates)
    .eq("id", invoice.id)
    .select("id, invoice_id, payment_status, payment_method, paid, updated_at")
    .single();

  if (invoiceError) {
    throw invoiceError;
  }

  if (invoice.account_id) {
    await dbClient.from("account_transactions").insert({
      account_id: invoice.account_id,
      transaction_date: timestamp,
      amount: amount,
      type: "Credit",
      description: `Invoice payment received for ${invoice.invoice_number || invoice.job_number || invoice.id}`,
      job_number: invoice.job_number || null,
      payment_method: method.label,
      created_by: "Simulated Payment Flow",
    });
  }

  return { invoice: invoiceRow, payment: paymentRow };
};

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const {
    invoiceId,
    outcome,
    methodId,
    amount,
    amountReceived,
    reference,
  } = req.body || {};

  if (!invoiceId || !methodId || !outcome) {
    return res.status(400).json({
      success: false,
      error: "invoiceId, methodId, and outcome are required",
    });
  }

  const method = findPaymentFlowMethod(methodId);
  const timestamp = new Date().toISOString();

  try {
    const { data: invoice, error: invoiceError } = await dbClient
      .from("invoices")
      .select("id, invoice_id, invoice_number, job_id, job_number, account_id, payment_status, paid, sent_email_at, sent_portal_at, total, invoice_total")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      throw invoiceError;
    }

    if (!invoice) {
      return res.status(404).json({ success: false, error: "Invoice not found" });
    }

    if (
      invoice.paid === true ||
      String(invoice.payment_status || "").trim().toLowerCase() === "paid"
    ) {
      return res.status(409).json({
        success: false,
        error: "Payment has already been captured for this invoice",
      });
    }

    if (COMMUNICATION_METHODS.has(method.id)) {
      if (!PAYMENT_SUCCESS_OUTCOMES.has(outcome)) {
        return res.status(200).json({
          success: true,
          simulatedOnly: true,
          invoice,
          result: {
            methodId: method.id,
            outcome,
            backendTodo: method.backendTodo || "TODO: wire this action to the delivery provider.",
          },
        });
      }

      const updatedInvoice = await setInvoiceSentState(invoice, method.id, timestamp);

      return res.status(200).json({
        success: true,
        invoice: updatedInvoice,
        result: {
          methodId: method.id,
          outcome,
          backendTodo: method.backendTodo || "TODO: wire this action to the delivery provider.",
        },
      });
    }

    if (!PAYMENT_SUCCESS_OUTCOMES.has(outcome)) {
      return res.status(200).json({
        success: true,
        simulatedOnly: true,
        invoice,
        result: {
          methodId: method.id,
          outcome,
          amount: Number(amount || invoice.invoice_total || invoice.total || 0),
          backendTodo: method.backendTodo || "TODO: replace this simulated outcome with a real provider webhook.",
        },
      });
    }

    const settledAmount = Number(amount || invoice.invoice_total || invoice.total || 0);
    const resolvedReference =
      reference ||
      (method.id === "cash"
        ? `CASH-${Date.now()}`
        : `${method.id.toUpperCase()}-${invoice.invoice_number || invoice.id}`);

    const paymentResult = await recordInvoicePayment({
      invoice,
      method,
      amount: settledAmount,
      reference: resolvedReference,
      timestamp,
    });

    return res.status(200).json({
      success: true,
      invoice: paymentResult.invoice,
      payment: {
        ...paymentResult.payment,
        amount_received: amountReceived ?? null,
      },
      result: {
        methodId: method.id,
        outcome,
        amount: settledAmount,
        backendTodo: method.backendTodo || "TODO: replace this simulated outcome with a real provider webhook.",
      },
    });
  } catch (error) {
    console.error("Failed to simulate invoice action:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to simulate invoice action",
    });
  }
}

export default withRoleGuard(handler, { allow: [...HR_CORE_ROLES, ...MANAGER_SCOPED_ROLES] });
