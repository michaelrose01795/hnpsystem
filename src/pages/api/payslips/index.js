// file location: src/pages/api/payslips/index.js
// User-facing payslip endpoint. Lists the signed-in user's own payslips and
// requires the personal-passcode unlock cookie set by /api/personal/security.
// Admin reads/writes happen through /api/payslips/admin and /api/payslips/[id].

import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  buildPersonalApiError,
  requirePersonalAccess,
} from "@/lib/profile/personalServer";
import { listPayslipsForUser } from "@/lib/database/payslips";

async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"]);
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { userId } = await requirePersonalAccess(req, res);
    const limit = Math.max(1, Math.min(500, Number.parseInt(req.query.limit, 10) || 200));
    const payslips = await listPayslipsForUser(userId, { limit });
    return res.status(200).json({ success: true, data: payslips });
  } catch (error) {
    return buildPersonalApiError(res, error, "Failed to load payslips.");
  }
}

export default withRoleGuard(handler);
