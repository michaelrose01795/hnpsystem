// file location: src/pages/api/company-accounts/[accountNumber].js
import createHandler, { denyUnless, sendError } from "@/lib/api/createHandler";
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
  if (!accountNumber) return history;

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

export default createHandler({
  allowedRoles,
  methods: {
    GET: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      const accountNumber = (req.query.accountNumber || "").toString();
      if (!accountNumber) return sendError(res, 400, "Missing account number");
      if (denyUnless(res, permissions.canViewAccounts)) return;

      const { data, error } = await supabase
        .from(COMPANY_ACCOUNTS_TABLE)
        .select("*")
        .eq("account_number", accountNumber)
        .maybeSingle();
      if (error) return sendError(res, 500, "Unable to load company account", error);
      if (!data) return sendError(res, 404, "Company account not found");

      const history = await fetchAccountHistory(accountNumber);
      res.status(200).json({ success: true, data, history });
    },
    PUT: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      const accountNumber = (req.query.accountNumber || "").toString();
      if (!accountNumber) return sendError(res, 400, "Missing account number");
      if (denyUnless(res, permissions.canEditAccount)) return;

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
        return sendError(res, 400, "No valid fields to update");
      }
      const { data, error } = await supabase
        .from(COMPANY_ACCOUNTS_TABLE)
        .update(updates)
        .eq("account_number", accountNumber)
        .select()
        .single();
      if (error) return sendError(res, 500, "Unable to update company account", error);
      res.status(200).json({ success: true, data });
    },
    DELETE: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      const accountNumber = (req.query.accountNumber || "").toString();
      if (!accountNumber) return sendError(res, 400, "Missing account number");
      if (denyUnless(res, permissions.canEditAccount)) return;

      const { error } = await supabase
        .from(COMPANY_ACCOUNTS_TABLE)
        .delete()
        .eq("account_number", accountNumber);
      if (error) return sendError(res, 500, "Unable to delete company account", error);
      res.status(204).end();
    },
  },
});
