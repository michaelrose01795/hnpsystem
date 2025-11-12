// file location: src/pages/api/parts/jobs/[jobPartId].js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

const PRE_PICK_LOCATIONS = new Set([
  "service_rack_1",
  "service_rack_2",
  "service_rack_3",
  "service_rack_4",
  "sales_rack_1",
  "sales_rack_2",
  "sales_rack_3",
  "sales_rack_4",
  "stairs_pre_pick",
])

const parseInteger = (value, fallback) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export default async function handler(req, res) {
  const { jobPartId } = req.query

  if (!jobPartId || typeof jobPartId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Job part ID is required",
    })
  }

  try {
    // Get existing job part
    const { data: existing, error: fetchError } = await supabase
      .from('job_parts')
      .select('*, parts_inventory(*)')
      .eq('id', jobPartId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        message: "Job part not found",
        error: fetchError?.message,
      })
    }

    const partInfo = existing.parts_inventory

    if (!partInfo) {
      return res.status(500).json({
        success: false,
        message: "Failed to load part details for job item",
      })
    }

    if (req.method === "PATCH") {
      const {
        userId,
        status,
        quantityAllocated,
        quantityFitted,
        prePickLocation,
        storageLocation,
        unitCost,
        unitPrice,
        requestNotes,
      } = req.body || {}

      const updates = {}
      const movements = []

      const newAllocated = quantityAllocated !== undefined
        ? Math.max(0, parseInteger(quantityAllocated, 0))
        : existing.quantity_allocated || 0

      const newFitted = quantityFitted !== undefined
        ? Math.max(0, parseInteger(quantityFitted, 0))
        : existing.quantity_fitted || 0

      const allocatedDelta = quantityAllocated !== undefined
        ? newAllocated - (existing.quantity_allocated || 0)
        : 0

      const fittedDelta = quantityFitted !== undefined
        ? newFitted - (existing.quantity_fitted || 0)
        : 0

      // Check stock availability for allocation increase
      if (allocatedDelta > 0 && partInfo.qty_in_stock < allocatedDelta) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock. Available: ${partInfo.qty_in_stock}`,
        })
      }

      // Handle allocation changes
      if (quantityAllocated !== undefined) {
        updates.quantity_allocated = newAllocated
        if (allocatedDelta !== 0) {
          // Update part inventory
          const { error: invError } = await supabase
            .from('parts_inventory')
            .update({
              qty_in_stock: partInfo.qty_in_stock - allocatedDelta,
              qty_reserved: (partInfo.qty_reserved || 0) + allocatedDelta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.part_id)

          if (invError) throw invError

          movements.push({
            type: allocatedDelta > 0 ? 'allocation' : 'return',
            quantity: allocatedDelta > 0 ? -allocatedDelta : Math.abs(allocatedDelta),
          })
        }
      }

      // Handle fitted changes
      if (quantityFitted !== undefined) {
        updates.quantity_fitted = newFitted
        if (fittedDelta !== 0) {
          // Reduce reserved quantity when items are fitted
          const { error: invError } = await supabase
            .from('parts_inventory')
            .update({
              qty_reserved: (partInfo.qty_reserved || 0) - fittedDelta,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.part_id)

          if (invError) throw invError

          if (fittedDelta > 0) {
            movements.push({
              type: 'adjustment',
              quantity: -fittedDelta,
            })
          }
        }
      }

      // Handle status change to cancelled
      if (status !== undefined) {
        updates.status = status
        if (status === "cancelled" && existing.status !== "cancelled") {
          const outstanding = (quantityAllocated !== undefined ? newAllocated : existing.quantity_allocated || 0) -
                            (quantityFitted !== undefined ? newFitted : existing.quantity_fitted || 0)

          if (outstanding > 0) {
            // Return allocated stock
            const { error: invError } = await supabase
              .from('parts_inventory')
              .update({
                qty_in_stock: partInfo.qty_in_stock + outstanding,
                qty_reserved: (partInfo.qty_reserved || 0) - outstanding,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.part_id)

            if (invError) throw invError

            movements.push({
              type: 'return',
              quantity: outstanding,
            })

            updates.quantity_allocated = Math.max(0, ((updates.quantity_allocated ?? existing.quantity_allocated) || 0) - outstanding)
          }
        }
      }

      // Update other fields
      if (prePickLocation !== undefined) {
        updates.pre_pick_location = PRE_PICK_LOCATIONS.has(prePickLocation) ? prePickLocation : null
      }

      if (storageLocation !== undefined) {
        updates.storage_location = storageLocation || null
      }

      if (requestNotes !== undefined) {
        updates.request_notes = typeof requestNotes === "string" && requestNotes.trim().length > 0 ? requestNotes : null
      }

      if (unitCost !== undefined) {
        const parsed = Number.parseFloat(unitCost)
        updates.unit_cost = Number.isNaN(parsed) ? existing.unit_cost : parsed
      }

      if (unitPrice !== undefined) {
        const parsed = Number.parseFloat(unitPrice)
        updates.unit_price = Number.isNaN(parsed) ? existing.unit_price : parsed
      }

      // Update the job part
      updates.updated_at = new Date().toISOString()
      
      const { data: updatedJobPart, error: updateError } = await supabase
        .from('job_parts')
        .update(updates)
        .eq('id', jobPartId)
        .select('*, parts_inventory(*)')
        .single()

      if (updateError) throw updateError

      // Record stock movements
      if (movements.length > 0) {
        for (const movement of movements) {
          await supabase
            .from('parts_stock_movements')
            .insert([{
              part_id: existing.part_id,
              job_item_id: existing.id,
              movement_type: movement.type,
              quantity: movement.quantity,
              unit_cost: updatedJobPart.unit_cost || existing.unit_cost || 0,
              unit_price: updatedJobPart.unit_price || existing.unit_price || 0,
              performed_by: userId || null,
              reference: `job:${existing.job_id}`,
              notes: requestNotes || existing.request_notes || null,
              created_at: new Date().toISOString(),
            }])
        }
      }

      return res.status(200).json({
        success: true,
        jobPart: updatedJobPart,
      })
    }

    if (req.method === "DELETE") {
      const outstanding = (existing.quantity_allocated || 0) - (existing.quantity_fitted || 0)

      // Return any outstanding allocated stock
      if (outstanding > 0) {
        const { error: invError } = await supabase
          .from('parts_inventory')
          .update({
            qty_in_stock: partInfo.qty_in_stock + outstanding,
            qty_reserved: (partInfo.qty_reserved || 0) - outstanding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.part_id)

        if (invError) throw invError

        // Record stock movement
        await supabase
          .from('parts_stock_movements')
          .insert([{
            part_id: existing.part_id,
            job_item_id: existing.id,
            movement_type: 'return',
            quantity: outstanding,
            unit_cost: existing.unit_cost || 0,
            unit_price: existing.unit_price || 0,
            performed_by: req.body?.userId || null,
            reference: `delete:${existing.job_id}`,
            notes: 'Job part deleted, stock returned',
            created_at: new Date().toISOString(),
          }])
      }

      // Delete the job part
      const { error: deleteError } = await supabase
        .from('job_parts')
        .delete()
        .eq('id', jobPartId)

      if (deleteError) throw deleteError

      return res.status(204).end()
    }

    res.setHeader("Allow", ["PATCH", "DELETE"])
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    })

  } catch (error) {
    console.error('Error handling job part:', error)
    return res.status(500).json({
      success: false,
      message: "Operation failed",
      error: error.message,
    })
  }
}