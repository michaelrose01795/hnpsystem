#!/usr/bin/env node
/* eslint-disable no-console */
// file location: tools/scripts/seed-hr-tabs.js
//
// Seeds realistic, current HR data for the HR Manager tabs — Dashboard,
// Attendance, Payroll, Leave, Performance, Training and Disciplinary.
//
// Every row is linked to a real employee already in `users`. The script NEVER
// writes to `users`: the Employees tab is the source of truth for who exists,
// what they earn and which department they sit in, and this script only reads
// from it.
//
// It is additive and idempotent. Existing HR history is left untouched; each
// row it inserts carries SEED_MARKER in a column the UI does not display, so
// `--cleanup` removes exactly what this script created and nothing else.
//
//   node tools/scripts/seed-hr-tabs.js            # dry run — prints the plan
//   node tools/scripts/seed-hr-tabs.js --apply    # insert the rows
//   node tools/scripts/seed-hr-tabs.js --cleanup  # remove only seeded rows
//
// Keep the marker stable: changing it orphans previously seeded rows.

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

const SEED_MARKER = "seed:hr-tabs-v1";

// The demo account is invisible everywhere else in the app (see
// src/lib/database/allAccessVisibility.js), so it gets no HR records either.
const ALL_ACCESS_EMAIL = "alex.morgan@hnp-demo.co.uk";

// Standalone Node utility — it cannot load the app's "@/" module alias, so the
// non-staff role list is mirrored here. Keep in step with src/lib/auth/roles.js.
const NON_STAFF_ROLES = new Set(["customer"]);

const argv = new Set(process.argv.slice(2));
const shouldApply = argv.has("--apply");
const shouldCleanup = argv.has("--cleanup");

/* ------------------------------------------------------------------ helpers */

// Deterministic PRNG so repeat runs produce the same figures rather than a new
// random dataset every time someone re-seeds.
const rng = (seed) => {
  let t = seed + 0x6d2b79f5;
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const addDays = (base, days) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};
const dateKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const isWeekend = (value) => {
  const day = new Date(value).getDay();
  return day === 0 || day === 6;
};
// Every timestamp this script writes sits inside the same British Summer Time
// window, so a fixed offset is correct and keeps clock-in times reading as
// local workshop hours rather than drifting an hour in the UI.
const stamp = (day, hours, minutes) =>
  `${dateKey(day)}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+01:00`;
