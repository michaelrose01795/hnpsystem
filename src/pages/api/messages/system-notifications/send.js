import { sendSystemNotification } from "@/lib/notifications/system";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  const { message, metadata = null } = req.body || {};
  if (!message) {
    return res.status(400).json({ success: false, message: "Message content is required." });
  }

  try {
    const notification = await sendSystemNotification({ content: message, metadata });
    return res.status(201).json({ success: true, notification });
  } catch (error) {
    console.error("Failed to send system notification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to send system notification.",
    });
  }
}
