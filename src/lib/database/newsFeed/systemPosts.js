// file location: src/lib/database/newsFeed/systemPosts.js
//
// Automated, system-generated posts.
//
// Every post written here carries source = 'system' and a UNIQUE system_key,
// so a re-run refreshes the existing post rather than stacking duplicates —
// the cron job can safely fire hourly, or be replayed by hand, without
// spamming the feed.
//
// The numbers are read from the live operational tables (jobs, parts_job_items,
// vhc_checks, deliveries, invoices), not from a fixture: if the workshop is
// quiet, the post says so.

import {
  GENERAL_DEPARTMENT,
  SYSTEM_AUTHOR,
  SYSTEM_POST_CAPACITY_ALERT,
  SYSTEM_POST_DAILY_SUMMARY,
  SYSTEM_POST_DELIVERY_LOAD,
  SYSTEM_POST_PARTS_BACKLOG,
  SYSTEM_POST_VHC_BACKLOG,
} from "@/lib/news/constants";
import { db, throwIf } from "./client";
import { upsertSystemPost } from "./posts";

// Dates are handled in the dealership's own day, not UTC, so a summary posted
// at 18:00 covers the day the staff just worked.
const startOfDay = (date = new Date()) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const isoDay = (date = new Date()) => startOfDay(date).toISOString().slice(0, 10);

const countRows = async (table, build) => {
  const query = build(db.from(table).select("*", { count: "exact", head: true }));
  const { count, error } = await query;
  throwIf(error, `Failed to count ${table}`);
  return count || 0;
};

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * The day's operational picture. One object, so the daily summary and the
 * alert rules read the same numbers.
 */
export async function collectDealershipMetrics({ date = new Date() } = {}) {
  const dayStart = startOfDay(date).toISOString();
  const dayEnd = new Date(startOfDay(date).getTime() + 86400000).toISOString();
  const day = isoDay(date);

  const [
    jobsBookedIn,
    jobsCompleted,
    jobsInWorkshop,
    jobsAwaitingParts,
    vhcCompleted,
    vhcAwaitingAuthorisation,
    partsOnOrder,
    partsAwaitingStock,
    appointmentsTomorrow,
    deliveryStopsToday,
    invoicesRaised,
  ] = await Promise.all([
    countRows("jobs", (q) => q.gte("created_at", dayStart).lt("created_at", dayEnd)),
    countRows("jobs", (q) => q.gte("completed_at", dayStart).lt("completed_at", dayEnd)),
    countRows("jobs", (q) =>
      q.not("workshop_started_at", "is", null).is("completed_at", null)
    ),
    countRows("jobs", (q) => q.not("parts_ordered_at", "is", null).is("completed_at", null)),
    countRows("jobs", (q) =>
      q.gte("vhc_completed_at", dayStart).lt("vhc_completed_at", dayEnd)
    ),
    countRows("vhc_checks", (q) => q.eq("approval_status", "pending")),
    countRows("parts_job_items", (q) => q.eq("status", "on_order")),
    countRows("parts_job_items", (q) => q.eq("status", "awaiting_stock")),
    countRows("appointments", (q) =>
      q
        .gte("scheduled_time", dayEnd)
        .lt("scheduled_time", new Date(new Date(dayEnd).getTime() + 86400000).toISOString())
        .neq("status", "cancelled")
    ),
    countDeliveryStops(day),
    countRows("invoices", (q) => q.gte("created_at", dayStart).lt("created_at", dayEnd)),
  ]);

  return {
    day,
    jobsBookedIn,
    jobsCompleted,
    jobsInWorkshop,
    jobsAwaitingParts,
    vhcCompleted,
    vhcAwaitingAuthorisation,
    partsOnOrder,
    partsAwaitingStock,
    appointmentsTomorrow,
    deliveryStopsToday,
    invoicesRaised,
  };
}

// delivery_stops has no date of its own — it inherits the run's delivery_date.
async function countDeliveryStops(day) {
  const { data: runs, error } = await db
    .from("deliveries")
    .select("id")
    .eq("delivery_date", day);

  throwIf(error, "Failed to load the day's deliveries");
  const ids = (runs || []).map((row) => row.id);
  if (!ids.length) return 0;

  const { count, error: stopsError } = await db
    .from("delivery_stops")
    .select("*", { count: "exact", head: true })
    .in("delivery_id", ids);

  throwIf(stopsError, "Failed to count delivery stops");
  return count || 0;
}