const clock = (hours, minutes) => `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
const money = (value) => Number(Number(value).toFixed(2));
const pick = (list, roll) => list[Math.floor(roll * list.length) % list.length];

const insert = async (table, rows, batchSize = 400) => {
  if (!rows.length) return 0;
  let written = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
    written += batch.length;
  }
  console.log(`  + ${written} -> ${table}`);
  return written;
};

/* -------------------------------------------------------------- source data */

// Reads the Employees tab's own source table. Read-only, always.
const loadEmployees = async () => {
  const { data, error } = await db
    .from("users")
    .select(
      "user_id, first_name, last_name, email, role, job_title, department, employment_type, employment_status, start_date, manager_id, contracted_hours, hourly_rate, overtime_rate, is_active"
    )
    .order("user_id");
  if (error) throw new Error(`Failed to read users: ${error.message}`);

  return (data || []).filter(
    (user) =>
      user.is_active &&
      user.email !== ALL_ACCESS_EMAIL &&
      !NON_STAFF_ROLES.has(String(user.role || "").toLowerCase()) &&
      Boolean(user.department)
  );
};

const loadOvertimePeriods = async () => {
  const { data, error } = await db
    .from("overtime_periods")
    .select("period_id, period_start, period_end")
    .gte("period_end", dateKey(addDays(TODAY, -95)))
    .order("period_end", { ascending: false });
  if (error) throw new Error(`Failed to read overtime_periods: ${error.message}`);
  return data || [];
};

const loadCourses = async () => {
  const { data, error } = await db
    .from("hr_training_courses")
    .select("course_id, title, category, renewal_interval_months")
    .order("course_id");
  if (error) throw new Error(`Failed to read hr_training_courses: ${error.message}`);
  return data || [];
};

/* --------------------------------------------------------------- generators */

const LEAVE_TYPES = ["Holiday", "Sickness", "Unpaid Leave", "Compassionate", "Parental"];
const HOLIDAY_REASONS = [
  "Family holiday booked with the travel agent",
  "Half-term cover at home",
  "Long weekend away",
  "Wedding in the family",
  "Using the last of this year's entitlement",
  "Booked flights before the price rise",
];
const SICKNESS_REASONS = [
  "Flu - GP note supplied",
  "Back strain, signed off by the GP",
  "Hospital appointment follow-up",
  "Dental surgery recovery",
];

const leaveNotes = ({ requestNotes, declineReason = "", halfDay = "None", totalDays, manager }) =>
  JSON.stringify({
    requestNotes,
    declineReason,
    halfDay,
    totalDays,
    lineManagerIds: manager ? [manager] : [],
    seedMarker: SEED_MARKER,
  });

// Leave is generated first because attendance has to agree with it — nobody
// clocks in on a day they are signed off.
const buildAbsences = (employees) => {
  const rows = [];

  employees.forEach((employee, index) => {
    const roll = rng(employee.user_id * 17 + 3);
    const manager = employee.manager_id || null;

    // 1) Historic, approved and already taken — drives the Leave Balances card.
    const takenCount = 1 + Math.floor(roll() * 3);
    for (let i = 0; i < takenCount; i += 1) {
      const start = addDays(TODAY, -(20 + Math.floor(roll() * 130)));
      const length = 1 + Math.floor(roll() * 5);
      rows.push({
        user_id: employee.user_id,
        type: roll() > 0.75 ? "Sickness" : "Holiday",
        start_date: dateKey(start),
        end_date: dateKey(addDays(start, length - 1)),
        approval_status: "Approved",
        approved_by: manager,
        notes: leaveNotes({ requestNotes: pick(HOLIDAY_REASONS, roll()), totalDays: length, manager }),
      });
    }

    // 2) Booked and approved in the fortnight ahead — the Dashboard's upcoming
    //    absences panel and the Leave tab's cover warning read this window.
    if (index % 4 === 0) {
      const start = addDays(TODAY, 1 + Math.floor(roll() * 13));
      const length = 1 + Math.floor(roll() * 4);
      rows.push({
        user_id: employee.user_id,
        type: "Holiday",
        start_date: dateKey(start),
        end_date: dateKey(addDays(start, length - 1)),
        approval_status: "Approved",
        approved_by: manager,
        notes: leaveNotes({ requestNotes: pick(HOLIDAY_REASONS, roll()), totalDays: length, manager }),
      });
    }

    // 3) Away right now — the Attendance tab's "away today" tile and the
    //    directory's "On leave" status both key off an absence spanning today.
    if (index % 11 === 3) {
      const start = addDays(TODAY, -1);
      rows.push({
        user_id: employee.user_id,
        type: roll() > 0.5 ? "Holiday" : "Sickness",
        start_date: dateKey(start),
        end_date: dateKey(addDays(TODAY, 2)),
        approval_status: "Approved",
        approved_by: manager,
        notes: leaveNotes({ requestNotes: pick(SICKNESS_REASONS, roll()), totalDays: 4, manager }),
      });
    }

    // 4) Sitting in the approval queue — the Leave tab opens on these.
    if (index % 3 === 1) {
      const start = addDays(TODAY, 6 + Math.floor(roll() * 45));
      const length = 1 + Math.floor(roll() * 5);
      rows.push({
        user_id: employee.user_id,
        type: pick(LEAVE_TYPES, roll()),
        start_date: dateKey(start),
        end_date: dateKey(addDays(start, length - 1)),
        approval_status: "Pending",
        approved_by: null,
        notes: leaveNotes({
          requestNotes: pick(HOLIDAY_REASONS, roll()),
          halfDay: length === 1 && roll() > 0.6 ? "AM" : "None",
          totalDays: length,
          manager,
        }),
      });
    }

    // 5) Declined, so the queue is not uniformly green.
    if (index % 13 === 5) {
      const start = addDays(TODAY, 10 + Math.floor(roll() * 30));
      rows.push({
        user_id: employee.user_id,
        type: "Holiday",
        start_date: dateKey(start),
        end_date: dateKey(addDays(start, 4)),
        approval_status: "Declined",
        approved_by: manager,
        notes: leaveNotes({
          requestNotes: "Two weeks off over the MOT rush",
          declineReason: "Workshop already short two technicians that week - please rebook.",
          totalDays: 5,
          manager,
        }),
      });
    }
  });

  return rows;
};

// Days an employee is signed off, so attendance never contradicts leave.
const buildAbsenceIndex = (absenceRows) => {
  const index = new Map();
  absenceRows.forEach((row) => {
    if (row.approval_status !== "Approved") return;
    const set = index.get(row.user_id) || new Set();
    for (let cursor = new Date(row.start_date); dateKey(cursor) <= row.end_date; cursor = addDays(cursor, 1)) {
      set.add(dateKey(cursor));
    }
    index.set(row.user_id, set);
  });
  return index;
};

const SHIFT_NOTES = [
  "Workshop shift",
  "Service bay cover",
  "Front of house shift",
  "Standard rostered shift",
  "Parts counter shift",
];

const buildTimeRecords = (employees, absenceIndex) => {
  const rows = [];
  const nowHour = new Date().getHours();

  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = addDays(TODAY, -offset);
    const key = dateKey(day);
    const weekend = isWeekend(day);
    const isToday = offset === 0;

    employees.forEach((employee, index) => {
      if (absenceIndex.get(employee.user_id)?.has(key)) return; // signed off
      const roll = rng(employee.user_id * 101 + offset * 7);

      // Saturdays run a skeleton rota; Sundays the site is closed.
      if (weekend) {
        if (new Date(day).getDay() === 0) return;
        if (index % 5 !== 0) return;
      }
      if (!weekend && roll() < 0.04) return; // the odd unplanned absence

      const startHour = 7 + (roll() < 0.25 ? 1 : 0);
      const startMinute = Math.floor(roll() * 45);
      const breakMinutes = 30 + Math.floor(roll() * 3) * 15;
      const shiftHours = weekend ? 4.5 : Number((7.4 + roll() * 1.3).toFixed(2));
      const endTotal = startHour * 60 + startMinute + shiftHours * 60 + breakMinutes;

      // Today's shift is only closed off once the working day is actually over,
      // so the "still on site" tile reflects the real time of day.
      const stillOnSite = isToday && (nowHour < 16 || index % 3 === 0);

      rows.push({
        user_id: employee.user_id,
        date: key,
        clock_in: stamp(day, startHour, startMinute),
        clock_out: stillOnSite ? null : stamp(day, Math.floor(endTotal / 60), Math.floor(endTotal % 60)),
        hours_worked: stillOnSite ? null : shiftHours,
        break_minutes: breakMinutes,
        notes: `${pick(SHIFT_NOTES, roll())} · ${SEED_MARKER}`,
      });
    });
  }

  return rows;
};

const OVERTIME_NOTES = [
  "Late collection prep",
  "MOT backlog clearance",
  "Warranty rework outside normal hours",
  "Courtesy car valet before handover",
  "Saturday diagnostics cover",
];

const buildOvertimeSessions = (employees, periods) => {
  const rows = [];
  if (!periods.length) return rows;

  periods.forEach((period) => {
    const periodStart = new Date(period.period_start);
    const periodEnd = new Date(period.period_end);
    // Only bill overtime for days that have actually happened.
    const lastBillable = periodEnd > TODAY ? TODAY : periodEnd;
    const span = Math.round((lastBillable - periodStart) / 86400000);
    if (span <= 0) return;

    employees.forEach((employee, index) => {
      if (index % 3 === 2) return; // not everybody works overtime
      const roll = rng(employee.user_id * 31 + period.period_id);
      const sessions = 1 + Math.floor(roll() * 3);

      for (let i = 0; i < sessions; i += 1) {
        const day = addDays(periodStart, Math.floor(roll() * span));
        if (new Date(day).getDay() === 0) continue; // closed on Sundays
        const startHour = 17 + Math.floor(roll() * 2);
        const length = 1.5 + Math.floor(roll() * 5) * 0.5;
        const endTotal = startHour * 60 + 30 + length * 60;

        rows.push({
          period_id: period.period_id,
          user_id: employee.user_id,
          date: dateKey(day),
          start_time: clock(startHour, 30),
          // total_hours is a generated column — Postgres derives it from the
          // start/end times, so it must not be supplied here.
          end_time: clock(Math.floor(endTotal / 60), Math.floor(endTotal % 60)),
          approved_by: employee.manager_id || null,
          notes: `${pick(OVERTIME_NOTES, roll())} · ${SEED_MARKER}`,
        });
      }
    });
  });

  return rows;
};

const buildTrainingAssignments = (employees, courses) => {
  const rows = [];
  if (!courses.length) return rows;

  employees.forEach((employee, index) => {
    const roll = rng(employee.user_id * 53 + 11);

    courses.forEach((course, courseIndex) => {
      // Each employee carries a subset of the catalogue, not all of it.
      if ((employee.user_id + courseIndex) % 3 !== 0) return;

      const bucket = (index + courseIndex) % 5;
      let dueDate;
      let status;
      let completedAt = null;

      if (bucket === 0) {
        // Lapsed — the red tile on the Training tab.
        dueDate = addDays(TODAY, -(5 + Math.floor(roll() * 40)));
        status = "overdue";
      } else if (bucket === 1) {
        // Inside the 14-day warning window.
        dueDate = addDays(TODAY, 2 + Math.floor(roll() * 11));
        status = "in_progress";
      } else if (bucket === 2) {
        // Due inside the month.
        dueDate = addDays(TODAY, 16 + Math.floor(roll() * 14));
        status = "assigned";
      } else if (bucket === 3) {
        // Later in the 90-day renewal horizon.
        dueDate = addDays(TODAY, 32 + Math.floor(roll() * 56));
        status = "assigned";
      } else {
        // Already done — keeps the compliance percentage honest.
        dueDate = addDays(TODAY, -(10 + Math.floor(roll() * 90)));
        status = "completed";
        completedAt = stamp(addDays(dueDate, -(1 + Math.floor(roll() * 5))), 15, 0);
      }

      rows.push({
        user_id: employee.user_id,
        course_id: course.course_id,
        assigned_by: employee.manager_id || null,
        assigned_at: stamp(addDays(dueDate, -(30 + Math.floor(roll() * 60))), 9, 0),
        due_date: dateKey(dueDate),
        status,
        completed_at: completedAt,
        // Not read by the UI — carries the marker so --cleanup can find the row.
        certificate_url: `https://files.hnpsystem.local/training/${employee.user_id}-${course.course_id}.pdf#${SEED_MARKER}`,
      });
    });

    // Certificates already earned in previous years. Without this backlog the
    // Dashboard's "Training Compliance" tile — completed ÷ all assignments ever
    // — reads like a business that has never trained anybody, because only the
    // live renewal cycle would be on file.
    courses.forEach((course) => {
      for (let year = 1; year <= 2; year += 1) {
        const completedOn = addDays(TODAY, -(year * 365 + Math.floor(roll() * 120)));
        rows.push({
          user_id: employee.user_id,
          course_id: course.course_id,
          assigned_by: employee.manager_id || null,
          assigned_at: stamp(addDays(completedOn, -45), 9, 0),
          due_date: dateKey(addDays(completedOn, 14)),
          status: "completed",
          completed_at: stamp(completedOn, 15, 0),
          certificate_url: `https://files.hnpsystem.local/training/${employee.user_id}-${course.course_id}-y${year}.pdf#${SEED_MARKER}`,
        });
      }
    });
  });

  return rows;
};

