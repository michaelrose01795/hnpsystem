// file location: src/pages/api/company-accounts/[accountNumber].js // detail/update/delete endpoints for company accounts
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const ACCOUNT_TYPE = "Company";
const editableFields = [
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
  "status",
];

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
      .from("accounts")
      .select("*")
      .eq("account_id", accountNumber)
      .eq("account_type", ACCOUNT_TYPE)
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
    res.status(200).json({ success: true, data });
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
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("account_id", accountNumber)
      .eq("account_type", ACCOUNT_TYPE)
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
      .from("accounts")
      .delete()
      .eq("account_id", accountNumber)
      .eq("account_type", ACCOUNT_TYPE);
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
