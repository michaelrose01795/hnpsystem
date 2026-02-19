// file location: src/pages/api/company-accounts/index.js
import createHandler, { denyUnless, sendError } from "@/lib/api/createHandler";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const COMPANY_ACCOUNTS_TABLE = "company_accounts";

const formatInsertError = (error, context = {}) => {
  if (!error) {
    return { status: 500, message: "Unable to create company account" };
  }
  const { accountNumber } = context;
  const { code, message, details } = error;
  if (code === "23505") {
    const duplicateFieldMatch = details?.match(/\(([^)]+)\)=\(([^)]+)\)/);
    if (duplicateFieldMatch) {
      const [, column, value] = duplicateFieldMatch;
      return {
        status: 409,
        message: `${column.replace(/_/g, " ")} "${value}" already exists. Please use a different value.`,
      };
    }
    return {
      status: 409,
      message: "Another company account already uses this account number. Please choose a different number.",
    };
  }
  if (code === "23503" && details?.includes("linked_account_id")) {
    return {
      status: 400,
      message: "The linked ledger account could not be found. Please check the account ID or remove it.",
    };
  }
  if (code === "23502") {
    const fieldMatch = details?.match(/column \"([^\"]+)\"/i);
    if (fieldMatch) {
      const [, column] = fieldMatch;
      return {
        status: 400,
        message: `Field "${column.replace(/_/g, " ")}" is required.`,
      };
    }
  }
  if (message?.toLowerCase().includes("account_number")) {
    return {
      status: 400,
      message: accountNumber ? `Account number "${accountNumber}" is invalid or already used.` : "Account number is invalid.",
    };
  }
  return {
    status: 400,
    message: message || "Unable to create company account",
  };
};

export default createHandler({
  allowedRoles,
  methods: {
    GET: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      if (denyUnless(res, permissions.canViewAccounts)) return;

      const search = (req.query.search || "").trim();
      let query = supabase.from(COMPANY_ACCOUNTS_TABLE).select("*");
      if (search) {
        const ilike = `%${search}%`;
        query = query.or(
          [
            `account_number.ilike.${ilike}`,
            `company_name.ilike.${ilike}`,
            `trading_name.ilike.${ilike}`,
            `contact_email.ilike.${ilike}`,
            `contact_phone.ilike.${ilike}`,
            `billing_city.ilike.${ilike}`,
          ].join(",")
        );
      }
      query = query.order("company_name", { ascending: true });
      const { data, error } = await query;
      if (error) {
        return sendError(res, 500, "Unable to load company accounts", error);
      }
      res.status(200).json({ success: true, data: data || [] });
    },
    POST: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      if (denyUnless(res, permissions.canCreateAccount)) return;

      const payload = req.body || {};
      const accountNumber = String(payload.account_number || "").trim();
      const companyName = String(payload.company_name || "").trim();
      if (!accountNumber) {
        return sendError(res, 400, "Account number is required");
      }
      if (!companyName) {
        return sendError(res, 400, "Company name is required");
      }
      const linkedAccountLabel = String(payload.linked_account_label || "").trim();
      const insertValues = {
        account_number: accountNumber,
        company_name: companyName,
        trading_name: payload.trading_name || "",
        contact_name: payload.contact_name || "",
        contact_email: payload.contact_email || "",
        contact_phone: payload.contact_phone || "",
        billing_address_line1: payload.billing_address_line1 || "",
        billing_address_line2: payload.billing_address_line2 || "",
        billing_city: payload.billing_city || "",
        billing_postcode: payload.billing_postcode || "",
        billing_country: payload.billing_country || "United Kingdom",
        linked_account_id: payload.linked_account_id ? String(payload.linked_account_id).trim() : null,
        linked_account_label: linkedAccountLabel,
        notes: payload.notes || "",
      };
      const { data, error } = await supabase
        .from(COMPANY_ACCOUNTS_TABLE)
        .insert([insertValues])
        .select()
        .single();
      if (error) {
        console.error("Failed to create company account", error);
        const { status, message } = formatInsertError(error, { accountNumber });
        res.status(status).json({ success: false, message });
        return;
      }
      res.status(201).json({ success: true, data });
    },
  },
});
