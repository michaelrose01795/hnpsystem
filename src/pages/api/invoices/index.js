// file location: src/pages/api/invoices/index.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard enforcing Keycloak RBAC
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper for invoice scoping
import supabase from "@/lib/supabaseClient"; // import Supabase client for database access
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "sales", "workshop", "workshop manager", "parts", "parts manager", "service manager"]; // roles permitted to read invoices
async function handler(req, res, session) { // main handler for invoice list requests
  if (req.method !== "GET") { // enforce GET-only API as per requirements
    res.setHeader("Allow", "GET"); // advertise allowed method
    res.status(405).json({ success: false, message: "Method not allowed" }); // respond with failure for unsupported verbs
    return; // exit handler early
  } // close guard
  const permissions = deriveAccountPermissions(session.user?.roles || []); // compute permission flags for scoped queries
  if (!permissions.canViewInvoices) { // ensure caller allowed to read invoices
    res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when user lacks invoice access
    return; // exit handler
  } // close guard
  const page = Math.max(1, Number(req.query.page || 1)); // parse page parameter from query string
  const pageSize = Math.max(1, Number(req.query.pageSize || 20)); // parse page size parameter
  const search = req.query.search || ""; // search term across invoice/customer/account
  const status = req.query.status || ""; // invoice status filter
  const from = req.query.from || ""; // start date filter
  const to = req.query.to || ""; // end date filter
  const accountId = req.query.accountId || ""; // account id filter when navigating from account view
  const jobNumber = req.query.jobNumber || ""; // job number filter used for workshop/parts scoping
  let query = supabase // start building Supabase query for invoices
    .from("invoices") // target invoices table
    .select("*", { count: "exact" }); // fetch rows and include total count metadata
  if (status) { query = query.eq("payment_status", status); } // filter by payment status when provided
  if (accountId) { query = query.eq("account_id", accountId); } // filter by account id when provided
  if (from) { query = query.gte("created_at", from); } // filter by created date lower bound
  if (to) { query = query.lte("created_at", to); } // filter by created date upper bound
  if (permissions.restrictInvoicesToJobs && jobNumber) { query = query.eq("job_number", jobNumber); } // restrict to provided job number for workshop/parts contexts
  if (permissions.restrictInvoicesToJobs && !jobNumber) { query = query.eq("job_number", "__none__"); } // prevent unrestricted access when job number missing by filtering to impossible value
  if (search) { // apply OR search filter when search term present
    const pattern = `%${search}%`; // wildcard search string
    query = query.or(`invoice_id.ilike.${pattern},customer_id.ilike.${pattern},account_id.ilike.${pattern},job_number.ilike.${pattern}`); // apply OR filter against key columns
  } // close search guard
  query = query.order("created_at", { ascending: false }); // order newest invoices first
  const fromIndex = (page - 1) * pageSize; // compute pagination start index
  const toIndex = fromIndex + pageSize - 1; // compute pagination end index
  query = query.range(fromIndex, toIndex); // apply pagination to query
  const { data, error, count } = await query; // execute Supabase query
  if (error) { // handle database errors
    console.error("Failed to fetch invoices", error); // log error for debugging
    res.status(500).json({ success: false, message: "Unable to load invoices" }); // respond with error message
    return; // exit handler
  } // close guard
  res.status(200).json({ success: true, data: data || [], pagination: { page, pageSize, total: count || 0 } }); // respond with paginated invoice data
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard enforcing allowed roles
