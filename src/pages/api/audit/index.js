import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  AUDIT_ADMIN_ROLES,
  AUDIT_VIEW_ROLES,
  hasAnyRole,
} from "@/lib/auth/roles";
import {
  listAuditEvents,
  listAuditFilterOptions,
} from "@/lib/database/auditActivity";
import {
  auditEventsToCsv,
  parsePositiveInteger,
  resolveSessionActor,
} from "@/lib/audit/api";

const cleanText = (value, max = 100) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

const buildFilters = (query = {}) => ({
  userId: parsePositiveInteger(query.userId),
  role: cleanText(query.role),
  department: cleanText(query.department),
  sessionId: cleanText(query.sessionId),
  device: cleanText(query.device),
  browser: cleanText(query.browser),
  page: cleanText(query.page),
  actionCategory: cleanText(query.actionCategory),
  recordType: cleanText(query.recordType),
  recordId: cleanText(query.recordId),
  outcome: cleanText(query.outcome),
  search: cleanText(query.search),
  from: cleanText(query.from),
  to: cleanText(query.to),
  pageNumber: parsePositiveInteger(query.pageNumber) || 1,
  pageSize: parsePositiveInteger(query.pageSize) || 25,
});

async function handler(req, res, session) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    const isFullViewer = hasAnyRole(session?.user?.roles || [], AUDIT_ADMIN_ROLES);
    const actor = isFullViewer ? null : await resolveSessionActor(session);
    if (!isFullViewer && !actor?.department) {
      return res.status(403).json({
        success: false,
        message: "A department assignment is required for manager-scoped activity access.",
      });
    }
    const scopedDepartment = isFullViewer ? null : actor.department;
    if (req.query.options === "1") {
      const options = await listAuditFilterOptions({ department: scopedDepartment });
      return res.status(200).json({ success: true, data: options });
    }
    const filters = buildFilters(req.query);
    if (scopedDepartment) filters.department = scopedDepartment;
    if (req.query.format === "csv") {
      const rows = [];
      for (let exportPage = 1; exportPage <= 10; exportPage += 1) {
        const pageResult = await listAuditEvents({
          ...filters,
          pageNumber: exportPage,
          pageSize: 1000,
        });
        rows.push(...pageResult.rows);
        if (rows.length >= pageResult.total || pageResult.rows.length < 1000) break;
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="dms-activity-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return res.status(200).send(`\uFEFF${auditEventsToCsv(rows)}`);
    }
    const result = await listAuditEvents(filters);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("/api/audit error", error);
    return res.status(500).json({ success: false, message: "Unable to load activity data." });
  }
}

export default withRoleGuard(handler, { allow: AUDIT_VIEW_ROLES });
