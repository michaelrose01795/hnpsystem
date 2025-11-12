// file location: src/pages/api/parts/deliveries/items/[itemId].js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

const parseInteger = (value, fallback) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseNumber = (value, fallback) => {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

export default async function handler(req, res) {
  const { itemId } = req.query

  if (!itemId || typeof itemId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery item ID is required",
    })
  }

  try {
    // Get existing delivery item
    const { data: existing, error: fetchError } = await supabase
      .from('parts_delivery_items')
      .select('*')
      .eq('id', itemId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({
        success: false,
        message: "Delivery item not found",
        error: fetchError?.message,
      })
    }

    if (req.method === "PATCH") {
      const {
        userId,
        quantityOrdered,
        quantityReceived,
        status,
        notes,
        unitCost,
        unitPrice,
      } = req.body || {}

      const newOrdered = quantityOrdered !== undefined
        ? Math.max(0, parseInteger(quantityOrdered, 0))
        : existing.quantity_ordered

      const newReceived = quantityReceived !== undefined
        ? Math.max(0, parseInteger(quantityReceived, 0))
        : existing.quantity_received

      const orderDelta = newOrdered - existing.quantity_ordered
      const receivedDelta = newReceived - existing.quantity_received
      const onOrderDelta = orderDelta - receivedDelta
      const stockDelta = receivedDelta

      // Update delivery item
      const updates = {
        quantity_ordered: newOrdered,
        quantity_received: newReceived,
        status: status || (newReceived > 0 ? (newReceived >= newOrdered ? "received" : "partial") : existing.status),
        notes: notes !== undefined ? notes : existing.notes,
        unit_cost: unitCost !== undefined ? parseNumber(unitCost, existing.unit_cost) : existing.unit_cost,
        unit_price: unitPrice !== undefined ? parseNumber(unitPrice, existing.unit_price) : existing.unit_price,
        updated_at: new Date().toISOString(),
      }

      const { data: updated, error: updateError } = await supabase
        .from('parts_delivery_items')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single()

      if (updateError) throw updateError

      // Update inventory if quantities changed
      if (orderDelta !== 0 || receivedDelta !== 0) {
        const { data: part, error: partError } = await supabase
          .from('parts_inventory')
          .select('qty_in_stock, qty_on_order')
          .eq('id', existing.part_id)
          .single()

        if (partError) throw partError

        const { error: invError } = await supabase
          .from('parts_inventory')
          .update({
            qty_in_stock: part.qty_in_stock + stockDelta,
            qty_on_order: part.qty_on_order + onOrderDelta,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.part_id)

        if (invError) throw invError

        // Record stock movement if received quantity changed
        if (receivedDelta !== 0) {
          await supabase
            .from('parts_stock_movements')
            .insert([{
              part_id: existing.part_id,
              delivery_item_id: existing.id,
              movement_type: receivedDelta > 0 ? 'delivery' : 'correction',
              quantity: receivedDelta,
              unit_cost: updated.unit_cost || existing.unit_cost || 0,
              unit_price: updated.unit_price || existing.unit_price || 0,
              performed_by: userId || null,
              reference: `delivery:${existing.delivery_id}`,
              notes: notes || existing.notes || null,
              created_at: new Date().toISOString(),
            }])
        }
      }

      return res.status(200).json({
        success: true,
        deliveryItem: updated,
      })
    }

    if (req.method === "DELETE") {
      const outstanding = (existing.quantity_ordered || 0) - (existing.quantity_received || 0)
      const stockReduction = existing.quantity_received || 0

      // Reverse inventory adjustments
      if (outstanding !== 0 || stockReduction !== 0) {
        const { data: part, error: partError } = await supabase
          .from('parts_inventory')
          .select('qty_in_stock, qty_on_order')
          .eq('id', existing.part_id)
          .single()

        if (partError) throw partError

        const { error: invError } = await supabase
          .from('parts_inventory')
          .update({
            qty_in_stock: part.qty_in_stock - stockReduction,
            qty_on_order: part.qty_on_order - outstanding,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.part_id)

        if (invError) throw invError

        if (stockReduction !== 0) {
          await supabase
            .from('parts_stock_movements')
            .insert([{
              part_id: existing.part_id,
              delivery_item_id: existing.id,
              movement_type: 'correction',
              quantity: -stockReduction,
              unit_cost: existing.unit_cost || 0,
              unit_price: existing.unit_price || 0,
              performed_by: req.body?.userId || null,
              reference: `delivery-delete:${existing.delivery_id}`,
              notes: 'Delivery item removed',
              created_at: new Date().toISOString(),
            }])
        }
      }

      // Delete the delivery item
      const { error: deleteError } = await supabase
        .from('parts_delivery_items')
        .delete()
        .eq('id', itemId)

      if (deleteError) throw deleteError

      return res.status(204).end()
    }

    res.setHeader("Allow", ["PATCH", "DELETE"])
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    })

  } catch (error) {
    console.error('Error handling delivery item:', error)
    return res.status(500).json({
      success: false,
      message: "Operation failed",
      error: error.message,
    })
  }
}