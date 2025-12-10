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
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
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
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: false });
  let job = null;
  if (invoice.job_number) {
    const { data: jobRecord } = await supabase
      .from("job_cards")
      .select("job_number, status, reg, service_advisor")
      .eq("job_number", invoice.job_number)
      .maybeSingle();
    job = jobRecord || null;
  }
  res.status(200).json({ success: true, data: invoice, payments: payments || [], job });
}
export default withRoleGuard(handler, { allow: allowedRoles });
