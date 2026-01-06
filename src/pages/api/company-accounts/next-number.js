// file location: src/pages/api/company-accounts/next-number.js // helper API for generating next company account number
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { deriveAccountPermissions } from "@/lib/accounts/permissions";
import supabase from "@/lib/supabaseClient";

const allowedRoles = ["admin", "owner", "admin manager", "accounts", "accounts manager"];
const PREFIX = "CA";
const PAD_LENGTH = 4;
const MAX_ATTEMPTS = 10;

const randomNumber = () => {
  const upperBound = 10 ** PAD_LENGTH;
  return Math.floor(Math.random() * upperBound);
};

const formatAccountNumber = (num) => `${PREFIX}${String(num).padStart(PAD_LENGTH, "0")}`;

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
    let attempts = 0;
    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      const candidate = formatAccountNumber(randomNumber());
      const { data: existing, error: lookupError } = await supabase
        .from("company_accounts")
        .select("id")
        .eq("account_number", candidate)
        .limit(1);
      if (lookupError) {
        throw lookupError;
      }
      if (!existing || !existing.length) {
        res.status(200).json({ success: true, accountNumber: candidate });
        return;
      }
    }
    res.status(503).json({ success: false, message: "Unable to generate unique account number. Please try again." });
  } catch (error) {
    console.error("Failed to compute next company account number", error);
    res.status(500).json({ success: false, message: error.message || "Unable to generate account number" });
  }
}

export default withRoleGuard(handler, { allow: allowedRoles });
