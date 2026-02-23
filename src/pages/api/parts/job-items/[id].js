// file location: src/pages/api/parts/job-items/[id].js

import { supabase } from "@/lib/supabaseClient";
import { syncVhcPartsAuthorisation } from "@/lib/database/vhcPartsSync";

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

      const rawUpdates = { ...(req.body || {}) }
      const updates = { ...rawUpdates }
      if (Object.prototype.hasOwnProperty.call(rawUpdates, "quantityRequested")) {
        updates.quantity_requested = rawUpdates.quantityRequested
        delete updates.quantityRequested
      }
      if (Object.prototype.hasOwnProperty.call(rawUpdates, "quantityAllocated")) {
        updates.quantity_allocated = rawUpdates.quantityAllocated
        delete updates.quantityAllocated
      }
      if (Object.prototype.hasOwnProperty.call(rawUpdates, "quantityFitted")) {
        updates.quantity_fitted = rawUpdates.quantityFitted
        delete updates.quantityFitted
      }
      if (Object.prototype.hasOwnProperty.call(updates, "status")) {
        updates.status = normaliseStatus(updates.status)
      }

      updates.updated_at = new Date().toISOString()

      const needsStockReturn = updates.status === "removed"
      const touchesQuantities =
        Object.prototype.hasOwnProperty.call(updates, "quantity_requested") ||
        Object.prototype.hasOwnProperty.call(updates, "quantity_allocated")
      const isUnassigningVhc = Object.prototype.hasOwnProperty.call(updates, "vhc_item_id") && updates.vhc_item_id === null

      let existing = null
      if (needsStockReturn || isUnassigningVhc || touchesQuantities) {
        const { data: existingRow, error: existingError } = await supabase
          .from("parts_job_items")
          .select("id, job_id, vhc_item_id, part_id, quantity_requested, quantity_allocated, status, authorised")
          .eq("id", id)
          .single()

        if (existingError || !existingRow) {
          return res.status(404).json({ ok: false, error: "Job item not found" })
        }

        existing = existingRow
      }

      let quantityAllocatedDelta = 0
      let nextRequested = Number(existing?.quantity_requested || 0)
      let nextAllocated = Number(existing?.quantity_allocated || 0)

      if (touchesQuantities && existing) {
        if (Object.prototype.hasOwnProperty.call(updates, "quantity_requested")) {
          const parsedRequested = Number.parseInt(updates.quantity_requested, 10)
          nextRequested = Number.isFinite(parsedRequested) ? Math.max(0, parsedRequested) : nextRequested
          updates.quantity_requested = nextRequested
        }
        if (Object.prototype.hasOwnProperty.call(updates, "quantity_allocated")) {
          const parsedAllocated = Number.parseInt(updates.quantity_allocated, 10)
          nextAllocated = Number.isFinite(parsedAllocated) ? Math.max(0, parsedAllocated) : nextAllocated
          updates.quantity_allocated = nextAllocated
        }
        quantityAllocatedDelta = nextAllocated - Number(existing.quantity_allocated || 0)

        if (quantityAllocatedDelta !== 0) {
          const { data: partRow, error: partError } = await supabase
            .from("parts_catalog")
            .select("qty_in_stock, qty_reserved")
            .eq("id", existing.part_id)
            .single()

          if (partError || !partRow) {
            throw partError || new Error("Part not found")
          }

          const currentStock = Number(partRow.qty_in_stock || 0)
          const currentReserved = Number(partRow.qty_reserved || 0)

          if (quantityAllocatedDelta > 0 && currentStock < quantityAllocatedDelta) {
            return res.status(409).json({ ok: false, error: `Insufficient stock. Available: ${currentStock}` })
          }

          const nextStock = currentStock - quantityAllocatedDelta
          const nextReserved = existing.authorised
            ? Math.max(0, currentReserved + quantityAllocatedDelta)
            : currentReserved

          const { error: invError } = await supabase
            .from("parts_catalog")
            .update({
              qty_in_stock: nextStock,
              qty_reserved: nextReserved,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.part_id)

          if (invError) throw invError
        }
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

      // Sync VHC status when unassigning a VHC-allocated part
      if (isUnassigningVhc && existing?.vhc_item_id) {
        try {
          await syncVhcPartsAuthorisation({
            jobId: existing.job_id,
            vhcItemId: existing.vhc_item_id,
          });
        } catch (syncError) {
          console.error("VHC sync error (non-blocking):", syncError);
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
        .select("id, job_id, vhc_item_id, part_id, quantity_requested, quantity_allocated, status, authorised")
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

      if (existing?.vhc_item_id) {
        await syncVhcPartsAuthorisation({
          jobId: existing.job_id,
          vhcItemId: existing.vhc_item_id,
        });
      }

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
