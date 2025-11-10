// file location: src/lib/database/jobClocking.js
import { getDatabaseClient } from "./client"; // Import the shared Supabase client accessor to talk to the job_clocking table.

const db = getDatabaseClient(); // Hold a module-scoped reference to the Supabase client for reuse.
const TABLE_NAME = "job_clocking"; // Store the exact table name defined in the schema for clarity.
const CLOCKING_COLUMNS = [ // Enumerate every column we read from the job_clocking table.
  "id", // Primary key for each clocking entry.
  "user_id", // Foreign key referencing users.user_id.
  "job_id", // Foreign key referencing jobs.id.
  "job_number", // Human-readable job number string captured at clock-in time.
  "clock_in", // Timestamp when the technician clocked in.
  "clock_out", // Nullable timestamp when the technician clocked out.
  "work_type", // Text flag to differentiate initial vs additional work.
  "created_at", // Timestamp when the clocking row was created.
  "updated_at", // Timestamp when the row was last updated.
].join(", "); // Combine the column names for Supabase select statements.

const mapClockingRow = (row = {}) => ({ // Normalize raw database rows to camelCase keys for the UI layer.
  id: row.id, // Include the primary key for referencing or deleting.
  userId: row.user_id, // Surface the user foreign key.
  jobId: row.job_id, // Surface the job foreign key.
  jobNumber: row.job_number, // Provide the display-friendly job number.
  clockIn: row.clock_in, // Expose the clock-in timestamp.
  clockOut: row.clock_out, // Expose the optional clock-out timestamp.
  workType: row.work_type, // Provide the work type description.
  createdAt: row.created_at, // Include auditing metadata.
  updatedAt: row.updated_at, // Include auditing metadata.
}); // Close mapper helper.

const assertInteger = (value, fieldName) => { // Validate integer identifiers before hitting the database.
  if (typeof value !== "number" || !Number.isInteger(value)) { // Ensure the value is an integer.
    throw new Error(`${fieldName} must be an integer.`); // Throw descriptive error when validation fails.
  } // Close guard.
}; // End helper.

export const clockInToJob = async ({ userId, jobId, jobNumber, workType = "initial" }) => { // Create a new clock-in entry for a technician.
  assertInteger(userId, "userId"); // Validate the user reference.
  assertInteger(jobId, "jobId"); // Validate the job reference.
  if (!jobNumber) { // job_number is defined as NOT NULL so enforce it.
    throw new Error("clockInToJob requires a jobNumber string."); // Provide actionable error.
  } // Close guard.
  const payload = { // Build the insert payload using schema column names.
    user_id: userId, // Map userId to the column.
    job_id: jobId, // Map jobId to the column.
    job_number: jobNumber, // Persist the job number snapshot.
    work_type: workType || "initial", // Persist the work type, defaulting to initial.
    clock_in: new Date().toISOString(), // Record the current timestamp for clock_in.
  }; // Close payload object.
  const { data, error } = await db // Execute the insert via Supabase.
    .from(TABLE_NAME) // Target the job_clocking table.
    .insert([payload]) // Insert the single payload row.
    .select(CLOCKING_COLUMNS) // Request canonical columns in the return value.
    .single(); // Expect exactly one inserted row.
  if (error) { // Handle database insert errors.
    throw new Error(`Failed to clock in to job ${jobNumber}: ${error.message}`); // Provide descriptive error text.
  } // Close guard.
  return mapClockingRow(data); // Return the inserted entry in camelCase form.
}; // End clockInToJob.

export const clockOutFromJob = async (clockingId) => { // Close an active clocking entry by setting clock_out.
  assertInteger(clockingId, "clockingId"); // Validate the primary key argument.
  const clockOutTimestamp = new Date().toISOString(); // Capture the clock-out time once for consistency.
  const { data, error } = await db // Execute the update via Supabase.
    .from(TABLE_NAME) // Target the job_clocking table.
    .update({ clock_out: clockOutTimestamp, updated_at: clockOutTimestamp }) // Set both clock_out and updated_at.
    .eq("id", clockingId) // Restrict the update to the requested entry.
    .select(CLOCKING_COLUMNS) // Return canonical columns.
    .single(); // Expect a single updated row.
  if (error) { // Handle update failures.
    throw new Error(`Failed to clock out entry ${clockingId}: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return mapClockingRow(data); // Return the updated entry to the caller.
}; // End clockOutFromJob.

export const getUserActiveJobs = async (userId) => { // Fetch all active (clock_out IS NULL) entries for a user.
  assertInteger(userId, "userId"); // Validate the user identifier.
  const { data, error } = await db // Execute the select query.
    .from(TABLE_NAME) // Target the job_clocking table.
    .select(CLOCKING_COLUMNS) // Request canonical columns.
    .eq("user_id", userId) // Filter by the specified user.
    .is("clock_out", null) // Restrict to active clock-ins.
    .order("clock_in", { ascending: false }); // Order newest first for UI convenience.
  if (error) { // Handle query failures.
    throw new Error(`Failed to load active jobs for user ${userId}: ${error.message}`); // Provide descriptive error text.
  } // Close guard.
  return (data || []).map(mapClockingRow); // Return mapped rows.
}; // End getUserActiveJobs.

export const getJobClockingEntries = async (jobId) => { // Fetch every clocking entry associated with a job.
  assertInteger(jobId, "jobId"); // Validate the job identifier.
  const { data, error } = await db // Execute the select query.
    .from(TABLE_NAME) // Target the job_clocking table.
    .select(CLOCKING_COLUMNS) // Request canonical columns.
    .eq("job_id", jobId) // Filter by the specified job.
    .order("clock_in", { ascending: true }); // Order chronologically for reporting.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to load clocking entries for job ${jobId}: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return (data || []).map(mapClockingRow); // Return mapped rows.
}; // End getJobClockingEntries.

export const deleteClockingEntry = async (clockingId) => { // Permanently delete a clocking entry (admin only use-case).
  assertInteger(clockingId, "clockingId"); // Validate the primary key.
  const { error } = await db // Execute the delete statement.
    .from(TABLE_NAME) // Target the job_clocking table.
    .delete() // Perform the deletion.
    .eq("id", clockingId); // Scope to the requested entry.
  if (error) { // Handle delete failures.
    throw new Error(`Failed to delete clocking entry ${clockingId}: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return { success: true, deletedId: clockingId }; // Return a simple acknowledgement payload.
}; // End deleteClockingEntry.

// This job clocking data layer now exposes minimal, schema-accurate helpers for clocking technicians in/out and reporting their activity.