const DEVELOPMENT_FOCUS = [
  "Sign off the remaining diagnostic modules before the next MOT audit.",
  "Shadow the workshop controller on job loading for two weeks.",
  "Take the lead on customer handovers to build confidence at the desk.",
  "Reduce time-to-quote on parts enquiries; target under 20 minutes.",
  "Complete the EV high-voltage qualification and mentor one apprentice.",
  "Tidy up the daily VHC write-ups - photos and notes on every red item.",
  "Own the weekly stock check and report variances to the parts manager.",
  "Improve the handover notes so the service desk stops chasing detail.",
];

const buildPerformanceReviews = (employees) => {
  const rows = [];

  employees.forEach((employee, index) => {
    const roll = rng(employee.user_id * 71 + 19);
    const reviewer = employee.manager_id || null;

    const scoreCard = (base) => ({
      overall: money(base),
      attendance: Math.min(5, Math.round(base + (roll() > 0.5 ? 1 : 0))),
      productivity: Math.min(5, Math.round(base)),
      quality: Math.min(5, Math.round(base + (roll() > 0.7 ? 1 : 0))),
      teamwork: Math.min(5, Math.max(2, Math.round(base - (roll() > 0.7 ? 1 : 0)))),
      seedMarker: SEED_MARKER,
    });

    // The last completed appraisal.
    const completedAt = addDays(TODAY, -(30 + Math.floor(roll() * 120)));
    rows.push({
      user_id: employee.user_id,
      reviewer_id: reviewer,
      scheduled_at: stamp(completedAt, 10 + Math.floor(roll() * 6), 0),
      status: "completed",
      score: scoreCard(3.2 + roll() * 1.6),
      notes: pick(DEVELOPMENT_FOCUS, roll()),
    });

    // The next one — inside 30 days for most, overdue for a few.
    const overdue = index % 9 === 4;
    const nextAt = overdue
      ? addDays(TODAY, -(3 + Math.floor(roll() * 25)))
      : addDays(TODAY, 1 + Math.floor(roll() * 29));

    rows.push({
      user_id: employee.user_id,
      reviewer_id: reviewer,
      scheduled_at: stamp(nextAt, 9 + Math.floor(roll() * 7), 30),
      status: overdue ? "draft" : "scheduled",
      score: scoreCard(3.4 + roll() * 1.4),
      notes: pick(DEVELOPMENT_FOCUS, roll()),
    });
  });

  return rows;
};

