// file location: src/pages/api/accounts/index.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard helper to enforce Keycloak RBAC
import { deriveAccountPermissions } from "@/lib/accounts/permissions"; // import permission helper shared with UI
import supabase from "@/lib/supabaseClient"; // import Supabase client for database access
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "workshop manager", "sales"]; // list of roles allowed to hit accounts endpoints
const numberOrNull = (value) => { // helper that converts string values to numbers or null if invalid
  const parsed = Number(value); // parse using Number constructor
  return Number.isFinite(parsed) ? parsed : null; // return parsed when numeric otherwise null
}; // close numberOrNull helper
const buildSummary = (accounts = [], overdueCount = 0) => { // helper to compute summary metrics from fetched rows
  const openCount = accounts.filter((account) => account.status === "Active").length; // count active accounts
  const frozenCount = accounts.filter((account) => account.status === "Frozen").length; // count frozen accounts
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0); // sum account balances
  const creditExposure = accounts.reduce((sum, account) => sum + Number(account.credit_limit || 0), 0); // sum credit limits to get exposure
  return { openCount, frozenCount, totalBalance, overdueInvoices: overdueCount, creditExposure }; // return summary object used by UI
}; // close buildSummary helper
const getOverdueInvoiceCount = async () => { // helper to count overdue invoices for summary chips
  const today = new Date().toISOString(); // compute ISO timestamp for current date
  const { count, error } = await supabase // query Supabase for overdue invoices count
    .from("invoices") // target invoices table
    .select("invoice_id", { count: "exact", head: true }) // request only count for efficiency
    .lt("due_date", today) // filter invoices past due date
    .neq("payment_status", "Paid"); // ensure invoice still unpaid
  if (error) { // handle Supabase errors gracefully
    console.error("Failed to count overdue invoices", error); // log error for debugging
    return 0; // return zero so UI still renders
  } // close guard
  return count || 0; // return count value or zero when undefined
}; // close getOverdueInvoiceCount helper
const fetchAccountsReport = async () => { // helper building monthly/quarterly/yearly report payload
  const buildRange = (days) => { // helper returning ISO date for range start
    const start = new Date(); // capture current date
    start.setDate(start.getDate() - days); // subtract number of days requested
    return start.toISOString(); // convert to ISO string for Supabase filters
  }; // close buildRange helper
  const computeMetrics = async (days) => { // helper computing metrics for a given range length
    const start = buildRange(days); // compute range start date
    const { data: accountRows, error: accountError } = await supabase // fetch accounts created since start
      .from("accounts") // query accounts table
      .select("balance, created_at, status") // select necessary columns
      .gte("created_at", start); // filter by created_at
    if (accountError) { // handle errors for accounts query
      console.error("Accounts report query failed", accountError); // log error for debugging
      return { newAccounts: 0, totalInvoiced: 0, overdueInvoices: 0, averageBalance: 0 }; // return blank metrics
    } // close guard
    const { data: invoiceRows, error: invoiceError } = await supabase // fetch invoices created since start
      .from("invoices") // query invoices table
      .select("grand_total, payment_status, due_date, created_at") // select columns needed for metrics
      .gte("created_at", start); // limit invoices to range start
    if (invoiceError) { // handle invoice query errors
      console.error("Invoices report query failed", invoiceError); // log error for debugging
    } // close guard for invoice query
    const now = Date.now(); // store timestamp for overdue comparison
    const totalInvoiced = (invoiceRows || []) // compute invoice total across period
      .filter((invoice) => !start || (invoice.created_at && invoice.created_at >= start)) // filter to range when invoice rows returned without filter
      .reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0); // sum totals
    const overdueInvoices = (invoiceRows || []).filter((invoice) => { // compute overdue count for period
      if (!invoice.due_date) return false; // ignore invoices without due date
      if (invoice.payment_status === "Paid") return false; // ignore paid invoices
      return new Date(invoice.due_date).getTime() < now; // count when due date earlier than now
    }).length; // end filter
    const newAccounts = accountRows.length; // number of accounts created in range
    const averageBalance = accountRows.length === 0 ? 0 : accountRows.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) / accountRows.length; // compute average balance
    return { newAccounts, totalInvoiced, overdueInvoices, averageBalance }; // return metrics object for this period
  }; // close computeMetrics helper
  const monthly = await computeMetrics(30); // compute metrics scoped to 30 days
  const quarterly = await computeMetrics(90); // compute metrics scoped to 90 days
  const yearly = await computeMetrics(365); // compute metrics scoped to 365 days
  return { monthly, quarterly, yearly }; // return aggregated payload for reports API
}; // close fetchAccountsReport helper
async function handler(req, res, session) { // main API handler referenced by Next.js
  const permissions = deriveAccountPermissions(session.user?.roles || []); // derive permission flags from Keycloak roles
  if (req.method === "GET") { // handle GET requests for listing or reporting
    if (!permissions.canViewAccounts) { // ensure caller allowed to read accounts
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when user not allowed
      return; // exit handler early
    } // close guard
    if (req.query.view === "reports") { // branch when report view requested
      const report = await fetchAccountsReport(); // build report metrics using helper
      res.status(200).json(report); // return metrics to caller
      return; // exit handler
    } // close report branch
    const page = Math.max(1, Number(req.query.page || 1)); // parse page number from query string
    const pageSize = Math.max(1, Number(req.query.pageSize || 20)); // parse page size from query string
    const search = req.query.search || ""; // read search filter string
    const status = req.query.status || ""; // read status filter string
    const accountType = req.query.accountType || permissions.restrictedAccountTypes?.[0] || ""; // read account type filter, respecting sales restriction
    const dateFrom = req.query.dateFrom || ""; // read created date start filter
    const dateTo = req.query.dateTo || ""; // read created date end filter
    const minBalance = numberOrNull(req.query.minBalance); // parse min balance numeric filter
    const maxBalance = numberOrNull(req.query.maxBalance); // parse max balance numeric filter
    const sortField = req.query.sortField || "updated_at"; // read sort field
    const sortDirection = (req.query.sortDirection || "desc").toLowerCase() === "asc" ? "asc" : "desc"; // sanitize sort direction
    let query = supabase.from("accounts").select("*", { count: "exact" }); // start building Supabase query with count
    if (status) { query = query.eq("status", status); } // filter by status when provided
    if (accountType) { query = query.eq("account_type", accountType); } // filter by account type when provided
    if (dateFrom) { query = query.gte("created_at", dateFrom); } // filter by created_at lower bound
    if (dateTo) { query = query.lte("created_at", dateTo); } // filter by created_at upper bound
    if (minBalance !== null) { query = query.gte("balance", minBalance); } // filter by minimum balance
    if (maxBalance !== null) { query = query.lte("balance", maxBalance); } // filter by maximum balance
    if (search) { // apply OR filter for search term
      const ilike = `%${search}%`; // prepare wildcard string for ILIKE queries
      query = query.or(`account_id.ilike.${ilike},billing_name.ilike.${ilike},customer_id.ilike.${ilike}`); // filter by multiple columns simultaneously
    } // close search guard
    query = query.order(sortField, { ascending: sortDirection === "asc" }); // apply sorting to query
    const from = (page - 1) * pageSize; // compute range start index for pagination
    const to = from + pageSize - 1; // compute range end index for pagination
    query = query.range(from, to); // apply pagination range to Supabase query
    const { data, error, count } = await query; // execute query
    if (error) { // handle Supabase errors
      console.error("Failed to query accounts", error); // log error for debugging
      res.status(500).json({ success: false, message: "Unable to load accounts" }); // respond with generic failure
      return; // exit handler
    } // close guard
    const overdueCount = await getOverdueInvoiceCount(); // fetch overdue invoice count for summary chips
    const summary = buildSummary(data || [], overdueCount); // compute summary metrics for response
    res.status(200).json({ // respond with payload used by UI
      success: true, // indicate success indicator
      data: data || [], // include retrieved rows
      pagination: { page, pageSize, total: count || 0 }, // include pagination metadata
      summary, // include summary object for quick stats
    }); // close response
    return; // exit handler after responding
  } // close GET branch
  if (req.method === "POST") { // handle account creation requests
    if (!permissions.canCreateAccount) { // ensure caller allowed to create
      res.status(403).json({ success: false, message: "Insufficient permissions" }); // respond 403 when user not allowed
      return; // exit handler
    } // close guard
    const payload = req.body || {}; // read request body containing account fields
    const insertValues = { // build insert payload mapping to database columns
      account_id: payload.account_id || undefined, // allow custom account id or let Supabase auto-generate
      customer_id: payload.customer_id || null, // map customer id field
      account_type: payload.account_type || "Retail", // default account type when missing
      balance: payload.balance || 0, // set initial balance
      credit_limit: payload.credit_limit || 0, // set initial credit limit
      status: payload.status || "Active", // default account status
      billing_name: payload.billing_name || "", // billing name field
      billing_email: payload.billing_email || "", // billing email field
      billing_phone: payload.billing_phone || "", // billing phone field
      billing_address_line1: payload.billing_address_line1 || "", // billing address line 1
      billing_address_line2: payload.billing_address_line2 || "", // billing address line 2
      billing_city: payload.billing_city || "", // billing city field
      billing_postcode: payload.billing_postcode || "", // billing postcode field
      billing_country: payload.billing_country || "United Kingdom", // default billing country
      credit_terms: payload.credit_terms || 30, // default payment terms in days
      notes: payload.notes || "", // internal notes field
    }; // close insertValues object
    const { data, error } = await supabase // execute insert statement
      .from("accounts") // target accounts table
      .insert([insertValues]) // insert new record
      .select() // fetch inserted row for response
      .single(); // expect single row result
    if (error) { // handle insert errors
      console.error("Failed to create account", error); // log error for debugging
      res.status(500).json({ success: false, message: "Unable to create account" }); // respond with failure message
      return; // exit handler
    } // close guard
    res.status(201).json({ success: true, data }); // return created account to caller
    return; // exit handler
  } // close POST branch
  res.setHeader("Allow", "GET,POST"); // advertise supported methods for this endpoint
  res.status(405).json({ success: false, message: "Method not allowed" }); // respond 405 for unsupported methods
} // close handler definition
export default withRoleGuard(handler, { allow: allowedRoles }); // wrap handler with role guard to enforce base role list
