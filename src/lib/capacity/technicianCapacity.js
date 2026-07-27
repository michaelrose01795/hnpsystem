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

export const getJobCapacityDateKey = (job, fallbackDate = "") => {
  const scheduledValue = job?.appointment?.scheduledTime ?? job?.appointment?.scheduled_time;
  if (scheduledValue) return toCapacityDateKey(scheduledValue);
  // Undated work is treated as part of the active queue day. Using check-in
  // time here would wrongly hide carry-over jobs that are still being worked.
  return fallbackDate;
};

const isCompletedTechStatus = (value) => {
  const status = String(value || "").trim().toLowerCase();
  return status === "tech_complete" || status === "complete" || status === "completed";
};

export const getJobCapacityProgress = (job, requestProgressByJobId = {}) => {
  const requestProgress = requestProgressByJobId?.[String(job?.id)] || {};
  let plannedHours = Math.max(0, Number(requestProgress.totalHours) || 0);
  let completedHours = Math.min(
    plannedHours,
    Math.max(0, Number(requestProgress.completedHours) || 0)
  );

  (Array.isArray(job?.vhcChecks) ? job.vhcChecks : []).forEach((check) => {
    const approval = String(check?.approval_status || "").trim().toLowerCase();
    if (!["authorized", "authorised", "completed"].includes(approval)) return;
    const hours = Math.max(0, Number(check?.labour_hours) || 0);
    plannedHours += hours;
    if (check?.labour_complete === true || check?.Complete === true || approval === "completed") {
      completedHours += hours;
    }
  });

  if (plannedHours <= 0) plannedHours = 1;
  if (isCompletedTechStatus(job?.techCompletionStatus)) completedHours = plannedHours;

  return {
    plannedHours: roundHours(plannedHours),
    completedHours: roundHours(Math.min(plannedHours, completedHours)),
    remainingHours: roundHours(Math.max(0, plannedHours - completedHours)),
  };
};

export const getDayCapacityProgress = (jobs = [], requestProgressByJobId = {}) => {
  const totals = jobs.reduce((progress, job) => {
    const jobProgress = getJobCapacityProgress(job, requestProgressByJobId);
    progress.plannedHours += jobProgress.plannedHours;
    progress.completedHours += jobProgress.completedHours;
    return progress;
  }, { plannedHours: 0, completedHours: 0 });

  return {
    plannedHours: roundHours(totals.plannedHours),
    completedHours: roundHours(totals.completedHours),
    remainingHours: roundHours(Math.max(0, totals.plannedHours - totals.completedHours)),
  };
};

export const buildWorkshopCapacitySegments = ({
  capacityHours,
  completedHours,
  remainingPlannedHours,
} = {}) => {
  const capacity = Math.max(0, Number(capacityHours) || 0);
  const completed = Math.max(0, Number(completedHours) || 0);
  const remaining = Math.max(0, Number(remainingPlannedHours) || 0);
  const totalLoad = roundHours(completed + remaining);
  const overloadHours = roundHours(Math.max(0, totalLoad - capacity));

  if (capacity === 0) {
    return {
      capacityHours: 0,
      completedHours: roundHours(completed),
      remainingPlannedHours: roundHours(remaining),
      totalLoadHours: totalLoad,
      overloadHours,
      greenPct: 0,
      amberPct: 0,
      redPct: totalLoad > 0 ? 100 : 0,
      neutralPct: totalLoad > 0 ? 0 : 100,
    };
  }

  const isOverCapacity = totalLoad > capacity;
  const displayTotal = isOverCapacity ? totalLoad : capacity;
  const greenHours = Math.min(completed, capacity);
  const amberHours = Math.min(remaining, Math.max(0, capacity - greenHours));
  const greenPct = (greenHours / displayTotal) * 100;
  const amberPct = (amberHours / displayTotal) * 100;
  const redPct = (overloadHours / displayTotal) * 100;
  const neutralPct = Math.max(0, 100 - greenPct - amberPct - redPct);

  return {
    capacityHours: roundHours(capacity),
    completedHours: roundHours(completed),
    remainingPlannedHours: roundHours(remaining),
    totalLoadHours: totalLoad,
    overloadHours,
    greenPct: roundHours(greenPct),
    amberPct: roundHours(amberPct),
    redPct: roundHours(redPct),
    neutralPct: roundHours(neutralPct),
    capacityMarkerPct: roundHours((capacity / displayTotal) * 100),
  };
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
