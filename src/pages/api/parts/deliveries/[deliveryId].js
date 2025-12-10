// file location: src/pages/api/parts/deliveries/[deliveryId].js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client
import { resolveAuditIds } from "@/lib/utils/ids";

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  const { deliveryId } = req.query

  if (!deliveryId || typeof deliveryId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Delivery ID is required",
    })
  }

  if (req.method === "PATCH") {
    const { userId, userNumericId, ...updates } = req.body || {}
    const { numeric: auditUserNumeric } = resolveAuditIds(userId, userNumericId);

    try {
      const payload = {
        supplier: updates.supplier,
        order_reference: updates.orderReference,
        status: updates.status,
        expected_date: parseDate(updates.expectedDate),
        received_date: parseDate(updates.receivedDate),
        notes: updates.notes,
        updated_at: new Date().toISOString(),
        updated_by: auditUserNumeric || null,
      }

      // Remove undefined values
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) delete payload[key]
      })

      const { data, error } = await supabase
        .from('parts_deliveries')
        .update(payload)
        .eq('id', deliveryId)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        delivery: data,
      })

    } catch (error) {
      console.error('Error updating delivery:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to update delivery",
        error: error.message,
      })
    }
  }

  res.setHeader("Allow", ["PATCH"])
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`,
  })
}
