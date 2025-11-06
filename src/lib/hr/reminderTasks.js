// file location: src/lib/hr/reminderTasks.js

/**
 * Placeholder scheduler hooks for HR reminders.
 *
 * TODO: Replace console-based reminders with Supabase Edge Functions or a cron worker.
 */
export function scheduleTrainingExpiryReminder({ employeeName, courseName, dueDate }) {
  console.info(
    `[HR Reminder] Training expiry reminder queued (mock): ${employeeName} • ${courseName} due ${dueDate}`
  );
}

export function schedulePerformanceReviewReminder({ employeeName, reviewDate }) {
  console.info(
    `[HR Reminder] Performance review reminder queued (mock): ${employeeName} on ${reviewDate}`
  );
}

export function scheduleLeaveReturnReminder({ employeeName, returnDate }) {
  console.info(
    `[HR Reminder] Leave return reminder queued (mock): ${employeeName} returns ${returnDate}`
  );
}

export function registerHrReminderJobs() {
  console.info("[HR Reminder] Placeholder scheduler registered. TODO: wire to real cron service.");
}
