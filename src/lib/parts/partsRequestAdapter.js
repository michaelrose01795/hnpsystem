// file location: src/lib/parts/partsRequestAdapter.js
// Adapter layer bridging parts_requests (tech request inbox) and parts_job_items (allocation table).
// Ensures both tables stay linked and status-synced without breaking existing consumers.

import { supabase } from "@/lib/supabaseClient"; // Shared Supabase client.

// ---------------------------------------------------------------------------
// Status mapping: parts_requests status → parts_job_items status
// ---------------------------------------------------------------------------

const REQUEST_TO_JOB_ITEM_STATUS = { // Maps legacy request statuses to job-item statuses.
  pending: "pending", // Not yet reviewed.
  waiting_authorisation: "waiting_authorisation", // Tech submitted, awaiting parts team.
  ordered: "on_order", // Parts team ordered the part.
  allocated: "allocated", // Part allocated from stock.
  fulfilled: "fitted", // Part fitted to vehicle.
  cancelled: "cancelled", // Request cancelled.
};

const JOB_ITEM_TO_REQUEST_STATUS = { // Reverse map: job-item status → request status.
  pending: "pending", // Not started.
  waiting_authorisation: "waiting_authorisation", // Awaiting approval.
  awaiting_stock: "ordered", // Waiting for stock.
  on_order: "ordered", // Ordered from supplier.
  booked: "allocated", // Stock booked.
  allocated: "allocated", // Stock allocated.
  pre_picked: "allocated", // Pre-picked from warehouse.
  picked: "allocated", // Picked for fitting.
  stock: "allocated", // In stock ready.
  fitted: "fulfilled", // Fitted to vehicle.
  cancelled: "cancelled", // Cancelled.
  removed: "cancelled", // Removed from job.
};

// ---------------------------------------------------------------------------
// Shared helper: build VHC row description (extracted from duplicated code)
// ---------------------------------------------------------------------------

