import { parseLeaveRequestNotes } from "@/lib/hr/leaveRequests";

export const DEFAULT_WEEKLY_TECHNICIAN_HOURS = 30;

const roundHours = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const toCapacityDateKey = (value) => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const getDailyContractedHours = (weeklyHours) => {
  const parsed = Number(weeklyHours);
  const safeWeekly = Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_WEEKLY_TECHNICIAN_HOURS;
  return roundHours(safeWeekly / 5);
};

export const getLeaveHoursForDate = (absence, dateKey, dailyHours) => {
  if (!absence || dateKey < absence.start_date || dateKey > absence.end_date) return 0;
  const { halfDay } = parseLeaveRequestNotes(absence.notes);
  const isHalfDay = halfDay && halfDay !== "None" && dateKey === absence.end_date;
  return roundHours(isHalfDay ? dailyHours / 2 : dailyHours);
};

export const buildTechnicianCapacitySchedule = ({
  users = [],
  absences = [],
  overrides = [],
  dates = [],
} = {}) => {
  const absenceByUser = new Map();
  absences.forEach((absence) => {
    const key = String(absence.user_id);
    absenceByUser.set(key, [...(absenceByUser.get(key) || []), absence]);
  });

  const overrideByCell = new Map(
    overrides.map((entry) => [
      `${entry.capacity_date}:${entry.user_id}`,
      roundHours(entry.available_hours),
    ])
  );

  return dates.map((dateValue) => {
    const date = toCapacityDateKey(dateValue);
    const technicians = users.map((user) => {
      const dailyHours = getDailyContractedHours(user.contracted_hours);
      const leaveHours = Math.min(
        dailyHours,
        (absenceByUser.get(String(user.user_id)) || []).reduce(
          (sum, absence) => sum + getLeaveHoursForDate(absence, date, dailyHours),
          0
        )
      );
      const suggestedHours = roundHours(Math.max(0, dailyHours - leaveHours));
      const cellKey = `${date}:${user.user_id}`;
      const hasOverride = overrideByCell.has(cellKey);
      const overrideHours = hasOverride ? overrideByCell.get(cellKey) : null;
      return {
        userId: user.user_id,
        name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || `Technician ${user.user_id}`,
        role: user.role || "Technician",
        weeklyHours: roundHours(user.contracted_hours || DEFAULT_WEEKLY_TECHNICIAN_HOURS),
        dailyHours,
        leaveHours,
        leaveType: leaveHours > 0
          ? (absenceByUser.get(String(user.user_id)) || []).find(
              (absence) => date >= absence.start_date && date <= absence.end_date
            )?.type || "Leave"
          : null,
        suggestedHours,
        overrideHours,
        effectiveHours: hasOverride ? overrideHours : suggestedHours,
        hasOverride,
      };
    });

    return {
      date,
      technicians,
      totalHours: roundHours(technicians.reduce((sum, technician) => sum + technician.effectiveHours, 0)),
      suggestedTotalHours: roundHours(technicians.reduce((sum, technician) => sum + technician.suggestedHours, 0)),
      availableTechnicians: technicians.filter((technician) => technician.effectiveHours > 0).length,
    };
  });
};
