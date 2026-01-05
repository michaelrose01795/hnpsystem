// file location: src/pages/api/company-accounts/index.js // API for listing and creating company-focused ledger entries
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const ACCOUNT_TYPE = "Company";

const baseFieldList = [
  "account_id",
  "account_type",
  "status",
  "billing_name",
  "billing_email",
  "billing_phone",
  "billing_address_line1",
  "billing_address_line2",
  "billing_city",
  "billing_postcode",
  "billing_country",
  "credit_limit",
  "credit_terms",
  "notes",
];

async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const search = (req.query.search || "").trim();
    let query = supabase.from("accounts").select("*").eq("account_type", ACCOUNT_TYPE);
    if (search) {
      const ilike = `%${search}%`;
      query = query.or(
        [
          `account_id.ilike.${ilike}`,
          `billing_name.ilike.${ilike}`,
          `billing_email.ilike.${ilike}`,
          `billing_phone.ilike.${ilike}`,
          `billing_city.ilike.${ilike}`,
        ].join(",")
      );
    }
    query = query.order("billing_name", { ascending: true });
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
    if (!payload.account_id) {
      res.status(400).json({ success: false, message: "Account number is required" });
      return;
    }
    if (!payload.billing_name) {
      res.status(400).json({ success: false, message: "Company name is required" });
      return;
    }
    const insertValues = {
      account_id: payload.account_id,
      account_type: ACCOUNT_TYPE,
      status: payload.status || "Active",
      billing_name: payload.billing_name,
      billing_email: payload.billing_email || "",
      billing_phone: payload.billing_phone || "",
      billing_address_line1: payload.billing_address_line1 || "",
      billing_address_line2: payload.billing_address_line2 || "",
      billing_city: payload.billing_city || "",
      billing_postcode: payload.billing_postcode || "",
      billing_country: payload.billing_country || "United Kingdom",
      credit_limit: Number(payload.credit_limit || 0),
      credit_terms: Number(payload.credit_terms || 30),
      notes: payload.notes || "",
      balance: 0,
      customer_id: null,
    };
    const { data, error } = await supabase.from("accounts").insert([insertValues]).select().single();
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