export const buildVhcRowDescription = async ({ jobId, vhcItemId }) => { // Build description string from VHC check fields.
  if (!jobId || !Number.isInteger(vhcItemId)) return null; // Guard: need both identifiers.

  const { data: checkRow, error } = await supabase // Fetch VHC check row.
    .from("vhc_checks")
    .select("section, issue_title, issue_description, measurement, note_text")
    .eq("job_id", jobId)
    .eq("vhc_id", vhcItemId)
    .maybeSingle();

  if (error) { // Propagate DB errors.
    throw new Error(`Failed to fetch VHC row ${vhcItemId}: ${error.message}`);
  }
  if (!checkRow) return null; // No matching VHC check.

  const raw = [ // Concatenate all available description fields.
    checkRow.section,
    checkRow.issue_title,
    checkRow.issue_description,
    checkRow.measurement,
    checkRow.note_text,
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .join(" ");

  const compact = raw.replace(/\s+/g, " ").trim(); // Collapse whitespace.
  return compact || null; // Return null if empty.
};

// ---------------------------------------------------------------------------
// Core: Link a parts_request to a parts_job_items allocation
// ---------------------------------------------------------------------------

/**
 * After a parts_job_items row is created to fulfill a tech request,
 * call this to wire up the bidirectional link and sync statuses.
 *
 * @param {object} params
 * @param {string} params.jobItemId   - UUID of the new parts_job_items row
 * @param {number} params.requestId   - Integer request_id from parts_requests
 * @returns {object} { success, error }
 */
export const linkRequestToJobItem = async ({ jobItemId, requestId }) => { // Wire both FK columns.
  if (!jobItemId || !requestId) { // Guard: both IDs required.
    return { success: false, error: "jobItemId and requestId are required" };
  }

  const now = new Date().toISOString(); // Timestamp for both updates.

  // 1. Set source_request_id on the parts_job_items row
  const { error: jobItemError } = await supabase // Update the allocation row.
    .from("parts_job_items")
    .update({ source_request_id: requestId, updated_at: now })
    .eq("id", jobItemId);

  if (jobItemError) { // Log but continue — the link is best-effort.
    console.error("[partsRequestAdapter] Failed to set source_request_id:", jobItemError.message);
    return { success: false, error: jobItemError.message };
  }

  // 2. Set fulfilled_by on the parts_requests row
  const { error: requestError } = await supabase // Update the request row.
    .from("parts_requests")
    .update({ fulfilled_by: jobItemId, updated_at: now })
    .eq("request_id", requestId);

  if (requestError) { // Log but don't fail — allocation already linked.
    console.error("[partsRequestAdapter] Failed to set fulfilled_by:", requestError.message);
  }

  return { success: true, error: null };
};

// ---------------------------------------------------------------------------
// Core: Sync parts_requests.status when parts_job_items.status changes
// ---------------------------------------------------------------------------

/**
 * Call after any parts_job_items status update to keep the linked
 * parts_requests row in sync.
 *
 * @param {object} params
 * @param {string} params.jobItemId       - UUID of the parts_job_items row
 * @param {string} params.newJobItemStatus - The new status on parts_job_items
 * @returns {object} { success, updated }
 */
export const syncRequestStatus = async ({ jobItemId, newJobItemStatus }) => { // Sync request status from job-item status.
  if (!jobItemId || !newJobItemStatus) { // Guard: need both values.
    return { success: false, updated: false };
  }

  // Find the linked request via source_request_id
  const { data: jobItem, error: fetchError } = await supabase // Load the job-item to get source_request_id.
    .from("parts_job_items")
    .select("source_request_id")
    .eq("id", jobItemId)
    .maybeSingle();

  if (fetchError || !jobItem?.source_request_id) { // No linked request — nothing to sync.
    return { success: true, updated: false };
  }

  const mappedStatus = JOB_ITEM_TO_REQUEST_STATUS[newJobItemStatus]; // Map to request status.
  if (!mappedStatus) { // Unknown status — skip sync.
    return { success: true, updated: false };
  }

  const { error: updateError } = await supabase // Update the request's status.
    .from("parts_requests")
    .update({ status: mappedStatus, updated_at: new Date().toISOString() })
    .eq("request_id", jobItem.source_request_id);

  if (updateError) { // Log but don't fail — the job-item status was already updated.
    console.error("[partsRequestAdapter] Failed to sync request status:", updateError.message);
    return { success: false, updated: false };
  }

  return { success: true, updated: true };
};

// ---------------------------------------------------------------------------
// Query: Merged view of all parts activity for a job
// ---------------------------------------------------------------------------

/**
 * Returns a unified list of parts activity for a job by merging
 * parts_job_items and unfulfilled parts_requests.
 *
 * Fulfilled requests are excluded (their data lives in parts_job_items).
 * Unfulfilled requests are returned with `_source: "request"` marker.
 *
 * @param {number} jobId - The job ID
 * @returns {Array} Merged, deduplicated parts list
 */
export const getMergedPartsForJob = async (jobId) => { // Unified parts query.
  if (!jobId) return []; // Guard.

  const [jobItemsResult, requestsResult] = await Promise.all([ // Parallel fetch.
    supabase
      .from("parts_job_items")
      .select("*, part:parts_catalog(*)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
    supabase
      .from("parts_requests")
      .select("*, part:part_id(id, part_number, name), requester:requested_by(user_id, first_name, last_name)")
      .eq("job_id", jobId)
      .is("fulfilled_by", null) // Only unfulfilled requests.
      .order("created_at", { ascending: false }),
  ]);

  if (jobItemsResult.error) { // Log but return what we have.
    console.error("[partsRequestAdapter] Failed to fetch job items:", jobItemsResult.error.message);
  }
  if (requestsResult.error) { // Log but return what we have.
    console.error("[partsRequestAdapter] Failed to fetch requests:", requestsResult.error.message);
  }

  const jobItems = (jobItemsResult.data || []).map((item) => ({ // Tag job items.
    ...item,
    _source: "job_item", // Distinguishes from requests in the merged list.
  }));

  const unfulfilledRequests = (requestsResult.data || []).map((req) => ({ // Tag requests.
    ...req,
    _source: "request", // Distinguishes from job items in the merged list.
    _requestId: req.request_id, // Preserve for linking.
  }));

  return [...jobItems, ...unfulfilledRequests]; // Merged list, job items first.
};

// ---------------------------------------------------------------------------
// Dashboard: Accurate parts counts from both tables
// ---------------------------------------------------------------------------

/**
 * Returns consolidated parts counts for dashboard reporting.
 * Counts from parts_job_items (active allocations) + unfulfilled parts_requests.
 *
 * @returns {object} { totalActive, pending, onOrder, allocated, fitted, unfulfilledRequests }
 */
export const getPartsStatusCounts = async () => { // Dashboard-ready counts.
  const [jobItemsResult, requestsResult] = await Promise.all([ // Parallel fetch.
    supabase
      .from("parts_job_items")
      .select("id, status, pre_pick_location"),
    supabase
      .from("parts_requests")
      .select("request_id, status")
      .is("fulfilled_by", null), // Only unfulfilled.
  ]);

  const jobItems = jobItemsResult.data || []; // Fallback to empty.
  const requests = requestsResult.data || []; // Fallback to empty.

  const jobItemsByStatus = {}; // Count job items by status.
  jobItems.forEach((item) => { // Aggregate.
    const status = (item.status || "pending").trim();
    jobItemsByStatus[status] = (jobItemsByStatus[status] || 0) + 1;
  });

  const prePicked = jobItems.filter((item) => Boolean(item.pre_pick_location)).length; // Pre-picked count.

  return {
    totalActive: jobItems.length, // All active allocations.
    byStatus: jobItemsByStatus, // Breakdown by status.
    prePicked, // Items with pre-pick location set.
    unfulfilledRequests: requests.length, // Tech requests waiting to be fulfilled.
    requestsByStatus: requests.reduce((acc, req) => { // Request breakdown.
      const status = (req.status || "pending").trim();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {}),
  };
};
