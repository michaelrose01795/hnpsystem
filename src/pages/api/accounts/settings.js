// file location: src/pages/api/accounts/settings.js // header comment referencing API path
import { withRoleGuard } from "@/lib/auth/roleGuard"; // import role guard to enforce Keycloak RBAC
import supabase from "@/lib/supabaseClient";
const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const TABLE = "account_settings";
async function handler(req, res) {
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from(TABLE)
      .select("settings")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("Failed to load account settings", error);
      res.status(200).json({ success: true, data: {} });
      return;
    }
    res.status(200).json({ success: true, data: data?.settings || {} });
    return;
  }
  if (req.method === "PUT") {
    const payload = req.body || {};
    const { error } = await supabase
      .from(TABLE)
      .upsert({ id: 1, settings: payload }, { onConflict: "id" });
    if (error) {
      console.error("Failed to save account settings", error);
      res.status(500).json({ success: false, message: "Unable to save settings" });
      return;
    }
    res.status(200).json({ success: true, data: payload });
    return;
  }
  res.setHeader("Allow", "GET,PUT");
  res.status(405).json({ success: false, message: "Method not allowed" });
}
export default withRoleGuard(handler, { allow: allowedRoles });
