// file location: src/pages/api/messages/records/resolve.js
//
//   POST /api/messages/records/resolve
//     body: { references: [{ recordType, query }] }
//     -> { links: [{ recordType, recordId, label, href }], unresolved: [...] }
//
// Turns the records a drafted message references (/job, /reg, /cust, /part,
// /appt, /invoice) into real DMS records before the message is sent, so the
// conversation only ever links to things that exist.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveMessageReferences } from "@/lib/database/messageHub";
import { sendError } from "@/lib/messages/serverActor";

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  try {
    const result = await resolveMessageReferences(req.body?.references || []);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("❌ POST /api/messages/records/resolve error:", error);
    return sendError(res, error, "Failed to look up the linked records.");
  }
}

export default withRoleGuard(handler);
