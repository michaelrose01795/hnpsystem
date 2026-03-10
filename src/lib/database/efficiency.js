// file location: src/lib/database/efficiency.js
import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();

const TECH_NAMES = ["Glen", "Jake", "Scott", "Paul", "Cheryl", "Michael"];

const DEFAULT_TARGET_HOURS = 160;
const DEFAULT_WEIGHT = 1.0;
const MICHAEL_WEIGHT = 1.0;
const ENTRY_META_PREFIX = "__HNP_JOB_META__:";

const normalizeHourValue = (value, { allowNull = false } = {}) => {
  if (value === null || value === undefined || value === "") {
    return allowNull ? null : 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return allowNull ? null : 0;
  }
  return Number(parsed.toFixed(2));
};

const parseOptionalNumber = (value) => {
  return normalizeHourValue(value, { allowNull: true });
};

const parseEntryMetaFromNotes = (storedNotes) => {
  if (typeof storedNotes !== "string" || !storedNotes.trim()) {
    return { notes: "", jobDescription: "", allocatedHours: null };
  }
  if (!storedNotes.startsWith(ENTRY_META_PREFIX)) {
    return { notes: storedNotes, jobDescription: "", allocatedHours: null };
  }
  try {
    const parsed = JSON.parse(storedNotes.slice(ENTRY_META_PREFIX.length));
    return {
      notes: typeof parsed?.notes === "string" ? parsed.notes : "",
      jobDescription:
        typeof parsed?.jobDescription === "string" ? parsed.jobDescription : "",
      allocatedHours: parseOptionalNumber(parsed?.allocatedHours),
    };
  } catch (_error) {
    return { notes: storedNotes, jobDescription: "", allocatedHours: null };
  }
};

const serializeEntryNotes = ({ notes, jobDescription, allocatedHours }) => {
  const cleanNotes = typeof notes === "string" ? notes.trim() : "";
  const cleanDescription = typeof jobDescription === "string" ? jobDescription.trim() : "";
  const cleanAllocated = normalizeHourValue(allocatedHours, { allowNull: true });
  const hasMeta = cleanDescription || cleanAllocated !== null;

  if (!hasMeta) {
    return cleanNotes || null;
  }

  return `${ENTRY_META_PREFIX}${JSON.stringify({
    notes: cleanNotes,
    jobDescription: cleanDescription,
    allocatedHours: cleanAllocated,
  })}`;
};

const normalizeEfficiencyEntry = (row = {}) => {
  const parsedMeta = parseEntryMetaFromNotes(row.notes);
  return {
    ...row,
    notes: parsedMeta.notes,
    job_description:
      typeof row.job_description === "string" && row.job_description.trim()
        ? row.job_description
        : parsedMeta.jobDescription,
    allocated_hours:
      row.allocated_hours !== undefined && row.allocated_hours !== null
        ? normalizeHourValue(row.allocated_hours)
        : parsedMeta.allocatedHours,
    hours_spent: normalizeHourValue(row.hours_spent),
  };
};

/**
 * Fetch the list of technicians matching the efficiency roster.
 * Returns users whose first_name matches one of the TECH_NAMES.
 */
export async function getEfficiencyTechnicians() {
  const { data, error } = await db
    .from("users")
    .select("user_id, first_name, last_name, role, contracted_hours")
    .in("first_name", TECH_NAMES);

  if (error) throw error;

  // Sort by the predefined order
  const ordered = TECH_NAMES.map((name) =>
    (data || []).find(
      (u) => u.first_name.toLowerCase() === name.toLowerCase()
    )
  ).filter(Boolean);

  return ordered;
}

/**
 * Fetch efficiency entries for a specific technician and month.
 */
export async function getEfficiencyEntries(userId, year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await db
    .from("tech_efficiency_entries")
    .select("*")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeEfficiencyEntry);
}

/**
 * Fetch efficiency entries for ALL technicians for a given month.
 */
