// file location: src/lib/database/parts.js
import { supabase } from "../supabaseClient";
import { getJobByNumberOrReg } from "./jobs";

const PART_COLUMNS = `
  id,
  part_number,
  name,
  description,
  category,
  supplier,
  oem_reference,
  barcode,
  unit_cost,
  unit_price,
  qty_in_stock,
  qty_reserved,
  qty_on_order,
  reorder_level,
  storage_location,
  service_default_zone,
  sales_default_zone,
  stairs_default_zone,
  notes,
  is_active,
  created_at,
  updated_at
`;

const JOB_ITEM_COLUMNS = `
  id,
  job_id,
  part_id,
  quantity_requested,
  quantity_allocated,
  quantity_fitted,
  status,
  origin,
  pre_pick_location,
  storage_location,
  unit_cost,
  unit_price,
  request_notes,
  allocated_by,
  picked_by,
  fitted_by,
  created_by,
  updated_by,
  created_at,
  updated_at,
  part:part_id (
    ${PART_COLUMNS}
  )
`;

const DELIVERY_COLUMNS = `
  id,
  supplier,
  order_reference,
  status,
  expected_date,
  received_date,
  notes,
  created_at,
  updated_at,
  delivery_items:parts_delivery_items (
    id,
    part_id,
    job_id,
    quantity_ordered,
    quantity_received,
    unit_cost,
    unit_price,
    status,
    notes,
    created_at,
    updated_at,
    part:part_id (${PART_COLUMNS})
  )
`;

const sanitizeSearchTerm = (term = "") =>
  term.replace(/[%_]/g, (match) => `\\${match}`);

