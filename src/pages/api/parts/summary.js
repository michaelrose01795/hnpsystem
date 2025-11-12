// file location: src/pages/api/parts/summary.js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed`,
    })
  }

  try {
    // Fetch parts inventory summary statistics
    
    // 1. Total parts count
    const { count: totalParts, error: totalError } = await supabase
      .from('parts_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    if (totalError) throw totalError

    // 2. Low stock parts (below reorder level)
    const { data: lowStockParts, error: lowStockError } = await supabase
      .from('parts_inventory')
      .select('*')
      .eq('is_active', true)
      .lt('qty_in_stock', supabase.raw('reorder_level'))

    if (lowStockError) throw lowStockError

    // 3. Total value of inventory (cost)
    const { data: inventoryForValue, error: valueError } = await supabase
      .from('parts_inventory')
      .select('qty_in_stock, unit_cost')
      .eq('is_active', true)

    if (valueError) throw valueError

    const totalInventoryValue = inventoryForValue.reduce((sum, part) => {
      return sum + (part.qty_in_stock * (part.unit_cost || 0))
    }, 0)

    // 4. Parts on order
    const { count: partsOnOrder, error: onOrderError } = await supabase
      .from('parts_inventory')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gt('qty_on_order', 0)

    if (onOrderError) throw onOrderError

    // 5. Pending deliveries count
    const { count: pendingDeliveries, error: deliveriesError } = await supabase
      .from('parts_deliveries')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ordering', 'in_transit'])

    if (deliveriesError) throw deliveriesError

    // 6. Active job parts requests
    const { count: activeJobParts, error: jobPartsError } = await supabase
      .from('job_parts')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'awaiting_stock', 'allocated'])

    if (jobPartsError) throw jobPartsError

    // Build summary response
    const summary = {
      totalParts: totalParts || 0,
      lowStockCount: lowStockParts?.length || 0,
      lowStockParts: lowStockParts || [],
      totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
      partsOnOrder: partsOnOrder || 0,
      pendingDeliveries: pendingDeliveries || 0,
      activeJobParts: activeJobParts || 0,
    }

    return res.status(200).json({
      success: true,
      summary,
    })

  } catch (error) {
    console.error('Error loading parts manager summary:', error)
    return res.status(500).json({
      success: false,
      message: "Failed to load parts manager summary",
      error: error.message,
    })
  }
}