export async function getAllEfficiencyEntries(userIds, year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await db
    .from("tech_efficiency_entries")
    .select("*")
    .in("user_id", userIds)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) throw error;
  return (data || []).map(normalizeEfficiencyEntry);
}

/**
 * Insert a new efficiency entry.
 */
export async function addEfficiencyEntry({
  userId,
  date,
  jobNumber,
  hoursSpent,
  notes,
  dayType,
  jobDescription,
  allocatedHours,
}) {
  const storedNotes = serializeEntryNotes({ notes, jobDescription, allocatedHours });
  const normalizedAllocatedHours = normalizeHourValue(allocatedHours, { allowNull: true });
  const normalizedHoursSpent = normalizeHourValue(hoursSpent);
  const { data, error } = await db
    .from("tech_efficiency_entries")
    .insert([
      {
        user_id: userId,
        date,
        job_number: jobNumber,
        job_description: jobDescription || null,
        allocated_hours: normalizedAllocatedHours,
        hours_spent: normalizedHoursSpent,
        notes: storedNotes,
        day_type: dayType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return normalizeEfficiencyEntry(data);
}

/**
 * Update an existing efficiency entry.
 */
export async function updateEfficiencyEntry(
  entryId,
  { date, jobNumber, hoursSpent, notes, dayType, jobDescription, allocatedHours }
) {
  const storedNotes = serializeEntryNotes({ notes, jobDescription, allocatedHours });
  const normalizedAllocatedHours = normalizeHourValue(allocatedHours, { allowNull: true });
  const normalizedHoursSpent = normalizeHourValue(hoursSpent);
  const { data, error } = await db
    .from("tech_efficiency_entries")
    .update({
      date,
      job_number: jobNumber,
      job_description: jobDescription || null,
      allocated_hours: normalizedAllocatedHours,
      hours_spent: normalizedHoursSpent,
      notes: storedNotes,
      day_type: dayType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  return normalizeEfficiencyEntry(data);
}

/**
 * Delete an efficiency entry.
 */
export async function deleteEfficiencyEntry(entryId) {
  const { error } = await db
    .from("tech_efficiency_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw error;
}

/**
 * Fetch targets for a specific technician.
 * Falls back to defaults if no row exists.
 */
export async function getTechTarget(userId) {
  const { data, error } = await db
    .from("tech_efficiency_targets")
    .select("monthly_target_hours, weight")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (data) {
    return {
      monthlyTargetHours: Number(data.monthly_target_hours),
      weight: Number(data.weight),
    };
  }

  // Fallback defaults
  return {
    monthlyTargetHours: DEFAULT_TARGET_HOURS,
    weight: DEFAULT_WEIGHT,
  };
}

/**
 * Fetch targets for all technicians in batch.
 * Returns a Map of userId -> { monthlyTargetHours, weight }.
 */
export async function getAllTechTargets(userIds) {
  const [{ data, error }, { data: usersData, error: usersError }] = await Promise.all([
    db
    .from("tech_efficiency_targets")
    .select("user_id, monthly_target_hours, weight")
    .in("user_id", userIds),
    db
      .from("users")
      .select("user_id, contracted_hours")
      .in("user_id", userIds),
  ]);

  if (error) throw error;
  if (usersError) throw usersError;

  const map = new Map();
  const contractedHoursMap = new Map(
    (usersData || []).map((row) => [row.user_id, Number(row.contracted_hours ?? 40)])
  );
  (data || []).forEach((row) => {
    map.set(row.user_id, {
      monthlyTargetHours: Number(row.monthly_target_hours),
      weight: Number(row.weight),
      weeklyContractedHours: contractedHoursMap.get(row.user_id) ?? 40,
    });
  });

  // Fill in defaults for any tech not in the table
  userIds.forEach((uid) => {
    if (!map.has(uid)) {
      map.set(uid, {
        monthlyTargetHours: DEFAULT_TARGET_HOURS,
        weight: DEFAULT_WEIGHT,
        weeklyContractedHours: contractedHoursMap.get(uid) ?? 40,
      });
    }
  });

  return map;
}

/**
 * Upsert a technician's target hours and weight.
 */
export async function upsertTechTarget(userId, { monthlyTargetHours, weight }) {
  const { data: existing } = await db
    .from("tech_efficiency_targets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await db
      .from("tech_efficiency_targets")
      .update({
        monthly_target_hours: monthlyTargetHours,
        weight,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await db
      .from("tech_efficiency_targets")
      .insert([{
        user_id: userId,
        monthly_target_hours: monthlyTargetHours,
        weight,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
    if (error) throw error;
  }
}

/**
 * Fetch completed job_clocking entries for the given technicians and month.
 * Transforms them into the same shape as tech_efficiency_entries so they
 * can be merged seamlessly in the UI.
 */
export async function getJobClockingAsEfficiency(userIds, year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const startISO = `${startDate}T00:00:00.000Z`;
  const endISO = `${endDate}T00:00:00.000Z`;

  const { data, error } = await db
    .from("job_clocking")
    .select("id, user_id, job_number, clock_in, clock_out, work_type, created_at")
    .in("user_id", userIds)
    .not("clock_out", "is", null)
    .gte("clock_in", startISO)
    .lt("clock_in", endISO)
    .order("clock_in", { ascending: true });

  if (error) {
    console.error("Failed to fetch job_clocking for efficiency:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const clockIn = new Date(row.clock_in);
    const clockOut = new Date(row.clock_out);
    const diffMs = clockOut - clockIn;
    const hours = diffMs > 0 ? Number((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;
    const dayOfWeek = clockIn.getDay();
    const dayType = dayOfWeek === 6 ? "saturday" : "weekday";
    const dateStr = clockIn.toISOString().split("T")[0];

    return {
      id: `jc_${row.id}`,
      user_id: row.user_id,
      date: dateStr,
      job_number: row.job_number || "",
      job_description: "",
      allocated_hours: null,
      hours_spent: hours,
      notes: "Auto-logged from job clocking",
      day_type: dayType,
      created_at: row.created_at,
      updated_at: row.clock_out,
      _source: "job_clocking",
    };
  });
}

export async function getOvertimeAsEfficiency(userIds, year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

  const { data, error } = await db
    .from("overtime_sessions")
    .select("session_id, user_id, date, total_hours, notes, created_at, updated_at")
    .in("user_id", userIds)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    console.error("Failed to fetch overtime_sessions for efficiency:", error.message);
    return [];
  }

  return (data || []).map((row) => {
    const overtimeDate = new Date(`${row.date}T00:00:00`);
    const dayType = overtimeDate.getDay() === 6 ? "saturday" : "weekday";
    return {
      id: `ot_${row.session_id}`,
      user_id: row.user_id,
      date: row.date,
      job_number: "OVERTIME",
      job_description: "Profile overtime",
      allocated_hours: null,
      hours_spent: normalizeHourValue(row.total_hours),
      notes: row.notes || "Overtime from profile",
      day_type: dayType,
      created_at: row.created_at,
      updated_at: row.updated_at,
      _source: "overtime_sessions",
    };
  });
}

/**
 * Calculate totals for a single technician.
 */
const getTargetHoursForWindow = (monthlyTargetHours, options = {}) => {
  const {
    year,
    month,
    period = "month",
    anchorDate = null,
    referenceDate = new Date(),
    weeklyContractedHours = null,
  } = options;
  if (!year || !month) {
    return Number(monthlyTargetHours || 0);
  }

  const normalizedMonthlyTarget = Number(monthlyTargetHours || 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const isFutureMonth = year > currentYear || (year === currentYear && month > currentMonth);
  const isCurrentMonth = year === currentYear && month === currentMonth;
  const dailyContractedHours =
    weeklyContractedHours !== null && weeklyContractedHours !== undefined
      ? Number(weeklyContractedHours || 0) / 5
      : null;
  const targetPerDay = daysInMonth > 0 ? normalizedMonthlyTarget / daysInMonth : 0;
  const targetForEligibleDays = (eligibleDays) =>
    dailyContractedHours !== null
      ? Number((dailyContractedHours * eligibleDays).toFixed(2))
      : Number((targetPerDay * eligibleDays).toFixed(2));

  if (isFutureMonth) {
    return 0;
  }

  if (period === "day") {
    if (!(anchorDate instanceof Date) || Number.isNaN(anchorDate.getTime())) {
      return targetForEligibleDays(1);
    }
    const isFutureDay = anchorDate > referenceDate;
    if (isFutureDay) return 0;
    const dayOfWeek = anchorDate.getDay();
    if (dailyContractedHours !== null && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return 0;
    }
    return targetForEligibleDays(1);
  }

  if (period === "week") {
    if (!(anchorDate instanceof Date) || Number.isNaN(anchorDate.getTime())) {
      return targetForEligibleDays(5);
    }
    const weekStart = new Date(anchorDate);
    const weekday = weekStart.getDay();
    const offset = weekday === 0 ? -6 : 1 - weekday;
    weekStart.setDate(weekStart.getDate() + offset);
    weekStart.setHours(0, 0, 0, 0);

    let eligibleDays = 0;
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      if (day.getFullYear() !== year || day.getMonth() + 1 !== month) continue;
      if (isCurrentMonth && day > referenceDate) continue;
      if (dailyContractedHours !== null && (day.getDay() === 0 || day.getDay() === 6)) continue;
      eligibleDays += 1;
    }
    return targetForEligibleDays(eligibleDays);
  }

  const lastEligibleDate = isCurrentMonth
    ? referenceDate.getDate()
    : daysInMonth;
  let eligibleDays = 0;
  for (let dayNumber = 1; dayNumber <= lastEligibleDate; dayNumber += 1) {
    const day = new Date(year, month - 1, dayNumber);
    if (dailyContractedHours !== null && (day.getDay() === 0 || day.getDay() === 6)) continue;
    eligibleDays += 1;
  }
  return targetForEligibleDays(eligibleDays);
};

export function calculateTechTotals(entries, target, options = {}) {
  const actualHours = entries.reduce((sum, e) => sum + Number(e.hours_spent || 0), 0);
  const allocatedHours = entries.reduce((sum, e) => sum + Number(e.allocated_hours || 0), 0);
  const targetHours = getTargetHoursForWindow(target.monthlyTargetHours, options);
  const difference = actualHours - targetHours;
  const efficiencyPct = actualHours > 0 ? (allocatedHours / actualHours) * 100 : 0;

  return {
    actualHours: Math.round(actualHours * 100) / 100,
    allocatedHours: Math.round(allocatedHours * 100) / 100,
    targetHours,
    difference: Math.round(difference * 100) / 100,
    efficiencyPct: Math.round(efficiencyPct * 10) / 10,
  };
}

/**
 * Calculate weighted overall totals across all technicians.
 */
export function calculateOverallTotals(techSummaries) {
  let weightedActual = 0;
  let weightedTarget = 0;
  let totalActual = 0;
  let totalAllocated = 0;

  techSummaries.forEach(({ totals, weight }) => {
    weightedActual += totals.actualHours * weight;
    weightedTarget += totals.targetHours * weight;
    totalActual += totals.actualHours;
    totalAllocated += totals.allocatedHours || 0;
  });

  const difference = Math.round((weightedActual - weightedTarget) * 100) / 100;
  const efficiencyPct =
    totalActual > 0
      ? Math.round(((totalAllocated / totalActual) * 100) * 10) / 10
      : 0;

  return {
    weightedActual: Math.round(weightedActual * 100) / 100,
    weightedTarget: Math.round(weightedTarget * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    difference,
    efficiencyPct,
  };
}

export { TECH_NAMES, DEFAULT_TARGET_HOURS, DEFAULT_WEIGHT, MICHAEL_WEIGHT };
