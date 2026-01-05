// file location: src/pages/api/company-accounts/next-number.js // helper API for generating next company account number
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const PREFIX = "CA-";
const PAD_LENGTH = 5;

async function handler(req, res, session) {
  const permissions = deriveAccountPermissions(session.user?.roles || []);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ success: false, message: "Method not allowed" });
    return;
  }
  if (!permissions.canCreateAccount) {
    res.status(403).json({ success: false, message: "Insufficient permissions" });
    return;
  }
  try {
    const { data, error } = await supabase
      .from("accounts")
      .select("account_id")
      .ilike("account_id", `${PREFIX}%`)
      .order("account_id", { ascending: false })
      .limit(1);
    if (error) {
      throw error;
    }
    const latest = data?.[0]?.account_id || "";
    const numericPortion = Number(latest.replace(/\D/g, "")) || 0;
    const next = String(numericPortion + 1).padStart(PAD_LENGTH, "0");
    res.status(200).json({ success: true, accountNumber: `${PREFIX}${next}` });
  } catch (error) {
    console.error("Failed to compute next company account number", error);
    res.status(500).json({ success: false, message: error.message || "Unable to generate account number" });
  }
}

export default withRoleGuard(handler, { allow: allowedRoles });
