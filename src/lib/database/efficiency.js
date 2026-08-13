// file location: src/lib/database/efficiency.js
import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();

const TECH_ROLES = ["Techs", "MOT Tester"];

const DEFAULT_TARGET_HOURS = 160;
// Matches tech_efficiency_targets.weight in schemaReference.sql.
const DEFAULT_WEIGHT = 0.75;
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
  } catch {
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
 * Fetch the list of technicians for the efficiency roster.
 * Queries by role so results remain correct if names change.
 */
export async function getEfficiencyTechnicians() {
  const { data, error } = await db
    .from("users")
    .select("user_id, first_name, last_name, role, contracted_hours")
    .in("role", TECH_ROLES)
    .eq("is_active", true)
    .order("first_name", { ascending: true });

  if (error) throw error;

  return data || [];
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
    .select("id, user_id, job_id, job_number, request_id, clock_in, clock_out, work_type, created_at")
    .in("user_id", userIds)
    .not("clock_out", "is", null)
    .gte("clock_in", startISO)
    .lt("clock_in", endISO)
    .order("clock_in", { ascending: true });

  if (error) {
    console.error("Failed to fetch job_clocking for efficiency:", error.message);
    return [];
  }

  const clockingRows = data || [];
  const jobIds = [...new Set(clockingRows.map((row) => Number(row.job_id)).filter(Number.isFinite))];
  const [{ data: jobsData, error: jobsError }, { data: requestsData, error: requestsError }] =
    await Promise.all([
      jobIds.length
        ? db
            .from("jobs")
            .select("id, job_number, description, job_categories")
            .in("id", jobIds)
        : Promise.resolve({ data: [], error: null }),
      jobIds.length
        ? db
            .from("job_requests")
            .select("request_id, job_id, description, hours, job_type, request_source, sort_order")
            .in("job_id", jobIds)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (jobsError) console.warn("Failed to enrich efficiency jobs:", jobsError.message);
  if (requestsError) console.warn("Failed to enrich efficiency requests:", requestsError.message);

  const jobsById = new Map((jobsData || []).map((job) => [Number(job.id), job]));
  const requestsById = new Map(
    (requestsData || []).map((request) => [Number(request.request_id), request])
  );
  const requestsByJob = new Map();
  (requestsData || []).forEach((request) => {
    const jobId = Number(request.job_id);
    if (!requestsByJob.has(jobId)) requestsByJob.set(jobId, []);
    requestsByJob.get(jobId).push(request);
  });

  return clockingRows.map((row) => {
    const clockIn = new Date(row.clock_in);
    const clockOut = new Date(row.clock_out);
    const diffMs = clockOut - clockIn;
    const hours = diffMs > 0 ? Number((diffMs / (1000 * 60 * 60)).toFixed(2)) : 0;
    const dayOfWeek = clockIn.getDay();
    const dayType = dayOfWeek === 6 ? "saturday" : "weekday";
    const dateStr = clockIn.toISOString().split("T")[0];
    const job = jobsById.get(Number(row.job_id));
    const request = requestsById.get(Number(row.request_id));
    const jobRequests = requestsByJob.get(Number(row.job_id)) || [];
    const jobAllocation = jobRequests.reduce(
      (sum, item) => sum + Number(item.hours || 0),
      0
    );
    const allocatedHours = request?.hours ?? (jobAllocation > 0 ? jobAllocation : null);
    const allocationKey = request?.request_id
      ? `request:${request.request_id}`
      : `job:${row.job_id}`;

    return {
      id: `jc_${row.id}`,
      user_id: row.user_id,
      date: dateStr,
      job_number: row.job_number || "",
      job_description: request?.description || job?.description || "",
      allocated_hours: normalizeHourValue(allocatedHours, { allowNull: true }),
      hours_spent: hours,
      notes: "Auto-logged from job clocking",
      day_type: dayType,
      created_at: row.created_at,
      updated_at: row.clock_out,
      _source: "job_clocking",
      _allocation_key: allocationKey,
      _clock_in: row.clock_in,
      _clock_out: row.clock_out,
      _job_id: row.job_id,
      _request_id: row.request_id,
      _category: request?.job_type || request?.request_source || row.work_type,
      _categories: Array.isArray(job?.job_categories) ? job.job_categories : [],
    };
  });
}

/**
 * Fetch raw job clockings for non-destructive quality checks. Open records are
 * intentionally included here but excluded from productive-hour totals.
 */
export async function getJobClockingQualityRecords(userIds, year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00.000Z`;

  const { data, error } = await db
    .from("job_clocking")
    .select("id, user_id, job_id, job_number, request_id, clock_in, clock_out, work_type, created_at, updated_at")
    .in("user_id", userIds)
    .gte("clock_in", startDate)
    .lt("clock_in", endDate)
    .order("clock_in", { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Reuse the existing jobs and job_requests sources for the manual-entry lookup. */
export async function lookupEfficiencyJob(jobNumber) {
  const trimmed = String(jobNumber || "").trim();
  if (!trimmed) return null;

  const { data: job, error: jobError } = await db
    .from("jobs")
    .select("id, job_number, description")
    .ilike("job_number", trimmed)
    .maybeSingle();

  if (jobError) throw jobError;
  if (!job?.id) return null;

  const { data: requests, error: requestsError } = await db
    .from("job_requests")
    .select("request_id, description, hours, sort_order")
    .eq("job_id", Number(job.id))
    .order("sort_order", { ascending: true });

  if (requestsError) throw requestsError;
  return { job, requests: requests || [] };
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
  const countableEntries = (Array.isArray(entries) ? entries : []).filter(
    (entry) => entry?._source !== "overtime_sessions" && !entry?._excludedFromTotals
  );
  const actualHours = countableEntries.reduce(
    (sum, entry) => sum + Number(entry.hours_spent || 0),
    0
  );
  const seenAllocations = new Set();
  const allocatedHours = countableEntries.reduce((sum, entry) => {
    const allocationKey = entry?._allocation_key || `entry:${entry?.id}`;
    if (seenAllocations.has(allocationKey)) return sum;
    seenAllocations.add(allocationKey);
    return sum + Number(entry.allocated_hours || 0);
  }, 0);
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

export { DEFAULT_TARGET_HOURS, DEFAULT_WEIGHT };
