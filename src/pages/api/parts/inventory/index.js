// file location: src/pages/api/parts/inventory/index.js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

export default async function handler(req, res) {
  // Handle GET request - Fetch parts inventory with optional filters
  if (req.method === "GET") {
    const {
      search = "",
      includeInactive = "false",
      limit = "50",
      offset = "0",
    } = req.query

    try {
      // Build query to fetch parts inventory
      let query = supabase
        .from('parts_inventory')
        .select('*', { count: 'exact' })
        .order('part_name', { ascending: true })
        .range(
          Number.parseInt(offset, 10),
          Number.parseInt(offset, 10) + Number.parseInt(limit, 10) - 1
        )

      // If search term provided, filter by part name or part number
      if (search && search.trim() !== "") {
        query = query.or(`part_name.ilike.%${search}%,part_number.ilike.%${search}%`)
      }

      // If includeInactive is false, only show active parts
      if (includeInactive !== "true") {
        query = query.eq('is_active', true)
      }

      const { data, error, count } = await query

      if (error) throw error

      return res.status(200).json({
        success: true,
        parts: data || [],
        count: count || 0,
      })

    } catch (error) {
      console.error('Error fetching parts inventory:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to load parts inventory",
        error: error.message,
      })
    }
  }

  // Handle POST request - Create new part
  if (req.method === "POST") {
    const { userId, ...partData } = req.body || {}

    try {
      // Build part payload
      const payload = {
        part_number: partData.partNumber || partData.part_number,
        part_name: partData.partName || partData.part_name,
        description: partData.description || null,
        category: partData.category || null,
        supplier: partData.supplier || null,
        storage_location: partData.storageLocation || partData.storage_location || null,
        qty_in_stock: partData.qtyInStock ?? partData.qty_in_stock ?? 0,
        qty_reserved: partData.qtyReserved ?? partData.qty_reserved ?? 0,
        qty_on_order: partData.qtyOnOrder ?? partData.qty_on_order ?? 0,
        reorder_level: partData.reorderLevel ?? partData.reorder_level ?? 0,
        unit_cost: partData.unitCost ?? partData.unit_cost ?? 0,
        unit_price: partData.unitPrice ?? partData.unit_price ?? 0,
        is_active: partData.isActive ?? partData.is_active ?? true,
        created_by: userId || null,
        created_at: new Date().toISOString(),
      }

      // Insert new part into database
      const { data, error } = await supabase
        .from('parts_inventory')
        .insert([payload])
        .select()
        .single()

      if (error) {
        // Check for duplicate part number (unique constraint violation)
        if (error.code === '23505') {
          return res.status(409).json({
            success: false,
            message: "A part with this part number already exists",
            error: error.message,
          })
        }
        throw error
      }

      return res.status(201).json({
        success: true,
        part: data,
      })

    } catch (error) {
      console.error('Error creating part:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to create part",
        error: error.message,
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