// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/vhc.js
import { getDatabaseClient } from "@/lib/database/client"; // Import the shared Supabase client accessor to query VHC-related tables.

const db = getDatabaseClient(); // Cache the Supabase client so every function can reuse it.
const CHECKS_TABLE = "vhc_checks"; // Table storing individual VHC findings.
const WORKFLOW_TABLE = "vhc_workflow_status"; // Table summarizing per-job VHC workflow metrics.
const SEND_HISTORY_TABLE = "vhc_send_history"; // Table logging each time VHC results are sent to customers.
const JOBS_TABLE = "jobs"; // Jobs table used for resolving identifiers.


const DECLINATIONS_TABLE = "vhc_declinations"; // Table capturing declinations recorded against VHC recommendations.
const DECLINATION_COLUMNS = [ // Canonical column list for vhc_declinations.
  "id", // Primary key for the declination row.
  "job_id", // Foreign key referencing jobs.id.
  "declined_by", // Staff member or identifier that captured the declination.
  "customer_notes", // Optional notes supplied by the customer.
  "declined_at", // Timestamp when the declination was recorded.
  "created_at", // Timestamp when the record was inserted.
].join(", "); // Join for Supabase selects.

const mapDeclinationRow = (row = {}) => ({ // Normalise declination rows into camelCase objects.
  id: row.id, // Primary key value.
  jobId: row.job_id, // Job reference.
  declinedBy: row.declined_by, // Staff identifier.
  customerNotes: row.customer_notes, // Customer-facing notes.
  declinedAt: row.declined_at, // Timestamp when the declination was recorded.
  createdAt: row.created_at, // Creation timestamp.
}); // Close mapper helper.

const CHECK_COLUMNS = [ // Canonical column list for vhc_checks.
  "vhc_id", // Primary key for each check item.
  "job_id", // Foreign key referencing jobs.id.
  "section", // Section of the vehicle (e.g., Brakes, Tyres).
  "issue_title", // Short title describing the issue.
  "issue_description", // Longer description of the issue.
  "measurement", // Optional measurement captured during inspection.
  "approval_status", // Decision status for the VHC item.
  "display_status", // UI status override for the VHC item.
  "labour_hours", // Estimated labour hours for the item.
  "parts_cost", // Estimated parts cost for the item.
  "total_override", // Manual total override.
  "labour_complete", // Whether labour is complete.
  "parts_complete", // Whether parts work is complete.
  "approved_at", // Timestamp when item was approved.
  "approved_by", // Who approved the item.
  "authorization_state", // State of authorization.
  "severity", // Severity rating (red, amber, green).
  "slot_code", // Identity helper for deduplication.
  "line_key", // Identity key for deduplication.
  "note_text", // Additional notes (absorbed from vhc_authorized_items).
  "pre_pick_location", // Pre-pick warehouse location (absorbed from vhc_authorized_items).
  "request_id", // Associated job request (absorbed from vhc_authorized_items).
  "display_id", // User-facing identifier (absorbed from vhc_item_aliases).
  "created_at", // Timestamp when the record was created.
  "updated_at", // Timestamp when the record was last updated.
].join(", "); // Join the columns for Supabase select statements.

const WORKFLOW_COLUMNS = [ // Canonical column list for vhc_workflow_status.
  "job_id", // Foreign key referencing jobs.id.
  "job_number", // Cached job number for reporting.
  "vehicle_reg", // Cached vehicle registration for reporting.
  "status", // Current VHC workflow status.
  "vhc_required", // Boolean indicating if a VHC is required.
  "vhc_checks_count", // Total checks recorded for the job.
  "last_sent_at", // Timestamp when VHC last sent to the customer.
  "authorization_count", // Number of authorized upsell items.
  "declination_count", // Number of declined upsell items.
  "vhc_completed_at", // Timestamp when VHC was completed.
  "vhc_sent_at", // Timestamp when VHC report was sent.
].join(", "); // Join columns for selects.

