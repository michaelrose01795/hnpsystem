#!/usr/bin/env node
/* eslint-disable no-console */

const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

const projectRoot = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(projectRoot, ".env") });
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Keep this list aligned with TECHNICIAN_ROLES in src/lib/auth/roles.js. This
// standalone Node utility cannot load the application's @/ module alias.
const TECHNICIAN_ROLES = [
  "Techs",
  "Technician",
  "Technician Lead",
  "Lead Technician",
  "MOT Tester",
  "Tester",
];

const SEED_MARKER = "seed:efficiency-v1";
const ENTRY_META_PREFIX = "__HNP_JOB_META__:";
const argv = new Set(process.argv.slice(2));
const shouldApply = argv.has("--apply");
const shouldCleanup = argv.has("--cleanup");

const roundHours = (value) => Number(Number(value).toFixed(2));

const londonDateParts = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

const toDateKey = (date) => date.toISOString().slice(0, 10);

const getCompletedWeekdays = () => {
  const { year, month, day } = londonDateParts();
  const today = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const lastCompleted = new Date(today);
  lastCompleted.setUTCDate(lastCompleted.getUTCDate() - 1);

  const dates = [];
  for (
    let cursor = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    cursor <= lastCompleted;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) dates.push(toDateKey(cursor));
  }

  // On the first working day of a month, a current-day preview is more useful
  // than an empty dry run.
  return dates.length ? dates : [toDateKey(today)];
};

const monthBounds = (dateKey) => {
  const [year, month] = dateKey.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
};

const buildStoredNotes = (description, allocatedHours) =>
  `${ENTRY_META_PREFIX}${JSON.stringify({
    notes: `Visual demo data linked to an existing workshop request · ${SEED_MARKER}`,
    jobDescription: description,
    allocatedHours,
  })}`;

const entryKey = (entry) =>
  `${Number(entry.user_id)}|${entry.date}|${String(entry.job_number || "").trim()}`;

async function cleanup() {
  const { data, error } = await db
    .from("tech_efficiency_entries")
    .delete()
    .ilike("notes", `%${SEED_MARKER}%`)
    .select("id");

  if (error) throw error;
  console.log(`Removed ${(data || []).length} efficiency demo rows.`);
}

async function loadSeedSources(startDate, endDate) {
  const { data: technicians, error: techniciansError } = await db
    .from("users")
    .select("user_id, first_name, last_name, role, contracted_hours")
    .eq("is_active", true)
    .in("role", TECHNICIAN_ROLES)
    .order("first_name", { ascending: true });
  if (techniciansError) throw techniciansError;

  const technicianIds = (technicians || []).map(({ user_id }) => user_id);
  if (!technicianIds.length) throw new Error("No active workshop technicians were found.");

  const [{ data: jobs, error: jobsError }, existingResult, clockingResult] =
    await Promise.all([
      db
        .from("jobs")
        .select("id, job_number, description, type, status, assigned_to, updated_at")
        .in("assigned_to", technicianIds)
        .not("job_number", "is", null)
        .order("updated_at", { ascending: false }),
      db
        .from("tech_efficiency_entries")
        .select("id, user_id, date, job_number, notes")
        .in("user_id", technicianIds)
        .gte("date", startDate)
        .lt("date", endDate),
      db
        .from("job_clocking")
        .select("user_id, job_number, clock_in")
        .in("user_id", technicianIds)
        .gte("clock_in", `${startDate}T00:00:00.000Z`)
        .lt("clock_in", `${endDate}T00:00:00.000Z`),
    ]);

  if (jobsError) throw jobsError;
  if (existingResult.error) throw existingResult.error;
  if (clockingResult.error) throw clockingResult.error;

  const activeJobs = (jobs || []).filter(
    ({ status }) => !["cancelled", "closed", "completed"].includes(String(status || "").toLowerCase())
  );
  if (!activeJobs.length) throw new Error("No current technician-assigned jobs were found.");

  const { data: requests, error: requestsError } = await db
    .from("job_requests")
    .select("request_id, job_id, description, hours, job_type, sort_order, status")
    .in("job_id", activeJobs.map(({ id }) => id))
    .order("sort_order", { ascending: true });
  if (requestsError) throw requestsError;

  return {
    technicians: technicians || [],
    jobs: activeJobs,
    requests: requests || [],
    existingEntries: existingResult.data || [],
    clockings: clockingResult.data || [],
  };
}

