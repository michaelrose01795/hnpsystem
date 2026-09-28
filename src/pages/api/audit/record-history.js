// file location: src/pages/api/audit/record-history.js
//
// GET ?recordType=jobs&recordId=123  → the complete change history of one record
//                                      (who, what changed, before / after, when),
//                                      spanning live and archived audit events.
// GET ?coverage=1                     → audit status of every database table.
//
// Full audit viewers only: a record's history crosses departments and carries
// before / after values, unlike the department-scoped activity list.

import { withRoleGuard } from "@/lib/auth/roleGuard";
import { AUDIT_ADMIN_ROLES } from "@/lib/auth/roles";
import { getAuditCoverage, getRecordAuditHistory } from "@/lib/database/auditActivity";
import { parsePositiveInteger } from "@/lib/audit/api";

const cleanText = (value, max) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    if (req.query.coverage === "1") {
      const coverage = await getAuditCoverage();
      return res.status(200).json({ success: true, data: coverage });
    }
    const recordType = cleanText(req.query.recordType, 100);
    const recordId = cleanText(req.query.recordId, 180);
    if (!recordType || !recordId) {
      return res.status(400).json({
        success: false,
        message: "recordType and recordId are required.",
      });
    }
    const history = await getRecordAuditHistory({
      recordType,
      recordId,
      limit: parsePositiveInteger(req.query.limit) || 500,
    });
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error("/api/audit/record-history error", error);
    return res.status(500).json({ success: false, message: "Unable to load record history." });
  }
}

export default withRoleGuard(handler, { allow: AUDIT_ADMIN_ROLES });
