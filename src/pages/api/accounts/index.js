// file location: src/pages/api/accounts/index.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard helper to enforce Keycloak RBAC
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "workshop manager", "sales"];
const numberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const buildSummary = (accounts = [], overdueCount = 0) => {
  const openCount = accounts.filter((account) => account.status === "Active").length;
  const frozenCount = accounts.filter((account) => account.status === "Frozen").length;
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const creditExposure = accounts.reduce((sum, account) => sum + Number(account.credit_limit || 0), 0);
  return { openCount, frozenCount, totalBalance, overdueInvoices: overdueCount, creditExposure };
};
const getOverdueInvoiceCount = async () => {
  const today = new Date().toISOString();
  const { count, error } = await supabase
    .from("invoices")
    .select("invoice_id", { count: "exact", head: true })
    .lt("due_date", today)
    .neq("payment_status", "Paid");
  if (error) {
    console.error("Failed to count overdue invoices", error);
    return 0;
  }
  return count || 0;
};
const fetchAccountsReport = async () => {
  const buildRange = (days) => {
    const start = new Date();
    start.setDate(start.getDate() - days);
    return start.toISOString();
  };
  const computeMetrics = async (days) => {
    const start = buildRange(days);
    const { data: accountRows, error: accountError } = await supabase
      .from("accounts")
      .select("balance, created_at, status")
      .gte("created_at", start);
    if (accountError) {
      console.error("Accounts report query failed", accountError);
      return { newAccounts: 0, totalInvoiced: 0, overdueInvoices: 0, averageBalance: 0 };
    }
    const { data: invoiceRows, error: invoiceError } = await supabase
      .from("invoices")
      .select("grand_total, payment_status, due_date, created_at")
      .gte("created_at", start);
    if (invoiceError) {
      console.error("Invoices report query failed", invoiceError);
    }
    const now = Date.now();
    const totalInvoiced = (invoiceRows || [])
      .filter((invoice) => !start || (invoice.created_at && invoice.created_at >= start))
      .reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
    const overdueInvoices = (invoiceRows || []).filter((invoice) => {
      if (!invoice.due_date) return false;
      if (invoice.payment_status === "Paid") return false;
      return new Date(invoice.due_date).getTime() < now;
    }).length;
    const newAccounts = accountRows.length;
    const averageBalance = accountRows.length === 0 ? 0 : accountRows.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) / accountRows.length;
    return { newAccounts, totalInvoiced, overdueInvoices, averageBalance };
  };
  const monthly = await computeMetrics(30);
  const quarterly = await computeMetrics(90);
  const yearly = await computeMetrics(365);
  return { monthly, quarterly, yearly };
};
async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    if (req.query.view === "reports") {
      const report = await fetchAccountsReport();
      res.status(200).json(report);
      return;
    }
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.max(1, Number(req.query.pageSize || 20));
    const search = req.query.search || "";
    const status = req.query.status || "";
    const accountType = req.query.accountType || permissions.restrictedAccountTypes?.[0] || "";
    const dateFrom = req.query.dateFrom || "";
    const dateTo = req.query.dateTo || "";
    const minBalance = numberOrNull(req.query.minBalance);
    const maxBalance = numberOrNull(req.query.maxBalance);
    const sortField = req.query.sortField || "updated_at";
    const sortDirection = (req.query.sortDirection || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    let query = supabase.from("accounts").select("*", { count: "exact" });
    if (status) { query = query.eq("status", status); }
    if (accountType) { query = query.eq("account_type", accountType); }
    if (dateFrom) { query = query.gte("created_at", dateFrom); }
    if (dateTo) { query = query.lte("created_at", dateTo); }
    if (minBalance !== null) { query = query.gte("balance", minBalance); }
    if (maxBalance !== null) { query = query.lte("balance", maxBalance); }
    if (search) {
      const ilike = `%${search}%`;
      query = query.or(`account_id.ilike.${ilike},billing_name.ilike.${ilike},customer_id.ilike.${ilike}`);
    }
    query = query.order(sortField, { ascending: sortDirection === "asc" });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);
    const { data, error, count } = await query;
    if (error) {
      console.error("Failed to query accounts", error);
      res.status(500).json({ success: false, message: "Unable to load accounts" });
      return;
    }
    const overdueCount = await getOverdueInvoiceCount();
    const summary = buildSummary(data || [], overdueCount);
    res.status(200).json({
      success: true,
      data: data || [],
      pagination: { page, pageSize, total: count || 0 },
      summary,
    });
    return;
  }
  if (req.method === "POST") {
    if (!permissions.canCreateAccount) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const payload = req.body || {};
    const insertValues = {
      account_id: payload.account_id || undefined,
      customer_id: payload.customer_id || null,
      account_type: payload.account_type || "Retail",
      balance: payload.balance || 0,
      credit_limit: payload.credit_limit || 0,
      status: payload.status || "Active",
      billing_name: payload.billing_name || "",
      billing_email: payload.billing_email || "",
      billing_phone: payload.billing_phone || "",
      billing_address_line1: payload.billing_address_line1 || "",
      billing_address_line2: payload.billing_address_line2 || "",
      billing_city: payload.billing_city || "",
      billing_postcode: payload.billing_postcode || "",
      billing_country: payload.billing_country || "United Kingdom",
      credit_terms: payload.credit_terms || 30,
      notes: payload.notes || "",
    };
    const { data, error } = await supabase
      .from("accounts")
      .insert([insertValues])
      .select()
      .single();
    if (error) {
      console.error("Failed to create account", error);
      res.status(500).json({ success: false, message: "Unable to create account" });
      return;
    }
    res.status(201).json({ success: true, data });
    return;
  }
  res.setHeader("Allow", "GET,POST");
  res.status(405).json({ success: false, message: "Method not allowed" });
}
export default withRoleGuard(handler, { allow: allowedRoles });