const SEND_HISTORY_COLUMNS = [ // Canonical column list for vhc_send_history.
  "id", // Primary key of the send history row.
  "job_id", // Job foreign key.
  "sent_by", // Staff member name or identifier.
  "sent_at", // Timestamp when message was sent.
  "send_method", // Method used (email, sms, etc.).
  "customer_email", // Email address used.
  "created_at", // Timestamp when the log row was created.
].join(", "); // Join columns for selects.

const mapCheckRow = (row = {}) => { // Convert snake_case database row into camelCase object.
  let structuredData = null;
  const candidate = row.issue_description;

  // Try to parse JSON from issue_description (for VHC checksheet data)
  if (candidate) {
    try {
      const parsed = typeof candidate === "string" ? JSON.parse(candidate) : candidate;
      if (parsed && typeof parsed === "object") {
        structuredData = parsed;
      }
    } catch (_err) {
      // Ignore parse errors – some legacy rows store plain text
    }
  }

  return {
    id: row.vhc_id, // Primary key value.
    vhcId: row.vhc_id, // Alias for compatibility with authorized items consumers.
    jobId: row.job_id, // Job reference.
    section: row.section, // Section label.
    issueTitle: row.issue_title, // Issue title text.
    issueDescription: row.issue_description, // Issue description text (raw).
    data: structuredData, // Parsed JSON data if available.
    measurement: row.measurement, // Optional measurement.
    approvalStatus: row.approval_status, // Approval status.
    displayStatus: row.display_status, // Display status override.
    labourHours: row.labour_hours, // Estimated labour hours.
    partsCost: row.parts_cost, // Estimated parts cost.
    totalOverride: row.total_override, // Manual total override.
    labourComplete: row.labour_complete, // Whether labour is complete.
    partsComplete: row.parts_complete, // Whether parts work is complete.
    approvedAt: row.approved_at, // Approval timestamp.
    approvedBy: row.approved_by, // Who approved the item.
    authorizationState: row.authorization_state, // Authorization state.
    severity: row.severity, // Severity rating.
    slotCode: row.slot_code, // Identity helper for deduplication.
    lineKey: row.line_key, // Identity key for deduplication.
    noteText: row.note_text, // Additional notes.
    prePickLocation: row.pre_pick_location, // Pre-pick warehouse location.
    requestId: row.request_id, // Associated job request ID.
    displayId: row.display_id, // User-facing identifier.
    createdAt: row.created_at, // Creation timestamp.
    updatedAt: row.updated_at, // Update timestamp.
  };
}; // Close mapper helper.

const mapWorkflowRow = (row = {}) => ({ // Normalize workflow summary rows.
  jobId: row.job_id, // Job reference.
  jobNumber: row.job_number, // Cached job number.
  vehicleReg: row.vehicle_reg, // Vehicle registration string.
  status: row.status, // Current workflow status.
  vhcRequired: row.vhc_required, // Whether VHC required.
  vhcChecksCount: row.vhc_checks_count, // Count of recorded checks.
  lastSentAt: row.last_sent_at, // Timestamp for last send.
  authorizationCount: row.authorization_count, // Number of approvals.
  declinationCount: row.declination_count, // Number of declines.
  vhcCompletedAt: row.vhc_completed_at, // Completion timestamp.
  vhcSentAt: row.vhc_sent_at, // Delivery timestamp.
}); // Close mapper helper.

const mapSendHistoryRow = (row = {}) => ({ // Normalize send history rows.
  id: row.id, // Primary key.
  jobId: row.job_id, // Job reference.
  sentBy: row.sent_by, // Staff member identifier.
  sentAt: row.sent_at, // Timestamp of send.
  sendMethod: row.send_method, // Method used.
  customerEmail: row.customer_email, // Recipient email.
  createdAt: row.created_at, // Log creation timestamp.
}); // Close mapper helper.

