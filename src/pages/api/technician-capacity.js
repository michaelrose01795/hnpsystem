import { withRoleGuard } from "@/lib/auth/roleGuard";
import {
  hasAnyRole,
  WORKSHOP_CAPACITY_MANAGER_ROLES,
  WORKSHOP_CAPACITY_VIEW_ROLES,
} from "@/lib/auth/roles";
import { resolveSessionUserId } from "@/lib/auth/sessionUserResolver";
import {
  getTechnicianCapacitySchedule,
  saveTechnicianCapacityOverrides,
} from "@/lib/database/technicianCapacity";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 62;

const isValidDateKey = (value) => {
  if (!DATE_PATTERN.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` === value;
};

const buildDates = (startDate, endDate) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length <= MAX_RANGE_DAYS) {
    if (cursor.getDay() !== 0) {
      const pad = (value) => String(value).padStart(2, "0");
      dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates.length > MAX_RANGE_DAYS ? null : dates;
};

const isValidCell = (entry, includeHours = true) => {
  const userId = Number(entry?.userId);
  const hours = Number(entry?.availableHours);
  return Number.isInteger(userId) && userId > 0 && isValidDateKey(entry?.date) &&
    (!includeHours || (Number.isFinite(hours) && hours >= 0 && hours <= 24));
};

async function handler(req, res, session) {
  try {
    if (req.method === "GET") {
      const { start, end } = req.query;
      if (!isValidDateKey(start) || !isValidDateKey(end)) {
        return res.status(400).json({ success: false, message: "A valid start and end date are required." });
      }
      const dates = buildDates(start, end);
      if (!dates) {
        return res.status(400).json({ success: false, message: "The capacity range must be 62 days or fewer." });
      }
      const schedule = await getTechnicianCapacitySchedule({ startDate: start, endDate: end, dates });
      return res.status(200).json({ success: true, data: schedule });
    }

    if (req.method === "POST") {
      if (!hasAnyRole(session?.user?.roles || [], WORKSHOP_CAPACITY_MANAGER_ROLES)) {
        return res.status(403).json({ success: false, message: "Only service and workshop managers can change capacity." });
      }
      const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const resets = Array.isArray(req.body?.resets) ? req.body.resets : [];
      if (changes.length + resets.length > 500 || !changes.every((entry) => isValidCell(entry)) || !resets.every((entry) => isValidCell(entry, false))) {
        return res.status(400).json({ success: false, message: "The submitted capacity changes are invalid." });
      }
      const actorUserId = await resolveSessionUserId(session).catch(() => null);
      await saveTechnicianCapacityOverrides({ changes, resets, actorUserId });
      return res.status(200).json({ success: true });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("/api/technician-capacity error", error);
    return res.status(500).json({ success: false, message: "Unable to update technician capacity." });
  }
}

export default withRoleGuard(handler, { allow: WORKSHOP_CAPACITY_VIEW_ROLES });