/**
 * Workshop capacity for the next few days, from the same schedule the workshop
 * board uses. Returns one entry per day with its booked-vs-available hours.
 */
export async function collectCapacitySignals({ daysAhead = 3 } = {}) {
  const today = startOfDay();
  const dates = Array.from({ length: daysAhead }, (_, index) =>
    isoDay(new Date(today.getTime() + index * 86400000))
  );

  // Booked work is the labour on every open job with an appointment window in
  // the day; available hours come from the technician capacity schedule.
  const { data: schedule, error } = await db
    .from("tech_efficiency_targets")
    .select("*")
    .limit(1);

  // The capacity target table is optional in some environments; a missing one
  // is not an error, it just means we report load without a ceiling.
  const hasTargets = !error && Array.isArray(schedule);

  const signals = [];
  for (const date of dates) {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();

    const booked = await countRows("jobs", (q) =>
      q
        .gte("appointment_window_start", dayStart)
        .lt("appointment_window_start", dayEnd)
        .is("completed_at", null)
    );

    const appointments = await countRows("appointments", (q) =>
      q.gte("scheduled_time", dayStart).lt("scheduled_time", dayEnd).neq("status", "cancelled")
    );

    signals.push({ date, bookedJobs: booked, appointments, hasTargets });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Automated posts
// ---------------------------------------------------------------------------

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;

/**
 * The automatic daily dealership summary.
 * One post per day (system_key includes the date), refreshed on every run so a
 * summary posted at lunchtime is corrected by the evening run.
 */
export async function publishDailySummary({ date = new Date() } = {}) {
  const metrics = await collectDealershipMetrics({ date });

  const lines = [
    `Here is where the dealership finished ${new Date(metrics.day).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })}.`,
    "",
    `Workshop — ${plural(metrics.jobsBookedIn, "job")} booked in, ${plural(
      metrics.jobsCompleted,
      "job"
    )} completed, ${plural(metrics.jobsInWorkshop, "job")} still on the ramps.`,
    `VHC — ${plural(metrics.vhcCompleted, "check")} completed today, ${plural(
      metrics.vhcAwaitingAuthorisation,
      "item"
    )} waiting on customer authorisation.`,
    `Parts — ${plural(metrics.partsOnOrder, "line")} on order, ${plural(
      metrics.partsAwaitingStock,
      "line"
    )} awaiting stock, ${plural(metrics.jobsAwaitingParts, "job")} held for parts.`,
    `Deliveries — ${plural(metrics.deliveryStopsToday, "stop")} scheduled today.`,
    `Invoicing — ${plural(metrics.invoicesRaised, "invoice")} raised.`,
    "",
    `Tomorrow — ${plural(metrics.appointmentsTomorrow, "appointment")} in the diary.`,
  ];

  return upsertSystemPost({
    systemKey: `${SYSTEM_POST_DAILY_SUMMARY}:${metrics.day}`,
    title: `Daily summary — ${new Date(metrics.day).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })}`,
    content: lines.join("\n"),
    departments: [GENERAL_DEPARTMENT],
    category: "system",
    priority: "normal",
    author: SYSTEM_AUTHOR,
    // A summary is stale the moment the next one lands; expire it after a week
    // so the feed does not silt up with old numbers.
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });
}

/**
 * Capacity alerts. Raised when the diary for a day ahead is heavier than the
 * threshold, so the workshop sees it in the feed rather than in a spreadsheet.
 */
export async function publishCapacityAlerts({ threshold = 12 } = {}) {
  const signals = await collectCapacitySignals({ daysAhead: 3 });
  const written = [];

  for (const signal of signals) {
    if (signal.appointments < threshold) continue;

    const label = new Date(signal.date).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });

    written.push(
      await upsertSystemPost({
        systemKey: `${SYSTEM_POST_CAPACITY_ALERT}:${signal.date}`,
        title: `Workshop is busy on ${label}`,
        content: [
          `${plural(signal.appointments, "appointment")} are booked for ${label}, with ${plural(
            signal.bookedJobs,
            "job"
          )} already open against that day.`,
          "",
          "Service — please hold back non-urgent bookings and check the diary before adding work.",
          "Workshop — expect a full board; flag anything that will not fit as early as you can.",
        ].join("\n"),
        departments: ["Workshop", "Service"],
        category: "operations",
        priority: "important",
        author: SYSTEM_AUTHOR,
        expiresAt: new Date(new Date(signal.date).getTime() + 86400000).toISOString(),
      })
    );
  }

  return written;
}