/* ============================================
   INVENTORY
============================================ */
export async function getPartsInventory({
  searchTerm = "",
  includeInactive = false,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabase
      .from("parts_catalog")
      .select(PART_COLUMNS, { count: "exact" })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (searchTerm) {
      const sanitized = sanitizeSearchTerm(searchTerm.trim());
      query = query.or(
        `name.ilike.%${sanitized}%,part_number.ilike.%${sanitized}%,oem_reference.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%`
      );
    }

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ getPartsInventory error:", error);
      return { success: false, error };
    }

    return { success: true, data: data || [], count: count || 0 };
  } catch (err) {
    console.error("❌ getPartsInventory unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function getPartById(partId) {
  if (!partId) return { success: false, error: new Error("Missing partId") };
  try {
    const { data, error } = await supabase
      .from("parts_catalog")
      .select(PART_COLUMNS)
      .eq("id", partId)
      .maybeSingle();

    if (error) {
      console.error("❌ getPartById error:", error);
      return { success: false, error };
    }

    if (!data) {
      return { success: false, error: new Error("Part not found") };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ getPartById unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function createPart(part, { userId } = {}) {
  if (!part?.part_number || !part?.name) {
    return {
      success: false,
      error: new Error("Part number and name are required"),
    };
  }

  const payload = {
    ...part,
    created_by: userId || null,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_catalog")
      .insert([payload])
      .select(PART_COLUMNS)
      .single();

    if (error) {
      console.error("❌ createPart error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ createPart unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function updatePart(partId, updates, { userId } = {}) {
  if (!partId) {
    return { success: false, error: new Error("Missing partId") };
  }

  const payload = {
    ...updates,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_catalog")
      .update(payload)
      .eq("id", partId)
      .select(PART_COLUMNS)
      .single();

    if (error) {
      console.error("❌ updatePart error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ updatePart unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function adjustPartQuantities(
  partId,
  { stockDelta = 0, reservedDelta = 0, onOrderDelta = 0 } = {}
) {
  if (!partId) {
    return {
      success: false,
      error: new Error("Part ID is required to adjust quantities"),
    };
  }

  try {
    const { data: currentData, error: fetchError } = await supabase
      .from("parts_catalog")
      .select("qty_in_stock, qty_reserved, qty_on_order")
      .eq("id", partId)
      .maybeSingle();

    if (fetchError) {
      console.error("❌ adjustPartQuantities fetch error:", fetchError);
      return { success: false, error: fetchError };
    }

    if (!currentData) {
      return { success: false, error: new Error("Part not found") };
    }

    const nextValues = {
      qty_in_stock: currentData.qty_in_stock + stockDelta,
      qty_reserved: Math.max(
        0,
        (currentData.qty_reserved || 0) + reservedDelta
      ),
      qty_on_order: Math.max(
        0,
        (currentData.qty_on_order || 0) + onOrderDelta
      ),
    };

    const { data, error } = await supabase
      .from("parts_catalog")
      .update(nextValues)
      .eq("id", partId)
      .select(PART_COLUMNS)
      .single();

    if (error) {
      console.error("❌ adjustPartQuantities update error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ adjustPartQuantities unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function deletePart(partId) {
  if (!partId) {
    return { success: false, error: new Error("Missing partId") };
  }

  try {
    const { error } = await supabase
      .from("parts_catalog")
      .delete()
      .eq("id", partId);

    if (error) {
      console.error("❌ deletePart error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ deletePart unexpected error:", err);
    return { success: false, error: err };
  }
}

/* ============================================
   JOB PARTS / ALLOCATIONS
============================================ */
export async function getJobParts(jobId) {
  if (!jobId) {
    return { success: false, error: new Error("Missing jobId") };
  }

  try {
    const { data, error } = await supabase
      .from("parts_job_items")
      .select(JOB_ITEM_COLUMNS)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ getJobParts error:", error);
      return { success: false, error };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error("❌ getJobParts unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function getJobPartById(jobPartId) {
  if (!jobPartId) {
    return { success: false, error: new Error("Missing jobPartId") };
  }

  try {
    const { data, error } = await supabase
      .from("parts_job_items")
      .select(JOB_ITEM_COLUMNS)
      .eq("id", jobPartId)
      .maybeSingle();

    if (error) {
      console.error("❌ getJobPartById error:", error);
      return { success: false, error };
    }

    if (!data) {
      return { success: false, error: new Error("Job part not found") };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ getJobPartById unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function createJobPart(jobId, payload, { userId } = {}) {
  if (!jobId || !payload?.part_id) {
    return {
      success: false,
      error: new Error("Job ID and part ID are required"),
    };
  }

  const insertPayload = {
    ...payload,
    job_id: jobId,
    created_by: userId || null,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_job_items")
      .insert([insertPayload])
      .select(JOB_ITEM_COLUMNS)
      .single();

    if (error) {
      console.error("❌ createJobPart error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ createJobPart unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function updateJobPart(jobPartId, updates, { userId } = {}) {
  if (!jobPartId) {
    return { success: false, error: new Error("Missing jobPartId") };
  }

  const payload = {
    ...updates,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_job_items")
      .update(payload)
      .eq("id", jobPartId)
      .select(JOB_ITEM_COLUMNS)
      .single();

    if (error) {
      console.error("❌ updateJobPart error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ updateJobPart unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function deleteJobPart(jobPartId) {
  if (!jobPartId) {
    return { success: false, error: new Error("Missing jobPartId") };
  }

  try {
    const { error } = await supabase
      .from("parts_job_items")
      .delete()
      .eq("id", jobPartId);

    if (error) {
      console.error("❌ deleteJobPart error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ deleteJobPart unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function recordStockMovement(movement) {
  if (!movement?.part_id || !movement?.movement_type || !movement?.quantity) {
    return {
      success: false,
      error: new Error("Movement requires part, type, and quantity"),
    };
  }

  try {
    const { data, error } = await supabase
      .from("parts_stock_movements")
      .insert([movement])
      .select("*")
      .single();

    if (error) {
      console.error("❌ recordStockMovement error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ recordStockMovement unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function fetchJobWithParts(searchTerm) {
  if (!searchTerm) {
    return { success: false, error: new Error("Search term is required") };
  }

  try {
    const job = await getJobByNumberOrReg(searchTerm);
    if (!job) {
      return {
        success: false,
        error: new Error("Job card not found for provided search term"),
      };
    }

    const partsResult = await getJobParts(job.id);
    if (!partsResult.success) {
      return partsResult;
    }

    return {
      success: true,
      data: {
        job,
        parts: partsResult.data,
      },
    };
  } catch (err) {
    console.error("❌ fetchJobWithParts unexpected error:", err);
    return { success: false, error: err };
  }
}

/* ============================================
   DELIVERIES
============================================ */
export async function listDeliveries({
  status,
  limit = 50,
  offset = 0,
} = {}) {
  try {
    let query = supabase
      .from("parts_deliveries")
      .select(DELIVERY_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error("❌ listDeliveries error:", error);
      return { success: false, error };
    }

    return { success: true, data: data || [], count: count || 0 };
  } catch (err) {
    console.error("❌ listDeliveries unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function createDelivery(delivery, { userId } = {}) {
  const payload = {
    ...delivery,
    created_by: userId || null,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_deliveries")
      .insert([payload])
      .select(DELIVERY_COLUMNS)
      .single();

    if (error) {
      console.error("❌ createDelivery error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ createDelivery unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function updateDelivery(deliveryId, updates, { userId } = {}) {
  if (!deliveryId) {
    return { success: false, error: new Error("Missing deliveryId") };
  }

  const payload = {
    ...updates,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_deliveries")
      .update(payload)
      .eq("id", deliveryId)
      .select(DELIVERY_COLUMNS)
      .single();

    if (error) {
      console.error("❌ updateDelivery error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ updateDelivery unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function deleteDelivery(deliveryId) {
  if (!deliveryId) {
    return { success: false, error: new Error("Missing deliveryId") };
  }

  try {
    const { error } = await supabase
      .from("parts_deliveries")
      .delete()
      .eq("id", deliveryId);

    if (error) {
      console.error("❌ deleteDelivery error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ deleteDelivery unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function createDeliveryItem(deliveryId, item, { userId } = {}) {
  if (!deliveryId || !item?.part_id) {
    return {
      success: false,
      error: new Error("Delivery ID and part ID are required"),
    };
  }

  const payload = {
    ...item,
    delivery_id: deliveryId,
    created_by: userId || null,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_delivery_items")
      .insert([payload])
      .select(
        `
        id,
        delivery_id,
        part_id,
        job_id,
        quantity_ordered,
        quantity_received,
        unit_cost,
        unit_price,
        status,
        notes,
        created_at,
        updated_at,
        part:part_id (${PART_COLUMNS})
      `
      )
      .single();

    if (error) {
      console.error("❌ createDeliveryItem error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ createDeliveryItem unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function updateDeliveryItem(deliveryItemId, updates, { userId } = {}) {
  if (!deliveryItemId) {
    return { success: false, error: new Error("Missing deliveryItemId") };
  }

  const payload = {
    ...updates,
    updated_by: userId || null,
  };

  try {
    const { data, error } = await supabase
      .from("parts_delivery_items")
      .update(payload)
      .eq("id", deliveryItemId)
      .select(
        `
        id,
        delivery_id,
        part_id,
        job_id,
        quantity_ordered,
        quantity_received,
        unit_cost,
        unit_price,
        status,
        notes,
        created_at,
        updated_at,
        part:part_id (${PART_COLUMNS})
      `
      )
      .single();

    if (error) {
      console.error("❌ updateDeliveryItem error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ updateDeliveryItem unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function deleteDeliveryItem(deliveryItemId) {
  if (!deliveryItemId) {
    return { success: false, error: new Error("Missing deliveryItemId") };
  }

  try {
    const { error } = await supabase
      .from("parts_delivery_items")
      .delete()
      .eq("id", deliveryItemId);

    if (error) {
      console.error("❌ deleteDeliveryItem error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("❌ deleteDeliveryItem unexpected error:", err);
    return { success: false, error: err };
  }
}

export async function getDeliveryItemById(deliveryItemId) {
  if (!deliveryItemId) {
    return { success: false, error: new Error("Missing deliveryItemId") };
  }

  try {
    const { data, error } = await supabase
      .from("parts_delivery_items")
      .select(
        `
        id,
        delivery_id,
        part_id,
        job_id,
        quantity_ordered,
        quantity_received,
        unit_cost,
        unit_price,
        status,
        notes,
        created_at,
        updated_at,
        part:part_id (${PART_COLUMNS})
      `
      )
      .eq("id", deliveryItemId)
      .maybeSingle();

    if (error) {
      console.error("❌ getDeliveryItemById error:", error);
      return { success: false, error };
    }

    if (!data) {
      return { success: false, error: new Error("Delivery item not found") };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ getDeliveryItemById unexpected error:", err);
    return { success: false, error: err };
  }
}

/* ============================================
   MANAGER SUMMARY
============================================ */
export async function getPartsManagerSummary() {
  try {
    const { data, error } = await supabase
      .from("parts_manager_summary")
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("❌ getPartsManagerSummary error:", error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err) {
    console.error("❌ getPartsManagerSummary unexpected error:", err);
    return { success: false, error: err };
  }
}