const DISCIPLINARY_CASES = [
  {
    incidentType: "PPE compliance",
    severity: "Verbal Warning",
    status: "monitoring",
    summary: "Missed PPE sign-off on the ramp; refresher booked.",
    outcome: "Refresher assigned",
    jobNumber: "J-12684",
  },
  {
    incidentType: "Process missed",
    severity: "Written Warning",
    status: "open",
    summary: "Vehicle handover checklist skipped during a busy collection window.",
    outcome: "Manager review",
    jobNumber: "J-12691",
  },
  {
    incidentType: "Timekeeping",
    severity: "Verbal Warning",
    status: "monitoring",
    summary: "Three late starts inside a fortnight; agreed a revised start time.",
    outcome: "Monitoring for 8 weeks",
    jobNumber: "Internal",
  },
  {
    incidentType: "Repeat quality issue",
    severity: "Final Written Warning",
    status: "open",
    summary: "Second comeback on the same repair; workmanship review under way.",
    outcome: "Escalated to the service manager",
    jobNumber: "J-12702",
  },
  {
    incidentType: "Customer complaint review",
    severity: "Written Warning",
    status: "open",
    summary: "Tone on a customer call escalated by the service desk.",
    outcome: "Customer care module assigned",
    jobNumber: "J-12715",
  },
  {
    incidentType: "Stock discrepancy",
    severity: "Verbal Warning",
    status: "closed",
    summary: "Parts booked out against the wrong job card; corrected the same day.",
    outcome: "Closed - no further action",
    jobNumber: "J-12666",
  },
  {
    incidentType: "Damage in transit",
    severity: "Written Warning",
    status: "monitoring",
    summary: "Kerbed alloy on a collection; refresher on vehicle movements booked.",
    outcome: "Refresher assigned",
    jobNumber: "J-12688",
  },
  {
    incidentType: "Safety near miss",
    severity: "Verbal Warning",
    status: "closed",
    summary: "Ramp lowered without a final walk-round; toolbox talk delivered.",
    outcome: "Closed - toolbox talk delivered",
    jobNumber: "J-12673",
  },
];

