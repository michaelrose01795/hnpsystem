// file location: src/pages/api/parts/deliveries/index.js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

// Parse integer values safely
const parseInteger = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

// Parse float values safely
const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

export default async function handler(req, res) {
  // Handle GET request - List all deliveries
  if (req.method === "GET") {
    const {
      status = "all",
      limit = "50",
      offset = "0",
    } = req.query

    try {
      // Build query to fetch deliveries
      let query = supabase
        .from('parts_deliveries')
        .select('*, parts_delivery_items(*, parts_inventory(*))', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(
          Number.parseInt(offset, 10),
          Number.parseInt(offset, 10) + Number.parseInt(limit, 10) - 1
        )

      // Filter by status if not "all"
      if (status !== "all") {
        query = query.eq('status', status)
      }

      const { data, error, count } = await query

      if (error) throw error

      return res.status(200).json({
        success: true,
        deliveries: data || [],
        count: count || 0,
      })
    } catch (error) {
      console.error('Error fetching deliveries:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to fetch deliveries",
        error: error.message,
      })
    }
  }

  // Handle POST request - Create new delivery with items
  if (req.method === "POST") {
    const { items = [], userId, ...deliveryData } = req.body || {}

    try {
      // Step 1: Create the delivery record
      const deliveryPayload = {
        supplier: deliveryData.supplier || null,
        order_reference: deliveryData.orderReference || null,
        status: deliveryData.status || "ordering",
        expected_date: deliveryData.expectedDate || null,
        received_date: deliveryData.receivedDate || null,
        notes: deliveryData.notes || null,
        created_by: userId || null,
        created_at: new Date().toISOString(),
      }

      const { data: delivery, error: deliveryError } = await supabase
        .from('parts_deliveries')
        .insert([deliveryPayload])
        .select()
        .single()

      if (deliveryError) throw deliveryError

      const createdItems = []
      const appliedAdjustments = []

      // Step 2: Process each item in the delivery
      for (const item of items) {
        if (!item.partId) continue

        const quantityOrdered = Math.max(0, parseInteger(item.quantityOrdered, 0))
        const quantityReceived = Math.max(0, parseInteger(item.quantityReceived, 0))

        // Create delivery item
        const itemPayload = {
          delivery_id: delivery.id,
          part_id: item.partId,
          job_id: item.jobId || null,
          quantity_ordered: quantityOrdered,
          quantity_received: quantityReceived,
          unit_cost: parseNumber(item.unitCost),
          unit_price: parseNumber(item.unitPrice),
          status: item.status || (quantityReceived > 0 ? (quantityReceived >= quantityOrdered ? "received" : "partial") : "ordered"),
          notes: item.notes || null,
          created_at: new Date().toISOString(),
        }

        const { data: deliveryItem, error: itemError } = await supabase
          .from('parts_delivery_items')
          .insert([itemPayload])
          .select()
          .single()

        if (itemError) throw itemError

        createdItems.push(deliveryItem)

        // Step 3: Update parts inventory quantities
        // Get current part inventory
        const { data: currentPart, error: partError } = await supabase
          .from('parts_inventory')
          .select('qty_in_stock, qty_on_order')
          .eq('id', item.partId)
          .single()

        if (partError) throw partError

        let newQtyInStock = currentPart.qty_in_stock
        let newQtyOnOrder = currentPart.qty_on_order

        // If ordered, increase on_order
        if (quantityOrdered > 0) {
          newQtyOnOrder += quantityOrdered
          appliedAdjustments.push({
            partId: item.partId,
            stockDelta: 0,
            onOrderDelta: quantityOrdered,
          })
        }

        // If received, increase stock and decrease on_order
        if (quantityReceived > 0) {
          newQtyInStock += quantityReceived
          newQtyOnOrder -= Math.min(quantityReceived, quantityOrdered)
          
          appliedAdjustments.push({
            partId: item.partId,
            stockDelta: quantityReceived,
            onOrderDelta: -Math.min(quantityReceived, quantityOrdered),
          })

          // Record stock movement
          await supabase
            .from('parts_stock_movements')
            .insert([{
              part_id: item.partId,
              delivery_item_id: deliveryItem.id,
              movement_type: 'delivery',
              quantity: quantityReceived,
              unit_cost: deliveryItem.unit_cost ?? parseNumber(item.unitCost) ?? 0,
              unit_price: deliveryItem.unit_price ?? parseNumber(item.unitPrice) ?? 0,
              performed_by: userId || null,
              reference: `delivery:${delivery.id}`,
              notes: item.notes || null,
              created_at: new Date().toISOString(),
            }])
        }

        // Update inventory
        const { error: updateError } = await supabase
          .from('parts_inventory')
          .update({
            qty_in_stock: newQtyInStock,
            qty_on_order: newQtyOnOrder,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.partId)

        if (updateError) throw updateError
      }

      // Fetch complete delivery with items
      const { data: completeDelivery, error: fetchError } = await supabase
        .from('parts_deliveries')
        .select('*, parts_delivery_items(*, parts_inventory(*))')
        .eq('id', delivery.id)
        .single()

      if (fetchError) throw fetchError

      return res.status(201).json({
        success: true,
        delivery: completeDelivery,
      })

    } catch (err) {
      console.error('Error creating delivery:', err)
      
      // Note: Rollback would need to be handled manually or use database transactions
      // For now, return error and let admin handle cleanup if needed
      
      return res.status(500).json({
        success: false,
        message: err?.message || "Failed to process delivery",
        error: err?.message || err,
      })
    }
  }

  // Method not allowed
  res.setHeader("Allow", ["GET", "POST"])
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  })
}