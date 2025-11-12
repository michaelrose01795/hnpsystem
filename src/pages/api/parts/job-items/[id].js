// file location: src/pages/api/parts/job-items/[id].js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

const MANAGER_ROLE_KEYWORDS = ["parts", "manager", "admin"]
const VALID_STATUSES = new Set(["pending", "awaiting_stock", "allocated", "picked", "fitted", "cancelled"])

const normaliseRole = (role) => (typeof role === "string" ? role.trim().toLowerCase() : "")

const hasManagerPrivileges = (role) => MANAGER_ROLE_KEYWORDS.some((keyword) => normaliseRole(role).includes(keyword))

const normaliseStatus = (status) => {
  if (status === undefined || status === null) {
    return undefined
  }
  const lower = typeof status === "string" ? status.toLowerCase() : ""
  if (!VALID_STATUSES.has(lower)) {
    throw new Error("Invalid status provided")
  }
  return lower
}

// Get user from request - simplified
const getUserFromRequest = async (req) => {
  // TODO: Replace with actual auth implementation
  return { role: 'admin' }
}

export default async function handler(req, res) {
  const { id: rawId } = req.query || {}
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  if (!id) {
    return res.status(400).json({ ok: false, error: "id is required" })
  }

  try {
    if (req.method === "PATCH") {
      const user = await getUserFromRequest(req)
      if (!hasManagerPrivileges(user?.role)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" })
      }

      const updates = { ...(req.body || {}) }
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        updates.status = normaliseStatus(updates.status)
      }

      updates.updated_at = new Date().toISOString()

      const { data: updated, error } = await supabase
        .from('job_parts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error || !updated) {
        return res.status(404).json({ ok: false, error: "Job item not found" })
      }

      return res.status(200).json({ ok: true, data: updated })
    }

    if (req.method === "DELETE") {
      const user = await getUserFromRequest(req)
      if (!hasManagerPrivileges(user?.role)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" })
      }

      const { error } = await supabase
        .from('job_parts')
        .delete()
        .eq('id', id)

      if (error) throw error

      return res.status(200).json({ ok: true, data: { deleted: true, id } })
    }

    res.setHeader("Allow", ["PATCH", "DELETE"])
    return res.status(405).json({ ok: false, error: `Method ${req.method} not allowed` })

  } catch (error) {
    console.error(`/api/parts/job-items/${id} error`, error)
    const message = error?.message || "Unexpected error"
    const statusCode = message === "Invalid status provided" ? 400 : 500
    return res.status(statusCode).json({ ok: false, error: message })
  }
}