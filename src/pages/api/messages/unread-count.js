// file location: src/pages/api/messages/unread-count.js
//
// Lightweight unread-thread count for the sidebar message badge.
//
// The badge previously called GET /api/messages/threads, which returns every
// thread with all participants (each joined to `users`), the latest message and
// its sender — then discarded all of it except a count. This route runs the same
// unread rule over one column instead (see getUnreadThreadCountForUser).
//
// Same guard as /api/messages/threads so role access is unchanged.
import { getUnreadThreadCountForUser } from "@/lib/database/messages";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const userId = Number(req.query.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "userId query parameter is required.",
    });
  }

  try {
    const unreadCount = await getUnreadThreadCountForUser(userId);
    return res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    console.error("❌ GET /api/messages/unread-count error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
}

export default withRoleGuard(handler);
