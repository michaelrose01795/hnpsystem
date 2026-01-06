// file location: src/pages/api/company-accounts/[accountNumber].js // detail/update/delete endpoints for company accounts
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const COMPANY_ACCOUNTS_TABLE = "company_accounts";
const HISTORY_LIMIT = 50;
const editableFields = [
  "company_name",
  "trading_name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "billing_address_line1",
  "billing_address_line2",
  "billing_city",
  "billing_postcode",
  "billing_country",
  "notes",
  "linked_account_id",
  "linked_account_label",
];

async function fetchAccountHistory(accountNumber) {
  const history = { jobs: [], invoices: [] };
  if (!accountNumber) {
    return history;
  }
  const [jobsResult, invoicesResult] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, job_number, job_source, status, customer, vehicle_reg, vehicle_make_model, created_at, completed_at"
      )
      .eq("account_number", accountNumber)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, job_number, order_number, payment_status, invoice_total, invoice_date, due_date, created_at, invoice_to"
      )
      .eq("account_number", accountNumber)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
  ]);
  if (jobsResult.error) {
    console.error("Failed to load company account job history", jobsResult.error);
  } else {
    history.jobs = jobsResult.data || [];
  }
  if (invoicesResult.error) {
    console.error("Failed to load company account invoice history", invoicesResult.error);
  } else {
    history.invoices = invoicesResult.data || [];
  }
  return history;
}

async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  const accountNumber = (req.query.accountNumber || "").toString();
  if (!accountNumber) {
    res.status(400).json({ success: false, message: "Missing account number" });
    return;
  }
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const { data, error } = await supabase
      .from(COMPANY_ACCOUNTS_TABLE)
      .select("*")
      .eq("account_number", accountNumber)
      .maybeSingle();
    if (error) {
      console.error("Failed to load company account", error);
      res.status(500).json({ success: false, message: "Unable to load company account" });
      return;
    }
    if (!data) {
      res.status(404).json({ success: false, message: "Company account not found" });
      return;
    }
    const history = await fetchAccountHistory(accountNumber);
    res.status(200).json({ success: true, data, history });
    return;
  }
  if (req.method === "PUT") {
    if (!permissions.canEditAccount) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const incoming = req.body || {};
    const updates = {};
    editableFields.forEach((field) => {
      if (field in incoming) {
        updates[field] = incoming[field];
      }
    });
    if (Object.prototype.hasOwnProperty.call(updates, "company_name")) {
      updates.company_name = String(updates.company_name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "trading_name")) {
      updates.trading_name = String(updates.trading_name || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "linked_account_id")) {
      const linkedValue = String(updates.linked_account_id || "").trim();
      updates.linked_account_id = linkedValue ? linkedValue : null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "linked_account_label")) {
      updates.linked_account_label = String(updates.linked_account_label || "").trim();
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }
    const { data, error } = await supabase
      .from(COMPANY_ACCOUNTS_TABLE)
      .update(updates)
      .eq("account_number", accountNumber)
      .select()
      .single();
    if (error) {
      console.error("Failed to update company account", error);
      res.status(500).json({ success: false, message: "Unable to update company account" });
      return;
    }
    res.status(200).json({ success: true, data });
    return;
  }
  if (req.method === "DELETE") {
    if (!permissions.canEditAccount) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const { error } = await supabase
      .from(COMPANY_ACCOUNTS_TABLE)
      .delete()
      .eq("account_number", accountNumber);
    if (error) {
      console.error("Failed to delete company account", error);
      res.status(500).json({ success: false, message: "Unable to delete company account" });
      return;
    }
    res.status(204).end();
    return;
  }
  res.setHeader("Allow", "GET,PUT,DELETE");
  res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { allow: allowedRoles });
