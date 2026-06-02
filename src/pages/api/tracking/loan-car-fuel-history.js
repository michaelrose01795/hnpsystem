// file location: src/pages/api/tracking/loan-car-fuel-history.js
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { recordLoanCarFuelHistorySnapshot } from "@/lib/database/tracking";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const {
    loanCarId,
    reg,
    fuelLevel,
    mileage,
  } = req.body || {};

  if (!loanCarId) {
    return res.status(400).json({ success: false, message: "loanCarId is required" });
  }

  const result = await recordLoanCarFuelHistorySnapshot({
    loanCarId,
    reg,
    fuelLevel,
    mileage,
  });

  if (!result.success) {
    return res.status(500).json({
      success: false,
      message: result.error?.message || "Failed to save loan car fuel history.",
    });
  }

  return res.status(200).json({ success: true, skipped: result.skipped || false });
}

export default withRoleGuard(handler);
