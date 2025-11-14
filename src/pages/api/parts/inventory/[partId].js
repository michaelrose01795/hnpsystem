// file location: src/pages/api/parts/inventory/[partId].js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

export default async function handler(req, res) {
  const { partId } = req.query

  if (!partId || typeof partId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Part ID is required",
    })
  }

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('id', partId)
        .single()

      if (error || !data) {
        return res.status(404).json({
          success: false,
          message: "Part not found",
          error: error?.message,
        })
      }

      return res.status(200).json({
        success: true,
        part: data,
      })
    }

    if (req.method === "PATCH") {
      const { userId, ...updates } = req.body || {}

      // Add metadata
      updates.updated_at = new Date().toISOString()
      if (userId) updates.updated_by = userId

      const { data, error } = await supabase
        .from('parts_inventory')
        .update(updates)
        .eq('id', partId)
        .select()
        .single()

      if (error) throw error

      return res.status(200).json({
        success: true,
        part: data,
      })
    }

    if (req.method === "DELETE") {
      const { error } = await supabase
        .from('parts_inventory')
        .delete()
        .eq('id', partId)

      if (error) throw error

      return res.status(204).end()
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"])
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    })

  } catch (error) {
    console.error('Error handling part:', error)
    return res.status(500).json({
      success: false,
      message: "Operation failed",
      error: error.message,
    })
  }
}