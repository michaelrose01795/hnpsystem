// file location: src/pages/api/parts/jobs/index.js

import { supabase } from '@/lib/supabaseClient' // Import Supabase client

// Pre-pick location whitelist
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

// Convert value to boolean safely
const toBoolean = (value) => {
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    return ["true", "1", "yes", "on"].includes(value.toLowerCase())
  }
  return Boolean(value)
}

export default async function handler(req, res) {
  // Handle GET request - Fetch job with parts
  if (req.method === "GET") {
    const { search } = req.query

    if (!search) {
      return res.status(400).json({
        success: false,
        message: "Search query (job number or registration) is required",
      })
    }

    try {
      // Try to find job by job number or registration
      const { data: jobs, error: jobError } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          vehicle:vehicles(*),
          job_parts:job_parts(*, parts_inventory(*))
        `)
        .or(`job_number.ilike.%${search}%,reg.ilike.%${search}%`)
        .limit(1)

      if (jobError) throw jobError

      if (!jobs || jobs.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job card not found for provided search term",
        })
      }

      const job = jobs[0]

      return res.status(200).json({
        success: true,
        job: {
          id: job.id,
          job_number: job.job_number,
          reg: job.reg,
          status: job.status,
          customer: job.customer,
          vehicle: job.vehicle,
        },
        parts: job.job_parts || [],
      })

    } catch (error) {
      console.error('Error fetching job:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to fetch job card details",
        error: error.message,
      })
    }
  }

  // Handle POST request - Add part to job
  if (req.method === "POST") {
    const {
      jobId,
      partId,
      quantityRequested,
      quantity,
      allocateFromStock,
      prePickLocation,
      storageLocation,
      status,
      origin,
      unitCost,
      unitPrice,
      requestNotes,
      userId,
    } = req.body || {}

    // Validate required fields
    if (!jobId || !partId) {
      return res.status(400).json({
        success: false,
        message: "Job ID and part ID are required",
      })
    }

    try {
      // Parse quantity
      const requestedQuantityRaw = quantityRequested ?? quantity ?? 1
      const requestedQuantity = Math.max(1, Number.parseInt(requestedQuantityRaw, 10) || 1)
      const shouldAllocate = toBoolean(allocateFromStock)

      // Get part details
      const { data: part, error: partError } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('id', partId)
        .single()

      if (partError || !part) {
        return res.status(404).json({
          success: false,
          message: "Part not found in catalogue",
          error: partError?.message,
        })
      }

      // Resolve unit costs and prices
      let resolvedUnitCost = typeof unitCost === "number" ? unitCost : Number.parseFloat(unitCost)
      let resolvedUnitPrice = typeof unitPrice === "number" ? unitPrice : Number.parseFloat(unitPrice)

      if (Number.isNaN(resolvedUnitCost)) {
        resolvedUnitCost = part.unit_cost || 0
      }

      if (Number.isNaN(resolvedUnitPrice)) {
        resolvedUnitPrice = part.unit_price || 0
      }

      const resolvedStorageLocation = storageLocation || part.storage_location || null

      // Check stock availability if allocating
      if (shouldAllocate && part.qty_in_stock < requestedQuantity) {
        return res.status(409).json({
          success: false,
          message: `Insufficient stock. Available: ${part.qty_in_stock}`,
        })
      }

      // Validate pre-pick location
      const sanitizedPrePick = typeof prePickLocation === "string" && PRE_PICK_LOCATIONS.has(prePickLocation)
        ? prePickLocation
        : null

      // Create job part record
      const jobPartPayload = {
        job_id: jobId,
        part_id: partId,
        quantity_requested: requestedQuantity,
        quantity_allocated: shouldAllocate ? requestedQuantity : 0,
        status: status || (shouldAllocate ? "allocated" : "awaiting_stock"),
        origin: origin || "vhc",
        pre_pick_location: sanitizedPrePick,
        storage_location: resolvedStorageLocation,
        unit_cost: resolvedUnitCost,
        unit_price: resolvedUnitPrice,
        request_notes: requestNotes || null,
        allocated_by: shouldAllocate ? userId || null : null,
        created_at: new Date().toISOString(),
      }

      const { data: newJobPart, error: createError } = await supabase
        .from('job_parts')
        .insert([jobPartPayload])
        .select('*, parts_inventory(*)')
        .single()

      if (createError) throw createError

      // If allocating from stock, update inventory
      if (shouldAllocate) {
        // Update part quantities
        const { error: updateError } = await supabase
          .from('parts_inventory')
          .update({
            qty_in_stock: part.qty_in_stock - requestedQuantity,
            qty_reserved: (part.qty_reserved || 0) + requestedQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq('id', partId)

        if (updateError) {
          // Rollback: delete the job part
          await supabase.from('job_parts').delete().eq('id', newJobPart.id)
          
          throw new Error("Failed to adjust stock levels for allocation")
        }

        // Record stock movement
        await supabase
          .from('parts_stock_movements')
          .insert([{
            part_id: partId,
            job_item_id: newJobPart.id,
            movement_type: 'allocation',
            quantity: -requestedQuantity,
            unit_cost: resolvedUnitCost,
            unit_price: resolvedUnitPrice,
            performed_by: userId || null,
            reference: `job:${jobId}`,
            notes: requestNotes || null,
            created_at: new Date().toISOString(),
          }])
      }

      return res.status(201).json({
        success: true,
        jobPart: newJobPart,
      })

    } catch (error) {
      console.error('Error creating job part:', error)
      return res.status(500).json({
        success: false,
        message: "Failed to create job part entry",
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