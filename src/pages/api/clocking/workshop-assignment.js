import {
  hasAnyRole,
  TECHNICIAN_ROLES,
  WORKSHOP_CAPACITY_MANAGER_ROLES,
  WORKSHOP_CAPACITY_VIEW_ROLES,
} from "@/lib/auth/roles";
import { withRoleGuard } from "@/lib/auth/roleGuard";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import { isWorkshopAssignmentType } from "@/lib/clocking/workshopAssignments";
import { getUserById } from "@/lib/database/users";
import {
  getWorkshopDailyAssignments,
  saveWorkshopDailyAssignment,
} from "@/lib/database/workshopAssignments";
import { getAuditContext } from "@/lib/audit/auditContext";
import { writeAuditLog } from "@/lib/audit/auditLog";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateKey = (value) => {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === value;
};

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const assignmentDate = String(req.query?.date || "").trim();
      if (!isValidDateKey(assignmentDate)) {
        return res.status(400).json({ success: false, message: "A valid assignment date is required." });
      }
      const assignments = await getWorkshopDailyAssignments({ assignmentDate });
      return res.status(200).json({ success: true, data: assignments });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }

    if (!hasAnyRole(session?.user?.roles || [], WORKSHOP_CAPACITY_MANAGER_ROLES)) {
      return res.status(403).json({ success: false, message: "Only service and workshop managers can change workshop assignments." });
    }

    const userId = Number(req.body?.userId);
    const assignmentDate = String(req.body?.assignmentDate || "").trim();
    const assignmentType = String(req.body?.assignmentType || "").trim().toLowerCase();
    if (!Number.isInteger(userId) || userId <= 0 || !isValidDateKey(assignmentDate) || !isWorkshopAssignmentType(assignmentType)) {
      return res.status(400).json({ success: false, message: "A valid technician, date and workshop section are required." });
    }

    const targetUser = await getUserById(userId);
    if (!targetUser || !hasAnyRole([targetUser.role], TECHNICIAN_ROLES)) {
      return res.status(404).json({ success: false, message: "The selected technician could not be found." });
    }

    const actorUserId = await resolveSessionUserId(session).catch(() => null);
    const result = await saveWorkshopDailyAssignment({ userId, assignmentDate, assignmentType, actorUserId });
    const auditContext = await getAuditContext(req, res);
    await writeAuditLog({
      ...auditContext,
      action: "workshop_daily_assignment_updated",
      entityType: "workshop_daily_assignment",
      entityId: `${assignmentDate}:${userId}`,
      beforeData: { assignment_type: result.previous?.assignment_type || null },
      afterData: { assignment_type: result.assignment.assignment_type, assignment_date: assignmentDate, user_id: userId },
    });

    return res.status(200).json({ success: true, data: result.assignment });
  } catch (error) {
    console.error("/api/clocking/workshop-assignment error", error);
    return res.status(500).json({ success: false, message: "Unable to update the workshop assignment." });
  }
}

export default withRoleGuard(handler, { allow: WORKSHOP_CAPACITY_VIEW_ROLES });
