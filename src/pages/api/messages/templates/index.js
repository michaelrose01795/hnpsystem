// file location: src/pages/api/messages/templates/index.js
// Customer-facing quick message templates used by the job-card Contact tab.
//   GET  -> list active templates (merged with seeded defaults)
//   POST -> upsert a single template { templateKey, title, body, updatedBy }
// Mirrors the auth/handler pattern of api/messages/job-customer-thread.js: a thin
// handler wrapped in withRoleGuard, with all DB access kept in the helper.
import { getActiveTemplates, upsertTemplate } from "@/lib/database/messageTemplates";
import { withRoleGuard } from "@/lib/auth/roleGuard";

async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const templates = await getActiveTemplates();
      return res.status(200).json({ success: true, templates });
    }

    if (req.method === "POST") {
      const { templateKey = "", title = "", body = "", updatedBy = null } = req.body || {};
      const template = await upsertTemplate({ templateKey, title, body, updatedBy });
      return res.status(200).json({ success: true, template });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    const message = error?.message || "Unable to process message templates.";
    const status = /required|blocked by RLS/i.test(message) ? 400 : 500;
    console.error("message-templates error:", error);
    return res.status(status).json({ success: false, message });
  }
}

export default withRoleGuard(handler);