const buildDisciplinaryCases = (employees, recordedBy) => {
  // Spread across departments rather than concentrated on one team.
  const candidates = employees.filter((_, index) => index % 5 === 2);
  if (!candidates.length) return [];

  return DISCIPLINARY_CASES.map((template, index) => {
    const employee = candidates[index % candidates.length];
    const roll = rng(employee.user_id * 13 + index);
    return {
      user_id: employee.user_id,
      incident_date: dateKey(addDays(TODAY, -(4 + Math.floor(roll() * 80)))),
      incident_type: template.incidentType,
      severity: template.severity,
      status: template.status,
      // Structured like hr_absences.notes so the Disciplinary tab can show the
      // job, the reporter and the outcome without a schema change.
      notes: JSON.stringify({
        summary: template.summary,
        jobNumber: template.jobNumber,
        recordedBy,
        outcome: template.outcome,
        seedMarker: SEED_MARKER,
      }),
    };
  });
};

// Calendar-month payroll runs covering the current month and the three before.
const buildPayrollPeriods = () => {
  const periods = [];
  for (let back = 3; back >= 0; back -= 1) {
    const start = new Date(TODAY.getFullYear(), TODAY.getMonth() - back, 1);
    const end = new Date(TODAY.getFullYear(), TODAY.getMonth() - back + 1, 0);
    periods.push({ period_start: dateKey(start), period_end: dateKey(end), current: back === 0 });
  }
  return periods;
};

