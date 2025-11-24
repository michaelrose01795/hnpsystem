// file location: src/pages/api/parts/deliveries/[deliveryId]/items.js

import { supabase } from "@/lib/supabaseClient";

const parseInteger = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default async function handler(req, res) {
  const { deliveryId } = req.query

  if (!deliveryId || typeof deliveryId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery ID is required",
    })
  }

  if (req.method === "POST") {
    const {
      partId,
      jobId,
      quantityOrdered,
      quantityReceived,
      unitCost,
      unitPrice,
      status,
      notes,
      userId,
    } = req.body || {}

    if (!partId) {
      return res.status(400).json({
        success: false,
        message: "Part ID is required",
      })
    }

    try {
      const orderedQty = Math.max(0, parseInteger(quantityOrdered, 0))
      const receivedQty = Math.max(0, parseInteger(quantityReceived, 0))

      // Create delivery item
      const itemPayload = {
        delivery_id: deliveryId,
        part_id: partId,
        job_id: jobId || null,
        quantity_ordered: orderedQty,
        quantity_received: receivedQty,
        unit_cost: parseNumber(unitCost),
        unit_price: parseNumber(unitPrice),
        status: status || (receivedQty > 0 ? (receivedQty >= orderedQty ? "received" : "partial") : "ordered"),
        notes: notes || null,
        created_at: new Date().toISOString(),
      }

      const { data: createdItem, error: itemError } = await supabase
        .from('parts_delivery_items')
        .insert([itemPayload])
        .select()
        .single()

      if (itemError) throw itemError

      // Get current part inventory
      const { data: currentPart, error: partError } = await supabase
        .from('parts_catalog')
        .select('qty_in_stock, qty_on_order')
        .eq('id', partId)
        .single()

      if (partError) throw partError

      let newQtyInStock = currentPart.qty_in_stock
      let newQtyOnOrder = currentPart.qty_on_order

      // Update quantities based on ordered and received
      if (orderedQty > 0) {
        newQtyOnOrder += orderedQty
      }

      if (receivedQty > 0) {
        newQtyInStock += receivedQty
        newQtyOnOrder -= Math.min(receivedQty, orderedQty)

        // Record stock movement
        await supabase
          .from('parts_stock_movements')
          .insert([{
            part_id: partId,
            delivery_item_id: createdItem.id,
            movement_type: 'delivery',
            quantity: receivedQty,
            unit_cost: createdItem.unit_cost ?? parseNumber(unitCost) ?? 0,
            unit_price: createdItem.unit_price ?? parseNumber(unitPrice) ?? 0,
            performed_by: userId || null,
            reference: `delivery:${deliveryId}`,
            notes: notes || null,
            created_at: new Date().toISOString(),
          }])
      }

      // Update part inventory
      const { error: updateError } = await supabase
        .from('parts_catalog')
        .update({
          qty_in_stock: newQtyInStock,
          qty_on_order: newQtyOnOrder,
          updated_at: new Date().toISOString(),
        })
        .eq('id', partId)

      if (updateError) throw updateError

      return res.status(201).json({
        success: true,
        deliveryItem: createdItem,
      })

    } catch (error) {
      console.error('Error creating delivery item:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to create delivery item",
        error: error.message,
      })
    }
  }

  res.setHeader("Allow", ["POST"])
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  })
}
