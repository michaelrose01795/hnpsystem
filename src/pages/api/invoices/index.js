// file location: src/pages/api/invoices/index.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard enforcing Keycloak RBAC
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
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.pageSize || 20));
  const search = req.query.search || "";
  const status = req.query.status || "";
  const from = req.query.from || "";
  const to = req.query.to || "";
  const accountId = req.query.accountId || "";
  const jobNumber = req.query.jobNumber || "";
  let query = supabase
    .from("invoices")
    .select("*", { count: "exact" });
  if (status) { query = query.eq("payment_status", status); }
  if (accountId) { query = query.eq("account_id", accountId); }
  if (from) { query = query.gte("created_at", from); }
  if (to) { query = query.lte("created_at", to); }
  if (permissions.restrictInvoicesToJobs && jobNumber) { query = query.eq("job_number", jobNumber); }
  if (permissions.restrictInvoicesToJobs && !jobNumber) { query = query.eq("job_number", "__none__"); }
  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`invoice_id.ilike.${pattern},customer_id.ilike.${pattern},account_id.ilike.${pattern},job_number.ilike.${pattern}`);
  }
  query = query.order("created_at", { ascending: false });
  const fromIndex = (page - 1) * pageSize;
  const toIndex = fromIndex + pageSize - 1;
  query = query.range(fromIndex, toIndex);
  const { data, error, count } = await query;
  if (error) {
    console.error("Failed to fetch invoices", error);
    res.status(500).json({ success: false, message: "Unable to load invoices" });
    return;
  }
  res.status(200).json({ success: true, data: data || [], pagination: { page, pageSize, total: count || 0 } });
}
export default withRoleGuard(handler, { allow: allowedRoles });