const ADJUSTMENT_TYPES = [
  { type: "bonus", reason: "Quarterly workshop bonus", min: 75, max: 425 },
  { type: "overtime", reason: "Approved overtime hours", min: 60, max: 380 },
  { type: "expense", reason: "Mileage and parts collection expenses", min: 18, max: 145 },
  { type: "deduction", reason: "Salary sacrifice - cycle to work", min: 25, max: 90 },
];

const buildPayrollAdjustments = (employees, runs) => {
  const rows = [];

  runs.forEach((run, runIndex) => {
    employees.forEach((employee, index) => {
      if ((index + runIndex) % 3 !== 0) return;
      const roll = rng(employee.user_id * 97 + runIndex);
      const template = ADJUSTMENT_TYPES[(index + runIndex) % ADJUSTMENT_TYPES.length];

      rows.push({
        payroll_id: run.payroll_id,
        user_id: employee.user_id,
        type: template.type,
        amount: money(template.min + roll() * (template.max - template.min)),
        // Not read by the UI — carries the marker for --cleanup.
        reason: `${template.reason} · ${SEED_MARKER}`,
      });
    });
  });

  return rows;
};

/* ------------------------------------------------------------------ cleanup */

const cleanup = async () => {
  const like = `%${SEED_MARKER}%`;

  const steps = [
    // Adjustments before runs — the foreign key points that way.
    ["hr_payroll_adjustments", (q) => q.like("reason", like)],
    ["hr_payroll_runs", (q) => q.in("period_start", buildPayrollPeriods().map((p) => p.period_start))],
    ["hr_disciplinary_cases", (q) => q.like("notes", like)],
    ["hr_performance_reviews", (q) => q.eq("score->>seedMarker", SEED_MARKER)],
    ["hr_training_assignments", (q) => q.like("certificate_url", like)],
    ["overtime_sessions", (q) => q.like("notes", like)],
    ["time_records", (q) => q.like("notes", like)],
    ["hr_absences", (q) => q.like("notes", like)],
  ];

  for (const [table, filter] of steps) {
    const { error, count } = await filter(db.from(table).delete({ count: "exact" }));
    if (error) throw new Error(`Cleanup of ${table} failed: ${error.message}`);
    console.log(`  - ${count ?? 0} <- ${table}`);
  }
};

