// file location: src/pages/api/messages/customer-detail.js
import { getCustomerMessageDetail } from "@/lib/database/messages";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { email = "" } = req.query;
    if (!String(email).trim()) {
      return res.status(400).json({ success: false, message: "A customer email is required." });
    }

    const detail = await getCustomerMessageDetail(email);
    return res.status(200).json({ success: true, data: detail });
  } catch (error) {
    console.error("customer-detail error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to load customer details.",
    });
  }
}

export default withRoleGuard(handler);
