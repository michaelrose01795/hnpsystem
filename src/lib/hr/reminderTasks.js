// file location: src/lib/hr/reminderTasks.js

import { getDatabaseClient } from "@/lib/database/client";

const db = getDatabaseClient();
const REMINDER_TABLE = "hr_reminder_tasks";

const parseRunAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const enqueueReminder = async (type, payload, runAt) => {
  const normalizedRunAt = parseRunAt(runAt);
  if (!normalizedRunAt) {
    throw new Error(`Invalid runAt value provided for ${type} reminder.`);
  }

  const { error } = await db.from(REMINDER_TABLE).insert({
    type,
    payload,
    run_at: normalizedRunAt,
    status: "scheduled",
  });

  if (error) {
    console.error(`❌ Failed to enqueue ${type} reminder`, error);
    throw error;
  }
};

// ⚠️ Mock data found — replacing with Supabase query
// ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
export async function scheduleTrainingExpiryReminder({ employeeName, courseName, dueDate }) {
  await enqueueReminder(
    "training_expiry",
    { employeeName, courseName },
    dueDate
  );
}

export async function schedulePerformanceReviewReminder({ employeeName, reviewDate }) {
  await enqueueReminder(
    "performance_review",
    { employeeName, reviewDate },
    reviewDate
  );
}

export async function scheduleLeaveReturnReminder({ employeeName, returnDate }) {
  await enqueueReminder(
    "leave_return",
    { employeeName, returnDate },
    returnDate
  );
}

export function registerHrReminderJobs() {
  console.info("[HR Reminder] Reminder enqueue hooks registered; Supabase cron should pick them up.");
}