function buildRows({ technicians, jobs, requests, existingEntries, clockings }, dates) {
  const jobsById = new Map(jobs.map((job) => [Number(job.id), job]));
  const occupiedKeys = new Set(existingEntries.map(entryKey));

  for (const clocking of clockings) {
    const date = String(clocking.clock_in || "").slice(0, 10);
    occupiedKeys.add(`${Number(clocking.user_id)}|${date}|${String(clocking.job_number || "").trim()}`);
  }

  const rows = [];
  const efficiencyRatios = [0.92, 1.06, 0.84, 1.14, 0.98, 0.89, 1.03];
  const utilisationRatios = [0.86, 0.92, 0.8, 0.95, 0.88];

  technicians.forEach((technician, technicianIndex) => {
    const assignedJobIds = new Set(
      jobs
        .filter(({ assigned_to }) => Number(assigned_to) === Number(technician.user_id))
        .map(({ id }) => Number(id))
    );
    const availableRequests = requests
      .filter(({ job_id, description, hours }) => {
        const allocation = Number(hours);
        return (
          assignedJobIds.has(Number(job_id)) &&
          String(description || "").trim() &&
          Number.isFinite(allocation) &&
          allocation >= 0.2 &&
          allocation <= 6
        );
      })
      .sort((left, right) => {
        const leftJob = jobsById.get(Number(left.job_id));
        const rightJob = jobsById.get(Number(right.job_id));
        return (
          String(rightJob?.updated_at || "").localeCompare(String(leftJob?.updated_at || "")) ||
          Number(left.sort_order || 0) - Number(right.sort_order || 0)
        );
      });

    if (!availableRequests.length) {
      throw new Error(`No allocated current-job requests found for user ${technician.user_id}.`);
    }

    const dailyHours = Math.max(1, Number(technician.contracted_hours || 40) / 5);
    let requestIndex = technicianIndex % availableRequests.length;

    dates.forEach((date, dateIndex) => {
      const dailyTarget = dailyHours * utilisationRatios[(technicianIndex + dateIndex) % utilisationRatios.length];
      let dailyActual = 0;
      let attempts = 0;

      while (dailyActual < dailyTarget && attempts < availableRequests.length) {
        const request = availableRequests[requestIndex % availableRequests.length];
        requestIndex += 1;
        attempts += 1;

        const job = jobsById.get(Number(request.job_id));
        if (!job) continue;

        const description = String(request.description).trim();
        const requestLabel = `${job.job_number} - Req ${request.sort_order || 1}: ${description}`;
        const key = `${Number(technician.user_id)}|${date}|${requestLabel}`;
        const baseClockingKey = `${Number(technician.user_id)}|${date}|${job.job_number}`;
        if (occupiedKeys.has(key) || occupiedKeys.has(baseClockingKey)) continue;

        const allocatedHours = roundHours(request.hours);
        const ratio = efficiencyRatios[(technicianIndex + dateIndex + attempts) % efficiencyRatios.length];
        const hoursSpent = Math.max(0.2, roundHours(allocatedHours / ratio));
        const now = new Date().toISOString();

        rows.push({
          user_id: technician.user_id,
          date,
          job_number: requestLabel,
          job_description: description,
          allocated_hours: allocatedHours,
          hours_spent: hoursSpent,
          notes: buildStoredNotes(description, allocatedHours),
          day_type: "weekday",
          created_at: now,
          updated_at: now,
        });
        occupiedKeys.add(key);
        dailyActual += hoursSpent;
      }
    });
  });

  return rows;
}

async function main() {
  if (shouldCleanup) {
    await cleanup();
    return;
  }

  const dates = getCompletedWeekdays();
  const { startDate, endDate } = monthBounds(dates[0]);
  const sources = await loadSeedSources(startDate, endDate);
  const demoRowsAlreadyPresent = sources.existingEntries.filter(({ notes }) =>
    String(notes || "").includes(SEED_MARKER)
  ).length;

  if (demoRowsAlreadyPresent > 0) {
    console.log(
      `${demoRowsAlreadyPresent} efficiency demo rows already exist for ${startDate.slice(0, 7)}; no additional rows were created.`
    );
    console.log("Run with --cleanup first if you want to regenerate the month.");
    return;
  }

  const rows = buildRows(sources, dates);

  const summary = sources.technicians.map((technician) => {
    const technicianRows = rows.filter(
      ({ user_id }) => Number(user_id) === Number(technician.user_id)
    );
    return {
      technician: `${technician.first_name} ${technician.last_name}`.trim(),
      rows: technicianRows.length,
      actualHours: roundHours(
        technicianRows.reduce((total, row) => total + Number(row.hours_spent), 0)
      ),
      allocatedHours: roundHours(
        technicianRows.reduce((total, row) => total + Number(row.allocated_hours), 0)
      ),
    };
  });

  console.table(summary);
  console.log(
    `${dates[0]} to ${dates.at(-1)}: ${rows.length} new rows planned.`
  );

  if (!shouldApply) {
    console.log("Dry run only. Re-run with --apply to insert these rows.");
    return;
  }

  if (!rows.length) {
    console.log("No rows needed; the current month is already seeded.");
    return;
  }

  const { data, error } = await db
    .from("tech_efficiency_entries")
    .insert(rows)
    .select("id, user_id, date, job_number");
  if (error) throw error;

  console.log(`Inserted ${(data || []).length} job-linked efficiency demo rows.`);
}

main().catch((error) => {
  console.error("Efficiency demo seed failed:", error.message || error);
  process.exit(1);
});
