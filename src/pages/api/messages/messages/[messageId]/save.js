import { markMessageSaved } from "@/lib/database/messages";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const messageId = Number(req.query.messageId);
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid messageId supplied." });
  }

  const { saved = true } = req.body || {};

  try {
    const message = await markMessageSaved({
      messageId,
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
