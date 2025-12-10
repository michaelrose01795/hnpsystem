// file location: src/pages/api/accounts/[id].js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard helper for RBAC enforcement
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager", "general manager", "service manager", "workshop manager", "sales"];
async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ success: false, message: "Account id is required" });
    return;
  }
  if (req.method === "GET") {
    if (!permissions.canViewAccounts) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("account_id", id)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch account", error);
      res.status(500).json({ success: false, message: "Unable to load account" });
      return;
    }
    if (!account) {
      res.status(404).json({ success: false, message: "Account not found" });
      return;
    }
    const { data: transactions } = await supabase
      .from("account_transactions")
      .select("*")
      .eq("account_id", id)
      .order("transaction_date", { ascending: false })
      .limit(10);
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("account_id", id)
      .order("created_at", { ascending: false })
      .limit(10);
    res.status(200).json({ success: true, data: account, transactions: transactions || [], invoices: invoices || [] });
    return;
  }
  if (req.method === "PUT") {
    if (!permissions.canEditAccount) {
      res.status(403).json({ success: false, message: "Insufficient permissions" });
      return;
    }
    const incoming = req.body || {};
    const updates = {};
    const copyFields = [
      "customer_id",
      "account_type",
      "billing_name",
      "billing_email",
      "billing_phone",
      "billing_address_line1",
      "billing_address_line2",
      "billing_city",
      "billing_postcode",
      "billing_country",
      "credit_terms",
      "notes",
    ];
    const sharedFields = ["balance", "credit_limit", "status"];
    sharedFields.forEach((field) => {
      if (field in incoming) {
        updates[field] = incoming[field];
      }
    });
    if (permissions.hasAccounts || permissions.hasAdmin) {
      copyFields.forEach((field) => {
        if (field in incoming) {
          updates[field] = incoming[field];
        }
      });
    }
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ success: false, message: "No valid fields to update" });
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update(updates)
      .eq("account_id", id)
      .select()
      .single();
    if (error) {
      console.error("Failed to update account", error);
      res.status(500).json({ success: false, message: "Unable to update account" });
      return;
    }
    res.status(200).json({ success: true, data });
    return;
  }
  res.setHeader("Allow", "GET,PUT");
  res.status(405).json({ success: false, message: "Method not allowed" });
}
export default withRoleGuard(handler, { allow: allowedRoles });
