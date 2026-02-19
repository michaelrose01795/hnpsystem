// file location: src/pages/api/company-accounts/next-number.js
import createHandler, { denyUnless } from "@/lib/api/createHandler";
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

export default createHandler({
  allowedRoles,
  methods: {
    GET: async (req, res, session) => {
      const permissions = deriveAccountPermissions(session.user?.roles || []);
      if (denyUnless(res, permissions.canCreateAccount)) return;

      let attempts = 0;
      while (attempts < MAX_ATTEMPTS) {
        attempts += 1;
        const candidate = formatAccountNumber(randomNumber());
        const { data: existing, error: lookupError } = await supabase
          .from("company_accounts")
          .select("id")
          .eq("account_number", candidate)
          .limit(1);
        if (lookupError) throw lookupError;
        if (!existing || !existing.length) {
          res.status(200).json({ success: true, accountNumber: candidate });
          return;
        }
      }
      res.status(503).json({ success: false, message: "Unable to generate unique account number. Please try again." });
    },
  },
});
