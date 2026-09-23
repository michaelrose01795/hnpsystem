// file location: src/pages/api/tracking/loan-cars/lookup.js
//
// GET ?q=… — DMS records for the Quick add / New loan booking search: jobs by
// number, registration or customer, and customers by name, phone or email.
// Picking one fills the booking from the existing record.

export const runtime = "nodejs";

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { LOAN_CAR_ROLES } from "@/features/loanCars/loanCarAccess";
import { searchLoanCarLookup } from "@/lib/database/loanCars";
import { methodNotAllowed, requireCapability, sendServerError } from "@/lib/loanCars/loanCarApi";

async function handler(req, res, session) {
  if (req.method !== "GET") {
    methodNotAllowed(res, "GET");
    return;
  }
  if (!requireCapability(res, session, "book")) return;

  const term = String(req.query.q || "").trim().slice(0, 60);
  if (term.length < 2) {
    res.status(200).json({ success: true, data: { results: [] } });
    return;
  }

  try {
    const results = await searchLoanCarLookup(term);
    res.status(200).json({ success: true, data: { results } });
  } catch (error) {
    sendServerError(res, error, "Unable to search DMS records");
  }
}

export default withRoleGuard(handler, { allow: LOAN_CAR_ROLES });
