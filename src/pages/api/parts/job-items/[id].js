// file location: src/pages/api/parts/job-items/[id].js

import { supabase } from "@/lib/supabaseClient";

const MANAGER_ROLE_KEYWORDS = ["parts", "manager", "admin"]
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
  "removed",
])

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

      const needsStockReturn = updates.status === "removed"

      let existing = null
      if (needsStockReturn) {
        const { data: existingRow, error: existingError } = await supabase
          .from("parts_job_items")
          .select("id, part_id, quantity_requested, quantity_allocated, status, authorised")
          .eq("id", id)
          .single()

        if (existingError || !existingRow) {
          return res.status(404).json({ ok: false, error: "Job item not found" })
        }

        existing = existingRow
      }

      const { data: updated, error } = await supabase
        .from('parts_job_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error || !updated) {
        return res.status(404).json({ ok: false, error: "Job item not found" })
      }

      if (needsStockReturn && existing && existing.status !== "removed") {
        const returnQty = Math.max(
          Number(existing.quantity_allocated || 0),
          Number(existing.quantity_requested || 0),
          0
        )

        if (returnQty > 0) {
          const { data: partRow, error: partError } = await supabase
            .from("parts_catalog")
            .select("qty_in_stock, qty_reserved")
            .eq("id", existing.part_id)
            .single()

          if (partError) {
            throw partError
          }

          const currentStock = Number(partRow.qty_in_stock || 0)
          const currentReserved = Number(partRow.qty_reserved || 0)
          const nextReserved = existing.authorised
            ? Math.max(0, currentReserved - returnQty)
            : currentReserved

          await supabase
            .from("parts_catalog")
            .update({
              qty_in_stock: currentStock + returnQty,
              qty_reserved: nextReserved,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.part_id)
        }
      }

      return res.status(200).json({ ok: true, data: updated })
    }

    if (req.method === "DELETE") {
      const user = await getUserFromRequest(req)
      if (!hasManagerPrivileges(user?.role)) {
        return res.status(403).json({ ok: false, error: "Insufficient permissions" })
      }

      const { data: existing, error: fetchError } = await supabase
        .from("parts_job_items")
        .select("id, part_id, quantity_requested, quantity_allocated, status, authorised")
        .eq("id", id)
        .single()

      if (fetchError || !existing) {
        return res.status(404).json({ ok: false, error: "Job item not found" })
      }

      const returnQty = Math.max(
        Number(existing.quantity_allocated || 0),
        Number(existing.quantity_requested || 0),
        0
      )

      if (returnQty > 0) {
        const { data: partRow, error: partError } = await supabase
          .from("parts_catalog")
          .select("qty_in_stock, qty_reserved")
          .eq("id", existing.part_id)
          .single()

        if (partError) {
          throw partError
        }

        const currentReserved = Number(partRow.qty_reserved || 0)
        const currentStock = Number(partRow.qty_in_stock || 0)
        const nextReserved = existing.authorised ? Math.max(0, currentReserved - returnQty) : currentReserved
        const nextStock = currentStock + returnQty

        await supabase
          .from("parts_catalog")
          .update({
            qty_in_stock: nextStock,
            qty_reserved: nextReserved,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.part_id)
      }

      const { error } = await supabase
        .from("parts_job_items")
        .delete()
        .eq("id", id)

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
