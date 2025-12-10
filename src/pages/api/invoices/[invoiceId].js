// file location: src/pages/api/invoices/[invoiceId].js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard to enforce RBAC
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper for invoice access rules
import supabase from "@/lib/supabaseClient"; // import Supabase client for database access
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "sales", "workshop", "workshop manager", "parts", "parts manager", "service manager"]; // allowed roles for invoice detail API
async function handler(req, res, session) { // main handler for invoice detail requests
  if (req.method !== "GET") { // enforce GET-only behavior for this endpoint
    res.setHeader("Allow", "GET"); // advertise allowed method
    res.status(405).json({ success: false, message: "Method not allowed" }); // respond 405 when method unsupported
    return; // exit handler
  } // close guard
  const permissions = deriveAccountPermissions(session.user?.roles || []); // derive permission flags from session roles
  if (!permissions.canViewInvoices) { // ensure caller allowed to view invoices
    res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when unauthorized
    return; // exit handler
  } // close guard
  const { invoiceId } = req.query; // read invoice identifier from route parameters
  if (!invoiceId) { // validate invoice id presence
    res.status(400).json({ success: false, message: "Invoice id is required" }); // respond with validation error when missing
    return; // exit handler
  } // close guard
  const { data: invoice, error } = await supabase // fetch invoice record from database
    .from("invoices") // target invoices table
    .select("*") // select all columns for detail view
    .eq("invoice_id", invoiceId) // filter by invoice id
    .maybeSingle(); // expect zero or one row
  if (error) { // handle Supabase errors
    console.error("Failed to fetch invoice", error); // log error for debugging
    res.status(500).json({ success: false, message: "Unable to load invoice" }); // respond failure when query fails
    return; // exit handler
  } // close guard
  if (!invoice) { // handle case where invoice not found
    res.status(404).json({ success: false, message: "Invoice not found" }); // respond 404 when id invalid
    return; // exit handler
  } // close guard
  const { data: payments } = await supabase // fetch payment history for invoice
    .from("invoice_payments") // target invoice_payments table
    .select("*") // select all columns for timeline display
    .eq("invoice_id", invoiceId) // filter by invoice id
    .order("payment_date", { ascending: false }); // order newest payments first
  let job = null; // placeholder for job card information
  if (invoice.job_number) { // fetch linked job card when invoice references job number
    const { data: jobRecord } = await supabase // query job_cards table to enrich detail view
      .from("job_cards") // target job_cards table
      .select("job_number, status, reg, service_advisor") // fetch limited fields needed for UI
      .eq("job_number", invoice.job_number) // filter by job number
      .maybeSingle(); // expect zero or one row
    job = jobRecord || null; // store fetched job card or null when not found
  } // close job fetch branch
  res.status(200).json({ success: true, data: invoice, payments: payments || [], job }); // return aggregated payload to caller
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard to enforce allowed roles
