import { markMessageSaved } from "@/lib/database/messages";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res, session) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const messageId = String(req.query.messageId || "").trim();
  if (!messageId) {
    return res.status(400).json({ success: false, message: "Invalid messageId supplied." });
  }

  const { saved = true, threadId = null } = req.body || {};

  try {
    const message = await markMessageSaved({
      messageId,
      threadId,
      saved: saved !== false,
    });
    return res.status(200).json({ success: true, data: message });
  } catch (error) {
    console.error("❌ Failed to save message:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Unable to save message." });
  }
}

export default withRoleGuard(handler);