const resolveJobId = async (jobIdentifier) => { // Normalise job identifiers into numeric jobs.id keys.
  if (typeof jobIdentifier === "number" && Number.isInteger(jobIdentifier)) { // Already a numeric id.
    return jobIdentifier;
  }
  if (typeof jobIdentifier === "string" && jobIdentifier.trim().length > 0) { // Could be a job number string.
    const trimmed = jobIdentifier.trim();
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isInteger(parsed)) { // Handle numeric strings like "12".
      return parsed;
    }
    const { data, error } = await db
      .from(JOBS_TABLE)
      .select("id")
      .eq("job_number", trimmed)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to resolve job number ${trimmed}: ${error.message}`);
    }
    return data?.id ?? null;
  }
  return null;
};

export const listVhcChecks = async ({ jobId, jobNumber, limit = 100, offset = 0 } = {}) => { // Fetch VHC checks optionally scoped to a job.
  let resolvedJobId = jobId;
  if (typeof resolvedJobId !== "number" && jobNumber) { // Allow callers to pass job numbers directly.
    resolvedJobId = await resolveJobId(jobNumber);
  }
  let query = db // Build Supabase query.
    .from(CHECKS_TABLE) // Target the vhc_checks table.
    .select(CHECK_COLUMNS, { count: "exact" }) // Fetch canonical columns and a total count for pagination.
    .order("created_at", { ascending: false }) // Order newest first unless overridden.
    .range(offset, offset + limit - 1); // Apply pagination slice.
  if (typeof resolvedJobId === "number") { // Apply optional job filter when provided.
    query = query.eq("job_id", resolvedJobId); // Restrict results to the job.
  } // Close guard.
  const { data, error, count } = await query; // Execute query and collect metadata.
  if (error) { // Handle database errors.
    throw new Error(`Failed to load VHC checks: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return { // Return rows plus total count.
    rows: (data || []).map(mapCheckRow), // Map rows to camelCase objects.
    total: count ?? 0, // Provide the total count, defaulting to zero if null.
  }; // Close return payload.
}; // End listVhcChecks.

