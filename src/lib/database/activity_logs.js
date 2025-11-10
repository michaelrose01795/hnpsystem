// file location: src/lib/database/activity_logs.js
import { getDatabaseClient } from "./client"; // Import the shared Supabase client accessor for database operations.

const db = getDatabaseClient(); // Hold a module-level reference to the Supabase client.
const TABLE_NAME = "activity_logs"; // Name of the table defined in codex/database-schema.json.
const LOG_COLUMNS = [ // Canonical column list for selecting consistent shapes.
  "log_id", // Primary key column.
  "user_id", // Optional foreign key pointing to users.user_id.
  "action", // Description of what occurred.
  "table_name", // Name of the table affected by the action.
  "record_id", // Identifier of the affected record, if any.
  "timestamp", // When the action occurred.
].join(", "); // Join the array for Supabase select statements.

const mapLogRow = (row = {}) => ({ // Normalize raw rows into camelCase objects for calling code.
  id: row.log_id, // Provide the primary key as id.
  userId: row.user_id, // Pass through the optional user reference.
  action: row.action, // Pass through the recorded action string.
  tableName: row.table_name, // Pass through the affected table name.
  recordId: row.record_id, // Pass through the optional record id.
  timestamp: row.timestamp, // Pass through the event timestamp.
}); // Close mapper helper.

export const logActivity = async ({ userId = null, action, tableName = null, recordId = null }) => { // Insert a new activity log entry.
  if (!action) { // Ensure action text is supplied.
    throw new Error("logActivity requires an action description."); // Provide descriptive validation feedback.
  } // Close guard.
  const payload = { // Build the row payload in snake_case per schema.
    user_id: userId, // Reference the acting user if available.
    action, // Store the textual description of the action.
    table_name: tableName, // Optionally record the table name.
    record_id: recordId, // Optionally record the affected record id.
    timestamp: new Date().toISOString(), // Capture the current time for the event.
  }; // Close payload object.
  const { data, error } = await db // Execute the insert.
    .from(TABLE_NAME) // Target the activity_logs table.
    .insert([payload]) // Insert exactly one row.
    .select(LOG_COLUMNS) // Return canonical columns.
    .single(); // Expect a single inserted row.
  if (error) { // Handle database errors.
    throw new Error(`Failed to write activity log: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return mapLogRow(data); // Return the inserted row in camelCase format.
}; // End logActivity.

export const getActivityLogs = async ({ limit = 50, tableName, userId } = {}) => { // Fetch a recent slice of activity logs with optional filters.
  let query = db // Start the query builder.
    .from(TABLE_NAME) // Target the activity_logs table.
    .select(LOG_COLUMNS) // Request canonical columns.
    .order("timestamp", { ascending: false }) // Order newest-first for audit feeds.
    .limit(limit); // Limit the number of rows returned.
  if (tableName) { // Apply optional table filter.
    query = query.eq("table_name", tableName); // Filter to the requested table.
  } // Close guard.
  if (typeof userId === "number") { // Apply optional user filter when provided.
    query = query.eq("user_id", userId); // Restrict results to actions performed by the user.
  } // Close guard.
  const { data, error } = await query; // Execute the composed query.
  if (error) { // Handle query failures.
    throw new Error(`Failed to fetch activity logs: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return (data || []).map(mapLogRow); // Return mapped rows.
}; // End getActivityLogs.

export const getActivityLogById = async (logId) => { // Fetch a single log entry by primary key.
  if (typeof logId !== "number") { // Validate the identifier type.
    throw new Error("getActivityLogById requires a numeric logId."); // Provide descriptive validation error.
  } // Close guard.
  const { data, error } = await db // Execute the select query.
    .from(TABLE_NAME) // Target the activity_logs table.
    .select(LOG_COLUMNS) // Request canonical columns.
    .eq("log_id", logId) // Filter by primary key.
    .maybeSingle(); // Expect zero or one row.
  if (error) { // Handle query failures.
    throw new Error(`Failed to fetch activity log ${logId}: ${error.message}`); // Provide diagnostic text.
  } // Close guard.
  return data ? mapLogRow(data) : null; // Return the mapped row or null if not found.
}; // End getActivityLogById.

// This activity log data layer provides typed helpers for recording and retrieving audit events across the platform.