/* --------------------------------------------------------------------- main */

const main = async () => {
  if (shouldCleanup) {
    console.log(`Removing rows marked ${SEED_MARKER}...`);
    await cleanup();
    console.log("Cleanup complete.");
    return;
  }

  const employees = await loadEmployees();
  if (!employees.length) {
    console.error("No active staff found in `users` - nothing to link HR records to.");
    process.exit(1);
  }

  const [periods, courses] = await Promise.all([loadOvertimePeriods(), loadCourses()]);
  const hrLead =
    employees.find((employee) => /hr|admin manager|general manager/i.test(employee.job_title || "")) || employees[0];
  const recordedBy = `${hrLead.first_name} ${hrLead.last_name}`.trim();

  const absences = buildAbsences(employees);
  const timeRecords = buildTimeRecords(employees, buildAbsenceIndex(absences));
  const overtimeSessions = buildOvertimeSessions(employees, periods);
  const trainingAssignments = buildTrainingAssignments(employees, courses);
  const performanceReviews = buildPerformanceReviews(employees);
  const disciplinaryCases = buildDisciplinaryCases(employees, recordedBy);
  const payrollPeriods = buildPayrollPeriods();

  console.log(`Employees linked: ${employees.length} (read-only - \`users\` is never written)`);
  console.log(`Overtime periods in range: ${periods.length}`);
  console.log(`Training courses in catalogue: ${courses.length}`);
  console.log("\nPlanned rows:");
  console.log(`  hr_absences              ${absences.length}`);
  console.log(`  time_records             ${timeRecords.length}`);
  console.log(`  overtime_sessions        ${overtimeSessions.length}`);
  console.log(`  hr_training_assignments  ${trainingAssignments.length}`);
  console.log(`  hr_performance_reviews   ${performanceReviews.length}`);
  console.log(`  hr_disciplinary_cases    ${disciplinaryCases.length}`);
  console.log(`  hr_payroll_runs          ${payrollPeriods.length}`);

  if (!shouldApply) {
    console.log("\nDry run - nothing written. Re-run with --apply to insert.");
    return;
  }

  console.log("\nClearing any previous run of this seed...");
  await cleanup();
  console.log("Inserting...");

  await insert("hr_absences", absences);
  await insert("time_records", timeRecords);
  await insert("overtime_sessions", overtimeSessions);
  await insert("hr_training_assignments", trainingAssignments);
  await insert("hr_performance_reviews", performanceReviews);
  await insert("hr_disciplinary_cases", disciplinaryCases);

  const { data: runs, error: runError } = await db
    .from("hr_payroll_runs")
    .insert(
      payrollPeriods.map((period) => ({
        period_start: period.period_start,
        period_end: period.period_end,
        processed_at: period.current ? null : stamp(addDays(new Date(period.period_end), 1), 11, 0),
        processed_by: hrLead.user_id,
        status: period.current ? "draft" : "processed",
      }))
    )
    .select("payroll_id, period_start");
  if (runError) throw new Error(`Insert into hr_payroll_runs failed: ${runError.message}`);
  console.log(`  + ${runs.length} -> hr_payroll_runs`);

  await insert("hr_payroll_adjustments", buildPayrollAdjustments(employees, runs));

  console.log("\nDone. Reload /hr/manager to see the tabs populated.");
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
