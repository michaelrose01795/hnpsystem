// file location: src/pages/api/parts/job-items/index.js

import { supabase } from "@/lib/supabaseClient";
import { linkRequestToJobItem } from "@/lib/parts/partsRequestAdapter"; // Parts request adapter.

const WRITE_ROLE_KEYWORDS = ["tech", "parts", "manager", "admin"] // Role keywords permitted to create records
const VALID_STATUSES = new Set([
  "pending",
  "waiting_authorisation",
  "awaiting_stock",
  "on_order",
  "pre_picked",
  "stock",
  "allocated",
  "picked",
  "fitted",
  "cancelled",
]) // Allowed statuses

// Lowercase helper for comparisons
const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : "")

// Evaluate RBAC
const hasWriteAccess = (role) => WRITE_ROLE_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword))

// Validate and normalise status input
const normaliseStatus = (status) => {
  if (!status) {
    return null // Return null to trigger validation downstream
  }
  const lower = status.toLowerCase() // Lowercase for comparison
  return VALID_STATUSES.has(lower) ? lower : null // Return normalised value or null if invalid
}

const resolveCanonicalVhcItemId = async ({ jobId, rawVhcItemId }) => {
  if (rawVhcItemId === null || rawVhcItemId === undefined) return null
  const token = String(rawVhcItemId).trim()
  if (!token) return null

  const { data: displayRow, error: displayError } = await supabase
    .from("vhc_checks")
    .select("vhc_id")
    .eq("job_id", jobId)
    .eq("display_id", token)
    .maybeSingle()

  if (displayError) {
    throw new Error(`Failed to resolve VHC display id ${token}: ${displayError.message}`)
  }
  if (displayRow?.vhc_id) {
    return Number(displayRow.vhc_id)
  }

  const parsed = Number.parseInt(token, 10)
  if (!Number.isInteger(parsed)) {
    return null
  }

  const { data: directRow, error: directError } = await supabase
    .from("vhc_checks")
    .select("vhc_id")
    .eq("job_id", jobId)
    .eq("vhc_id", parsed)
    .maybeSingle()

  if (directError) {
    throw new Error(`Failed to validate VHC item id ${parsed}: ${directError.message}`)
  }

  return directRow?.vhc_id ? Number(directRow.vhc_id) : null
}

const buildVhcRowDescription = async ({ jobId, vhcItemId }) => {
  if (!jobId || !Number.isInteger(vhcItemId)) return null

  const { data: checkRow, error } = await supabase
    .from("vhc_checks")
    .select("section, issue_title, issue_description, measurement, note_text")
    .eq("job_id", jobId)
    .eq("vhc_id", vhcItemId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to fetch VHC row ${vhcItemId}: ${error.message}`)
  }
  if (!checkRow) return null

  const raw = [
    checkRow.section,
    checkRow.issue_title,
    checkRow.issue_description,
    checkRow.measurement,
    checkRow.note_text,
  ]
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .join(" ")

  const compact = raw.replace(/\s+/g, " ").trim()
  return compact || null
}

// Get user from request - simplified version for now
const getUserFromRequest = async (req) => {
  // TODO: Replace with your actual auth implementation
  // This is a placeholder that allows all requests
  return { role: 'admin' }
}

export default async function handler(req, res) {
  try {
    // Handle GET request - List job items by job ID
    if (req.method === "GET") {
      const { jobId, job_id } = req.query || {} // Extract query parameters supporting both casings
      const resolvedJobId = job_id ?? jobId // Prefer snake_case to align with database column
      
      if (!resolvedJobId) {
        return res.status(400).json({ ok: false, error: "job_id query param is required" })
      }

      // Fetch job items from database
      const { data: items, error } = await supabase
        .from("parts_job_items")
        .select('*, part:parts_catalog(*)')
        .eq('job_id', resolvedJobId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return res.status(200).json({ ok: true, data: items || [] })
    }

    // Handle POST request - Create new job item
    if (req.method === "POST") {
      const user = await getUserFromRequest(req) // Resolve caller role
      
      if (!hasWriteAccess(user?.role)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" })
      }

      const body = req.body || {} // Capture request payload
      const jobId = body.job_id ?? body.jobId // Accept both casings for job id
      const partId = body.part_id ?? body.partId // Accept both casings for part id
      const requestedVhcItemId = body.vhc_item_id ?? body.vhcItemId ?? null
      const status = normaliseStatus(body.status || "pending") // Normalise status with default pending

      if (!jobId || !partId) {
        return res.status(400).json({ ok: false, error: "job_id and part_id are required" })
      }

      if (!status) {
        return res.status(400).json({ ok: false, error: "Invalid status provided" })
      }

      const resolvedVhcItemId = await resolveCanonicalVhcItemId({
        jobId,
        rawVhcItemId: requestedVhcItemId,
      })
      if (
        requestedVhcItemId !== null &&
        requestedVhcItemId !== undefined &&
        requestedVhcItemId !== "" &&
        !Number.isInteger(resolvedVhcItemId)
      ) {
        return res.status(400).json({ ok: false, error: "Invalid VHC item id for this job" })
      }
      const rowDescription = Number.isInteger(resolvedVhcItemId)
        ? await buildVhcRowDescription({ jobId, vhcItemId: resolvedVhcItemId })
        : null

      const resolvedSourceRequestId = // Resolve source_request_id from body (supports both casings).
        body.source_request_id ?? body.sourceRequestId ?? null;

      // Build payload for database insert
      const payload = {
        job_id: jobId,
        part_id: partId,
        status,
        quantity_requested: body.quantity_requested ?? body.quantityRequested ?? 0,
        quantity_allocated: body.quantity_allocated ?? body.quantityAllocated ?? 0,
        quantity_fitted: body.quantity_fitted ?? body.quantityFitted ?? 0,
        request_notes: body.request_notes ?? body.requestNotes ?? null,
        pre_pick_location: body.pre_pick_location ?? body.prePickLocation ?? null,
        storage_location: body.storage_location ?? body.storageLocation ?? null,
        unit_cost: body.unit_cost ?? body.unitCost ?? null,
        unit_price: body.unit_price ?? body.unitPrice ?? null,
        vhc_item_id: Number.isInteger(resolvedVhcItemId) ? resolvedVhcItemId : null,
        row_description: rowDescription,
        origin: body.origin ?? null,
        allocated_by: body.allocated_by ?? body.allocatedBy ?? null,
        source_request_id: resolvedSourceRequestId, // Link to originating parts_requests row.
        created_at: new Date().toISOString(),
      }

      // Insert job item into database
      const { data: created, error } = await supabase
        .from('parts_job_items')
        .insert([payload])
        .select('*, part:parts_catalog(*)')
        .single()

      if (error) throw error

      // Link back to the originating parts_request if provided (bidirectional FK).
      if (resolvedSourceRequestId && created?.id) {
        try {
          await linkRequestToJobItem({
            jobItemId: created.id,
            requestId: resolvedSourceRequestId,
          });
        } catch (linkError) {
          console.error("[api/parts/job-items] Request link error (non-blocking):", linkError);
        }
      }

      return res.status(201).json({ ok: true, data: created })
    }

    // Method not allowed
    res.setHeader("Allow", ["GET", "POST"])
    return res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` })

  } catch (error) {
    console.error("/api/parts/job-items error", error)
    return res.status(500).json({ ok: false, error: error?.message || "Unexpected error" })
  }
}
