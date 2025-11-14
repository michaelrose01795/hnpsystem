// file location: src/pages/api/parts/job-items/index.js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

const WRITE_ROLE_KEYWORDS = ["tech", "parts", "manager", "admin"] // Role keywords permitted to create records
const VALID_STATUSES = new Set(["pending", "awaiting_stock", "allocated", "picked", "fitted", "cancelled"]) // Allowed statuses

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
        .from('job_parts')
        .select('*, parts_inventory(*)')
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
      const status = normaliseStatus(body.status || "pending") // Normalise status with default pending

      if (!jobId || !partId) {
        return res.status(400).json({ ok: false, error: "job_id and part_id are required" })
      }

      if (!status) {
        return res.status(400).json({ ok: false, error: "Invalid status provided" })
      }

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
        origin: body.origin ?? null,
        allocated_by: body.allocated_by ?? body.allocatedBy ?? null,
        picked_by: body.picked_by ?? body.pickedBy ?? null,
        fitted_by: body.fitted_by ?? body.fittedBy ?? null,
        created_at: new Date().toISOString(),
      }

      // Insert job item into database
      const { data: created, error } = await supabase
        .from('job_parts')
        .insert([payload])
        .select('*, parts_inventory(*)')
        .single()

      if (error) throw error

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