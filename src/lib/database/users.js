// file location: src/lib/database/users.js
import { getDatabaseClient } from "./client"; // Import the shared Supabase client accessor so every query reuses the same connection.

const db = getDatabaseClient(); // Instantiate a reusable client reference for this module.
const USERS_TABLE = "users"; // Declare the exact table name to avoid hard-coded strings throughout the file.
const USER_COLUMNS = [ // Enumerate every column required by the schema for consistent selects.
  "user_id", // Primary key for referencing users elsewhere.
  "first_name", // Required first name column per schema.
  "last_name", // Required last name column per schema.
  "email", // Unique user email for logins and notifications.
  "password_hash", // Securely stored password hash for authentication.
  "role", // Application role such as Admin, Tech, etc.
  "phone", // Optional contact number for staff.
  "created_at", // Timestamp for auditing when the user was created.
  "updated_at", // Timestamp for auditing when the user was last modified.
].join(", "); // Combine the column list into a comma-separated string for Supabase select calls.

const mapUserRow = (row = {}) => ({ // Normalize returned rows into a predictable object shape.
  id: row.user_id, // Expose the numeric primary key as a friendly id field.
  firstName: row.first_name, // Surface the first name using camelCase for JS consumers.
  lastName: row.last_name, // Surface the last name using camelCase for JS consumers.
  email: row.email, // Pass through the stored email.
  role: row.role, // Pass through the stored application role.
  phone: row.phone, // Pass through optional phone value.
  passwordHash: row.password_hash, // Provide access to the hashed password when needed server-side.
  createdAt: row.created_at, // Include creation timestamp for audit displays.
  updatedAt: row.updated_at, // Include update timestamp for audit displays.
}); // Close the mapper helper so every exported function can reuse it.

const ensureUserPayload = (payload = {}) => { // Validate that required fields exist before insert/update operations.
  const requiredFields = ["first_name", "last_name", "email", "password_hash", "role"]; // Define schema-mandated fields that cannot be null.
  const missing = requiredFields.filter((field) => !payload[field]); // Collect any required fields that lack truthy values.
  if (missing.length) { // If validation found gaps, throw immediately.
    throw new Error(`Missing required user fields: ${missing.join(", ")}`); // Provide a clear error listing the missing keys.
  } // Close validation guard.
}; // Finish helper definition.

export const getAllUsers = async () => { // Retrieve every user row ordered by primary key.
  const { data, error } = await db // Execute the query using the shared client.
    .from(USERS_TABLE) // Target the users table defined above.
    .select(USER_COLUMNS) // Pull the canonical column set so consumers get consistent shapes.
    .order("user_id", { ascending: true }); // Order results to keep output deterministic.
  if (error) { // Check for database-level errors.
    throw new Error(`Failed to fetch users: ${error.message}`); // Surface descriptive error upstream for handling.
  } // Close error guard.
  return (data || []).map(mapUserRow); // Map each raw row into the normalized JS-friendly shape.
}; // End getAllUsers.

export const getUserById = async (userId) => { // Retrieve a single user by numeric identifier.
  if (typeof userId !== "number") { // Validate the input because the column is integer-based.
    throw new Error("getUserById requires a numeric userId."); // Fail early with helpful context.
  } // Close validation guard.
  const { data, error } = await db // Run a filtered select query.
    .from(USERS_TABLE) // Target the users table.
    .select(USER_COLUMNS) // Fetch the canonical column list.
    .eq("user_id", userId) // Apply the equality filter to primary key.
    .maybeSingle(); // Request at most one row to reduce payload size.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to fetch user ${userId}: ${error.message}`); // Provide context-rich error text.
  } // Close error guard.
  return data ? mapUserRow(data) : null; // Return a mapped user or null when not found.
}; // End getUserById.

export const createUser = async (payload) => { // Insert a brand-new user using validated payload.
  ensureUserPayload(payload); // Verify required fields exist before hitting the database.
  const { data, error } = await db // Execute an insert with returning clause.
    .from(USERS_TABLE) // Target the users table.
    .insert([payload]) // Insert a single row using the provided payload.
    .select(USER_COLUMNS) // Request the canonical columns in the returning row.
    .single(); // Expect exactly one row back from the insert.
  if (error) { // Inspect for insert failures.
    throw new Error(`Failed to create user: ${error.message}`); // Raise descriptive error for upstream handling.
  } // Close error guard.
  return mapUserRow(data); // Return the inserted row using the normalized mapper.
}; // End createUser.

export const updateUser = async (userId, updates = {}) => { // Update an existing user by primary key.
  if (typeof userId !== "number") { // Ensure the identifier is valid.
    throw new Error("updateUser requires a numeric userId."); // Provide guidance for callers.
  } // Close validation guard.
  if (Object.keys(updates).length === 0) { // Disallow empty update payloads to reduce accidental writes.
    throw new Error("updateUser requires at least one field to update."); // Inform the caller about the contract.
  } // Close empty payload guard.
  const { data, error } = await db // Execute the update statement.
    .from(USERS_TABLE) // Target the users table.
    .update(updates) // Apply the provided updates directly to the row.
    .eq("user_id", userId) // Scope the update to the requested record.
    .select(USER_COLUMNS) // Return the canonical column set after the update.
    .single(); // Expect exactly one updated row back.
  if (error) { // Check whether the update failed.
    throw new Error(`Failed to update user ${userId}: ${error.message}`); // Provide explicit error text for observability.
  } // Close error guard.
  return mapUserRow(data); // Return the updated row in normalized form.
}; // End updateUser.

export const deleteUser = async (userId) => { // Permanently remove a user row by primary key.
  if (typeof userId !== "number") { // Validate the identifier before mutating data.
    throw new Error("deleteUser requires a numeric userId."); // Warn the caller about incorrect usage.
  } // Close validation guard.
  const { error } = await db // Execute the delete query.
    .from(USERS_TABLE) // Target the users table for deletion.
    .delete() // Issue the delete command.
    .eq("user_id", userId); // Restrict the delete to the specified primary key.
  if (error) { // Capture any failure from Supabase.
    throw new Error(`Failed to delete user ${userId}: ${error.message}`); // Provide descriptive diagnostic text.
  } // Close error guard.
  return { success: true, deletedId: userId }; // Return a simple acknowledgement payload.
}; // End deleteUser.

// This users data-access layer exposes validated CRUD helpers backed by the Supabase users table.