export const getVhcChecksByJob = async (jobIdentifier) => { // Fetch all VHC checks for a single job ordered chronologically.
  const resolvedJobId = await resolveJobId(jobIdentifier);
  if (typeof resolvedJobId !== "number") { // Validate presence and type.
    throw new Error("getVhcChecksByJob requires a numeric jobId."); // Provide descriptive validation error.
  } // Close guard.
  const { data, error } = await db // Execute select query.
    .from(CHECKS_TABLE) // Target vhc_checks.
    .select(CHECK_COLUMNS) // Fetch canonical columns.
    .eq("job_id", resolvedJobId) // Restrict to requested job.
    .order("created_at", { ascending: true }); // Order oldest first for timeline views.
  if (error) { // Handle errors.
    throw new Error(`Failed to load VHC checks for job ${resolvedJobId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return (data || []).map(mapCheckRow); // Return mapped rows.
}; // End getVhcChecksByJob.

export const createVhcCheck = async (payload) => { // Insert a new VHC check row.
  const required = ["job_id", "section", "issue_title"]; // Schema requires job_id, section, and issue_title.
  const missing = required.filter((field) => !payload?.[field]); // Determine missing values.
  if (missing.length) { // Throw if payload incomplete.
    throw new Error(`Missing required VHC check fields: ${missing.join(", ")}`); // Provide descriptive validation error.
  } // Close guard.
  const { data, error } = await db // Execute insert.
    .from(CHECKS_TABLE) // Target vhc_checks.
    .insert([payload]) // Insert the provided payload.
    .select(CHECK_COLUMNS) // Return canonical columns.
    .single(); // Expect exactly one row back.
  if (error) { // Handle insert failure.
    throw new Error(`Failed to create VHC check: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapCheckRow(data); // Return inserted row.
}; // End createVhcCheck.

export const updateVhcCheck = async (vhcId, updates = {}) => { // Update an existing VHC check row.
  if (typeof vhcId !== "number") { // Validate identifier type.
    throw new Error("updateVhcCheck requires a numeric vhcId."); // Provide validation error.
  } // Close guard.
  if (Object.keys(updates).length === 0) { // Prevent empty updates.
    throw new Error("updateVhcCheck requires at least one field to update."); // Provide descriptive feedback.
  } // Close guard.
  const { data, error } = await db // Execute update.
    .from(CHECKS_TABLE) // Target vhc_checks.
    .update({ ...updates, updated_at: new Date().toISOString() }) // Apply updates and touch updated_at for auditing.
    .eq("vhc_id", vhcId) // Restrict to the requested row.
    .select(CHECK_COLUMNS) // Return canonical columns.
    .single(); // Expect one updated row.
  if (error) { // Handle update failures.
    throw new Error(`Failed to update VHC check ${vhcId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapCheckRow(data); // Return updated row.
}; // End updateVhcCheck.

export const deleteVhcCheck = async (vhcId) => { // Delete a VHC check row.
  if (typeof vhcId !== "number") { // Validate identifier type.
    throw new Error("deleteVhcCheck requires a numeric vhcId."); // Provide validation error.
  } // Close guard.
  const { error } = await db // Execute delete.
    .from(CHECKS_TABLE) // Target vhc_checks.
    .delete() // Perform deletion.
    .eq("vhc_id", vhcId); // Restrict to requested row.
  if (error) { // Handle failure.
    throw new Error(`Failed to delete VHC check ${vhcId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return { success: true, deletedId: vhcId }; // Return acknowledgement payload.
}; // End deleteVhcCheck.

export const getVhcWorkflowStatus = async (jobId) => { // Fetch VHC workflow summary for a job.
  if (typeof jobId !== "number") { // Validate identifier.
    throw new Error("getVhcWorkflowStatus requires a numeric jobId."); // Provide validation error.
  } // Close guard.
  const { data, error } = await db // Execute select.
    .from(WORKFLOW_TABLE) // Target workflow table.
    .select(WORKFLOW_COLUMNS) // Fetch canonical columns.
    .eq("job_id", jobId) // Restrict to job.
    .maybeSingle(); // Expect zero or one row.
  if (error) { // Handle errors.
    throw new Error(`Failed to load VHC workflow for job ${jobId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return data ? mapWorkflowRow(data) : null; // Return mapped row or null.
}; // End getVhcWorkflowStatus.

export const upsertVhcWorkflowStatus = async (payload) => { // Insert or update workflow summary row keyed by job_id.
  if (typeof payload?.job_id !== "number") { // Validate presence of job_id for the upsert relation.
    throw new Error("upsertVhcWorkflowStatus requires payload.job_id as a number."); // Provide validation error.
  } // Close guard.
  const { data, error } = await db // Execute upsert.
    .from(WORKFLOW_TABLE) // Target workflow table.
    .upsert(payload, { onConflict: "job_id" }) // Upsert on job_id unique constraint.
    .select(WORKFLOW_COLUMNS) // Return canonical columns.
    .single(); // Expect a single row (inserted or updated).
  if (error) { // Handle failure.
    throw new Error(`Failed to upsert VHC workflow status: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapWorkflowRow(data); // Return normalized row.
}; // End upsertVhcWorkflowStatus.

export const logVhcSendEvent = async ({ jobId, sentBy, sendMethod = "email", customerEmail = null }) => { // Insert a send-history record whenever VHC is shared with a customer.
  if (typeof jobId !== "number") { // Validate required job reference.
    throw new Error("logVhcSendEvent requires a numeric jobId."); // Provide validation error.
  } // Close guard.
  if (!sentBy) { // Ensure the actor is recorded.
    throw new Error("logVhcSendEvent requires a sentBy string."); // Provide validation error.
  } // Close guard.
  const payload = { // Build the insert payload in snake_case.
    job_id: jobId, // Job reference.
    sent_by: sentBy, // Staff identifier.
    send_method: sendMethod, // Delivery method.
    customer_email: customerEmail, // Recipient email if available.
    sent_at: new Date().toISOString(), // When the send occurred.
  }; // Close payload.
  const { data, error } = await db // Execute insert.
    .from(SEND_HISTORY_TABLE) // Target send history table.
    .insert([payload]) // Insert payload row.
    .select(SEND_HISTORY_COLUMNS) // Return canonical columns.
    .single(); // Expect one row.
  if (error) { // Handle insert failure.
    throw new Error(`Failed to log VHC send event: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapSendHistoryRow(data); // Return inserted row.
}; // End logVhcSendEvent.


export const createDeclination = async ({ job_id, jobId, declined_by, declinedBy, customer_notes, customerNotes }) => { // Insert a declination entry for a VHC job.
  const resolvedJobId = typeof job_id === 'number' ? job_id : jobId; // Prefer numeric snake_case value when provided.
  const resolvedDeclinedBy = declined_by ?? declinedBy; // Allow both casing variations for declined_by.
  const resolvedNotes = customer_notes ?? customerNotes ?? null; // Optional notes.
  if (typeof resolvedJobId !== 'number') { // Validate job id type.
    throw new Error('createDeclination requires a numeric job_id.'); // Provide validation feedback.
  } // Close guard.
  if (!resolvedDeclinedBy || typeof resolvedDeclinedBy !== 'string') { // Validate actor string.
    throw new Error('createDeclination requires declined_by.'); // Provide validation feedback.
  } // Close guard.
  const payload = { // Build snake_case insert payload.
    job_id: resolvedJobId, // Persist job reference.
    declined_by: resolvedDeclinedBy, // Persist actor identifier.
    customer_notes: resolvedNotes, // Persist optional notes.
  }; // Close payload.
  const { data, error } = await db // Execute insert.
    .from(DECLINATIONS_TABLE) // Target declinations table.
    .insert([payload]) // Insert payload row.
    .select(DECLINATION_COLUMNS) // Return canonical columns.
    .single(); // Expect one inserted row.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to record VHC declination: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapDeclinationRow(data); // Return mapped row.
}; // End createDeclination.

export const getVhcSendHistory = async (jobId) => { // Fetch all send-history entries for a job.
  if (typeof jobId !== "number") { // Validate identifier.
    throw new Error("getVhcSendHistory requires a numeric jobId."); // Provide validation error.
  } // Close guard.
  const { data, error } = await db // Execute select.
    .from(SEND_HISTORY_TABLE) // Target send history table.
    .select(SEND_HISTORY_COLUMNS) // Fetch canonical columns.
    .eq("job_id", jobId) // Restrict to job.
    .order("sent_at", { ascending: false }); // Order newest first.
  if (error) { // Handle failure.
    throw new Error(`Failed to load VHC send history for job ${jobId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return (data || []).map(mapSendHistoryRow); // Return mapped rows.
}; // End getVhcSendHistory.

// This VHC data layer now exposes schema-faithful helpers for reading and mutating checks, workflow status, and send history records.
export const createVHCCheck = async (payload) => {
  try {
    const data = await createVhcCheck(payload); // Reuse the camelCase helper for insertion
    return { success: true, data }; // Provide a success wrapper for API usage
  } catch (error) {
    console.error("createVHCCheck error", error);
    return { success: false, error: error instanceof Error ? error.message : error };
  }
};

export const getVHCChecksByJob = async (jobId) => {
  try {
    const data = await getVhcChecksByJob(jobId); // Load raw check rows for the requested job
    return data; // Return the array directly for existing callers
  } catch (error) {
    console.error("getVHCChecksByJob error", error);
    throw error; // Preserve existing error behaviour so callers can handle failures
  }
};