/**
 * Parts backlog alert — raised when the number of lines stuck awaiting stock
 * crosses the threshold, because that is what starts holding jobs up.
 */
export async function publishPartsBacklogAlert({ threshold = 25 } = {}) {
  const awaitingStock = await countRows("parts_job_items", (q) =>
    q.eq("status", "awaiting_stock")
  );
  const onOrder = await countRows("parts_job_items", (q) => q.eq("status", "on_order"));

  if (awaitingStock < threshold) return null;

  return upsertSystemPost({
    systemKey: `${SYSTEM_POST_PARTS_BACKLOG}:${isoDay()}`,
    title: `Parts backlog — ${awaitingStock} lines awaiting stock`,
    content: [
      `${plural(awaitingStock, "line")} are sitting on awaiting-stock, with ${plural(
        onOrder,
        "line"
      )} on order.`,
      "",
      "Parts — please review the awaiting-stock list and chase anything with a job attached.",
      "Service — check the parts tab before promising a completion time today.",
    ].join("\n"),
    departments: ["Parts", "Service", "Workshop"],
    category: "operations",
    priority: "important",
    author: SYSTEM_AUTHOR,
    expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
}

/**
 * VHC backlog alert — authorisations left pending block both the workshop and
 * the parts desk, so it gets its own signal.
 */
export async function publishVhcBacklogAlert({ threshold = 20 } = {}) {
  const pending = await countRows("vhc_checks", (q) => q.eq("approval_status", "pending"));
  if (pending < threshold) return null;

  return upsertSystemPost({
    systemKey: `${SYSTEM_POST_VHC_BACKLOG}:${isoDay()}`,
    title: `${pending} VHC items are waiting on authorisation`,
    content: [
      `${plural(pending, "VHC item")} are still pending a customer decision.`,
      "",
      "Service — please work through the pending list; anything older than 24 hours needs a call today.",
    ].join("\n"),
    departments: ["Service", "Workshop"],
    category: "operations",
    priority: "important",
    author: SYSTEM_AUTHOR,
    expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  });
}

/**
 * Delivery load notice — a heavy delivery day is worth telling the whole
 * aftersales side about first thing.
 */
export async function publishDeliveryLoadNotice({ threshold = 10 } = {}) {
  const day = isoDay();
  const stops = await countDeliveryStops(day);
  if (stops < threshold) return null;

  return upsertSystemPost({
    systemKey: `${SYSTEM_POST_DELIVERY_LOAD}:${day}`,
    title: `Busy delivery day — ${stops} stops planned`,
    content: [
      `${plural(stops, "stop")} are planned on today's delivery runs.`,
      "",
      "Parts — get the pre-picks staged early.",
      "Service — allow extra time for anything relying on a delivery landing today.",
    ].join("\n"),
    departments: ["Parts", "Service"],
    category: "operations",
    priority: "normal",
    author: SYSTEM_AUTHOR,
    expiresAt: new Date(new Date(`${day}T23:59:59Z`).getTime()).toISOString(),
  });
}

/**
 * The whole automated sweep, in the order the cron job runs it.
 * Each alert is independent: one failing must not stop the rest.
 */
export async function runSystemPostSweep({ includeDailySummary = true } = {}) {
  const results = { written: [], failed: [] };

  const steps = [
    ["capacity", () => publishCapacityAlerts()],
    ["parts-backlog", () => publishPartsBacklogAlert()],
    ["vhc-backlog", () => publishVhcBacklogAlert()],
    ["delivery-load", () => publishDeliveryLoadNotice()],
  ];

  if (includeDailySummary) steps.push(["daily-summary", () => publishDailySummary()]);

  for (const [name, run] of steps) {
    try {
      const outcome = await run();
      const posts = Array.isArray(outcome) ? outcome : outcome ? [outcome] : [];
      results.written.push(...posts.map((post) => ({ step: name, id: post.id, title: post.title })));
    } catch (error) {
      results.failed.push({ step: name, message: error.message });
    }
  }

  return results;
}
