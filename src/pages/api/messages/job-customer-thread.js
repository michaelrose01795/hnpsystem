// file location: src/pages/api/messages/job-customer-thread.js
import { ensureJobCustomerThread } from "@/lib/database/messages";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      jobId = null,
      jobNumber = "",
      actorId,
      customerEmail = "",
      customerName = "",
    } = req.body || {};

    const result = await ensureJobCustomerThread({
      jobId,
      jobNumber,
      actorId,
      customerEmail,
      customerName,
    });

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = /missing an email|job number|signed-in/i.test(error.message || "")
      ? 400
      : 500;
    console.error("job-customer-thread error:", error);
    return res.status(status).json({
      success: false,
      message: error.message || "Unable to load the customer conversation.",
    });
  }
}

export default withRoleGuard(handler);
