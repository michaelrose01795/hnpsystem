// file location: src/pages/api/messages/website-help-queue.js
//
// Staff side of the website help chat.
//   GET   customers waiting for a person, oldest first
//   POST  { chatId }  join a waiting chat: the signed-in staff member is added to
//         the chat's message thread, which then shows in their /messages list
//
// Gated like the Bookings feed on /messages (customer booking request roles).

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { hasCustomerBookingRequestAccess } from "@/lib/auth/serviceActionRoles";
import { joinHelpChat, listQueuedHelpChats } from "@/lib/database/websiteHelpChat";

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const data = await listQueuedHelpChats();
      return res.status(200).json({ success: true, data });
    }

    if (req.method === "POST") {
      const staffUserId = Number(session?.user?.id);
      if (!Number.isFinite(staffUserId) || staffUserId <= 0) {
        return res.status(400).json({ success: false, message: "Sign in with a staff account to join a chat." });
      }
      const chat = await joinHelpChat({ chatId: req.body?.chatId, staffUserId });
      return res.status(200).json({ success: true, threadId: chat.thread_id });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("/api/messages/website-help-queue:", error?.message || error);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? "Could not load the website chat queue." : error.message,
    });
  }
}

export default withRoleGuard(handler, {
  authorize: (roles) => hasCustomerBookingRequestAccess(roles),
});
