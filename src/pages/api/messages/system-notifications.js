// file location: src/pages/api/messages/system-notifications.js
import { sendThreadMessage } from "@/lib/database/messages";

const SYSTEM_THREAD_ID = Number(process.env.SYSTEM_MESSAGE_THREAD_ID);
const SYSTEM_SENDER_ID = Number(process.env.SYSTEM_MESSAGE_SENDER_ID);

const formatEstimatedQtyText = (quantity) => {
  if (quantity === null || quantity === undefined || Number.isNaN(Number(quantity))) {
    return "Estimate unavailable";
  }
  const numeric = Math.round(Number(quantity));
  return `${numeric.toLocaleString()} box${numeric === 1 ? "" : "es"}`;
};

const formatStatusMessage = ({ name, status, nextEstimatedOrderDate, estimatedQuantity }) => {
  const nextDateLabel = nextEstimatedOrderDate
    ? new Date(nextEstimatedOrderDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Next order TBD";

  return `System Alert: "${name}" is marked ${status}. Next order ${nextDateLabel}. ${formatEstimatedQtyText(
    estimatedQuantity
  )}.`;
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }

  if (!SYSTEM_THREAD_ID || !SYSTEM_SENDER_ID) {
    console.error(
      "SYSTEM_MESSAGE_THREAD_ID or SYSTEM_MESSAGE_SENDER_ID is not configured."
    );
    return res.status(500).json({
      success: false,
      message:
        "System message thread is not configured. Please set SYSTEM_MESSAGE_THREAD_ID and SYSTEM_MESSAGE_SENDER_ID.",
    });
  }

  const { consumableId, name, status, nextEstimatedOrderDate, estimatedQuantity } =
    req.body || {};

  if (!consumableId || !name || !status) {
    return res.status(400).json({
      success: false,
      message: "consumableId, name, and status are required.",
    });
  }

  const content = formatStatusMessage({
    name,
    status,
    nextEstimatedOrderDate,
    estimatedQuantity,
  });

  try {
    const message = await sendThreadMessage({
      threadId: SYSTEM_THREAD_ID,
      senderId: SYSTEM_SENDER_ID,
      content,
    });
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("❌ Failed to send system notification:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Unable to send notification." });
  }
}
