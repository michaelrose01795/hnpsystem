// file location: src/pages/api/company-accounts/index.js // API for listing and creating company-focused ledger entries
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const COMPANY_ACCOUNTS_TABLE = "company_accounts";

async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
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
      console.error("Failed to query company accounts", error);
      res.status(500).json({ success: false, message: "Unable to load company accounts" });
      return;
    }
    res.status(200).json({ success: true, data: data || [] });
    return;
  }
  if (req.method === "POST") {
    if (!permissions.canCreateAccount) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const payload = req.body || {};
    const accountNumber = String(payload.account_number || "").trim();
    const companyName = String(payload.company_name || "").trim();
    if (!accountNumber) {
      res.status(400).json({ success: false, message: "Account number is required" });
      return;
    }
    if (!companyName) {
      res.status(400).json({ success: false, message: "Company name is required" });
      return;
    }
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
      notes: payload.notes || "",
    };
    const { data, error } = await supabase
      .from(COMPANY_ACCOUNTS_TABLE)
      .insert([insertValues])
      .select()
      .single();
    if (error) {
      console.error("Failed to create company account", error);
      res.status(500).json({ success: false, message: "Unable to create company account" });
      return;
    }
    res.status(201).json({ success: true, data });
    return;
  }
  res.setHeader("Allow", "GET,POST");
  res.status(405).json({ success: false, message: "Method not allowed" });
}

export default withRoleGuard(handler, { allow: allowedRoles });
