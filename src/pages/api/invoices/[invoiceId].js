// file location: src/pages/api/invoices/[invoiceId].js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard to enforce RBAC
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "sales", "workshop", "workshop manager", "parts", "parts manager", "service manager"];
async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  if (!permissions.canViewInvoices) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  const { invoiceId } = req.query;
  if (!invoiceId) {
    res.status(400).json({ success: false, message: "Invoice id is required" });
    return;
  }
  let invoice = null;
  let error = null;

  const invoiceLookups = [
    { field: "invoice_number", value: invoiceId },
    { field: "invoice_id", value: invoiceId },
    { field: "id", value: invoiceId },
  ];

  for (const lookup of invoiceLookups) {
    const result = await supabase
      .from("invoices")
      .select("*, customer:customer_id(id, firstname, lastname, name), account:account_id(account_id, billing_name, credit_terms)")
      .eq(lookup.field, lookup.value)
      .maybeSingle();

    if (result.error && result.error.code !== "PGRST116") {
      error = result.error;
      break;
    }

    if (result.data) {
      invoice = result.data;
      error = null;
      break;
    }
  }

  if (error) {
    console.error("Failed to fetch invoice", error);
    res.status(500).json({ success: false, message: "Unable to load invoice" });
    return;
  }
  if (!invoice) {
    res.status(404).json({ success: false, message: "Invoice not found" });
    return;
  }
  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoice?.id || invoiceId)
    .order("payment_date", { ascending: false });
  let job = null;
  if (invoice.job_number) {
    const { data: jobRecord, error: jobError } = await supabase
      .from("jobs")
      .select(
        `
          job_number,
          status,
          vehicle_reg,
          vehicle_make_model,
          assigned_to,
          advisor:assigned_to (
            user_id,
            name,
            first_name,
            last_name
          )
        `
      )
      .eq("job_number", invoice.job_number)
      .maybeSingle();

    if (jobError && jobError.code !== "PGRST116") {
      console.error("Failed to fetch linked job", jobError);
      res.status(500).json({ success: false, message: "Unable to load linked job" });
      return;
    }

    if (jobRecord) {
      const advisorName =
        jobRecord.advisor?.name ||
        [jobRecord.advisor?.first_name, jobRecord.advisor?.last_name]
          .filter(Boolean)
          .join(" ") ||
        null;
      job = {
        job_number: jobRecord.job_number,
        status: jobRecord.status,
        reg: jobRecord.vehicle_reg,
        vehicle: jobRecord.vehicle_make_model || jobRecord.vehicle_reg,
        advisor: advisorName,
      };
    }
  }
  res.status(200).json({ success: true, data: invoice, payments: payments || [], job });
}
export default withRoleGuard(handler, { allow: allowedRoles });
