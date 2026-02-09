// file location: src/lib/database/efficiency.js
import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();

const TECH_NAMES = ["Glen", "Jake", "Scott", "Paul", "Cheryl", "Michael"];

const DEFAULT_TARGET_HOURS = 160;
const DEFAULT_WEIGHT = 1.0;
const MICHAEL_WEIGHT = 1.0;

/**
 * Fetch the list of technicians matching the efficiency roster.
 * Returns users whose first_name matches one of the TECH_NAMES.
 */
export async function getEfficiencyTechnicians() {
  const { data, error } = await db
    .from("users")
    .select("user_id, first_name, last_name, role")
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
    .select("id, user_id, date, job_number, hours_spent, notes, day_type, created_at, updated_at")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
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
    .select("id, user_id, date, job_number, hours_spent, notes, day_type, created_at, updated_at")
    .in("user_id", userIds)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Insert a new efficiency entry.
 */
export async function addEfficiencyEntry({ userId, date, jobNumber, hoursSpent, notes, dayType }) {
  const { data, error } = await db
    .from("tech_efficiency_entries")
    .insert([
      {
        user_id: userId,
        date,
        job_number: jobNumber,
        hours_spent: hoursSpent,
        notes: notes || null,
        day_type: dayType,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an existing efficiency entry.
 */
export async function updateEfficiencyEntry(entryId, { date, jobNumber, hoursSpent, notes, dayType }) {
  const { data, error } = await db
    .from("tech_efficiency_entries")
    .update({
      date,
      job_number: jobNumber,
      hours_spent: hoursSpent,
      notes: notes || null,
      day_type: dayType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  return data;
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
  const { data, error } = await db
    .from("tech_efficiency_targets")
    .select("user_id, monthly_target_hours, weight")
    .in("user_id", userIds);

  if (error) throw error;

  const map = new Map();
  (data || []).forEach((row) => {
    map.set(row.user_id, {
      monthlyTargetHours: Number(row.monthly_target_hours),
      weight: Number(row.weight),
    });
  });

  // Fill in defaults for any tech not in the table
  userIds.forEach((uid) => {
    if (!map.has(uid)) {
      map.set(uid, {
        monthlyTargetHours: DEFAULT_TARGET_HOURS,
        weight: DEFAULT_WEIGHT,
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
      hours_spent: hours,
      notes: "Auto-logged from job clocking",
      day_type: dayType,
      created_at: row.created_at,
      updated_at: row.clock_out,
      _source: "job_clocking",
    };
  });
}

/**
 * Calculate totals for a single technician.
 */
export function calculateTechTotals(entries, target) {
  const actualHours = entries.reduce((sum, e) => sum + Number(e.hours_spent || 0), 0);
  const targetHours = target.monthlyTargetHours;
  const difference = actualHours - targetHours;
  const efficiencyPct = targetHours > 0 ? (actualHours / targetHours) * 100 : 0;

  return {
    actualHours: Math.round(actualHours * 100) / 100,
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

  techSummaries.forEach(({ totals, weight }) => {
    weightedActual += totals.actualHours * weight;
    weightedTarget += totals.targetHours * weight;
  });

  const difference = Math.round((weightedActual - weightedTarget) * 100) / 100;
  const efficiencyPct =
    weightedTarget > 0
      ? Math.round(((weightedActual / weightedTarget) * 100) * 10) / 10
      : 0;

  return {
    weightedActual: Math.round(weightedActual * 100) / 100,
    weightedTarget: Math.round(weightedTarget * 100) / 100,
    difference,
    efficiencyPct,
  };
}

export { TECH_NAMES, DEFAULT_TARGET_HOURS, DEFAULT_WEIGHT, MICHAEL_WEIGHT };
