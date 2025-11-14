// file location: src/lib/database/parts.js
import { getDatabaseClient } from "@/lib/database/client"; // Shared Supabase service client accessor
import { getJobByNumberOrReg } from "@/lib/database/jobs"; // Job helper to reuse existing job/vehicle lookups

const db = getDatabaseClient(); // Instantiate a single Supabase client for all parts operations

const PARTS_TABLE = "parts_catalog"; // Canonical table for part definitions
const JOB_PART_ITEMS_TABLE = "parts_job_items"; // Table that links jobs to allocated parts
const DELIVERIES_TABLE = "parts_deliveries"; // Supplier deliveries master table
const DELIVERY_ITEMS_TABLE = "parts_delivery_items"; // Individual delivery line items
const STOCK_MOVEMENTS_TABLE = "parts_stock_movements"; // Audit table for stock adjustments

const DELIVERY_COLUMNS = [
  "id",
  "supplier",
  "order_reference",
  "status",
  "expected_date",
  "received_date",
  "notes",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
].join(", "); // Columns returned for deliveries

const DELIVERY_ITEM_COLUMNS = [ // Canonical column list for parts_delivery_items.
  "id", // Primary key (UUID).
  "delivery_id", // FK to parts_deliveries.id.
  "part_id", // FK to parts_catalog.id.
  "job_id", // Optional FK to jobs.id if the part was for a specific job.
  "quantity_ordered", // Quantity placed on the supplier order.
  "quantity_received", // Quantity received so far.
  "unit_cost", // Cost price on this order.
  "unit_price", // Sell price allocated to the job/customer.
  "status", // Workflow status (ordered, received, etc.).
  "notes", // Internal notes.
  "created_by", // UUID of creator.
  "updated_by", // UUID of last editor.
  "created_at", // Creation timestamp.
  "updated_at", // Update timestamp.
].join(", "); // Join for select statements.

const STOCK_MOVEMENT_COLUMNS = [ // Canonical column list for parts_stock_movements.
  "id", // Primary key (UUID).
  "part_id", // FK to parts_catalog.id whose stock changed.
  "job_item_id", // Optional reference to a job-specific parts item.
  "delivery_item_id", // Optional reference to the delivery item that caused the movement.
  "movement_type", // Describes whether stock moved in, out, or was adjusted.
  "quantity", // Numeric quantity moved.
  "unit_cost", // Cost price associated with the movement.
  "unit_price", // Sell price associated with the movement.
  "reference", // Freeform reference string.
  "notes", // Additional notes.
  "performed_by", // UUID of the staff member performing the move.
  "created_at", // Timestamp when the movement was recorded.
].join(", "); // Join for select statements.

const mapPartRow = (row = {}) => ({ // Normalize part rows into camelCase.
  id: row.id, // Part UUID.
  partNumber: row.part_number, // Part number string.
  name: row.name, // Human-friendly name.
  description: row.description, // Optional description.
  category: row.category, // Optional category label.
  supplier: row.supplier, // Supplier name.
  oemReference: row.oem_reference, // OEM reference string.
  barcode: row.barcode, // Barcode string.
  unitCost: row.unit_cost, // Cost price numeric.
  unitPrice: row.unit_price, // Sell price numeric.
  qtyInStock: row.qty_in_stock, // Current stock quantity.
  qtyReserved: row.qty_reserved, // Reserved quantity.
  qtyOnOrder: row.qty_on_order, // On-order quantity.
  reorderLevel: row.reorder_level, // Reorder threshold.
  storageLocation: row.storage_location, // Physical bin.
  serviceDefaultZone: row.service_default_zone, // Default service zone.
  salesDefaultZone: row.sales_default_zone, // Default sales zone.
  stairsDefaultZone: row.stairs_default_zone, // Default upstairs zone.
  notes: row.notes, // Notes text.
  isActive: row.is_active, // Availability flag.
  createdBy: row.created_by, // Creator UUID.
  updatedBy: row.updated_by, // Updater UUID.
  createdAt: row.created_at, // Creation timestamp.
  updatedAt: row.updated_at, // Update timestamp.
}); // Close mapper.

const mapDeliveryRow = (row = {}) => ({ // Normalize delivery rows.
  id: row.id, // Delivery UUID.
  supplier: row.supplier, // Supplier name.
  orderReference: row.order_reference, // Supplier reference.
  status: row.status, // Workflow status string.
  expectedDate: row.expected_date, // Estimated arrival date.
  receivedDate: row.received_date, // Actual receipt date.
  notes: row.notes, // Notes blob.
  createdBy: row.created_by, // Creator UUID.
  updatedBy: row.updated_by, // Updater UUID.
  createdAt: row.created_at, // Creation timestamp.
  updatedAt: row.updated_at, // Update timestamp.
}); // Close mapper.

const mapDeliveryItemRow = (row = {}) => ({ // Normalize delivery item rows.
  id: row.id, // Delivery item UUID.
  deliveryId: row.delivery_id, // Parent delivery UUID.
  partId: row.part_id, // Referenced part UUID.
  jobId: row.job_id, // Optional job id.
  quantityOrdered: row.quantity_ordered, // Ordered quantity.
  quantityReceived: row.quantity_received, // Received quantity.
  unitCost: row.unit_cost, // Cost price at purchase.
  unitPrice: row.unit_price, // Sell price allocated to a job.
  status: row.status, // Workflow status.
  notes: row.notes, // Notes blob.
  createdBy: row.created_by, // Creator UUID.
  updatedBy: row.updated_by, // Updater UUID.
  createdAt: row.created_at, // Creation timestamp.
  updatedAt: row.updated_at, // Update timestamp.
}); // Close mapper.

const mapStockMovementRow = (row = {}) => ({ // Normalize stock movement rows.
  id: row.id, // Movement UUID.
  partId: row.part_id, // Part affected.
  jobItemId: row.job_item_id, // Optional job item reference.
  deliveryItemId: row.delivery_item_id, // Optional delivery item reference.
  movementType: row.movement_type, // Type of movement.
  quantity: row.quantity, // Quantity moved.
  unitCost: row.unit_cost, // Cost price.
  unitPrice: row.unit_price, // Sell price.
  reference: row.reference, // Reference text.
  notes: row.notes, // Notes blob.
  performedBy: row.performed_by, // Staff member UUID.
  createdAt: row.created_at, // Timestamp recorded.
}); // Close mapper.

export const listPartsCatalog = async ({ search, includeInactive = false, limit = 50, offset = 0 } = {}) => { // Retrieve paginated catalog entries with optional search.
  let query = db // Start a Supabase query builder.
    .from(PARTS_TABLE) // Target the parts catalog table.
    .select(PART_COLUMNS, { count: "exact" }) // Fetch canonical columns and a total count.
    .order("name", { ascending: true }) // Order alphabetically for easier scanning.
    .range(offset, offset + limit - 1); // Apply pagination bounds.
  if (search) { // When a search term is present, apply ilike filters to several columns.
    const sanitized = search.replace(/[%_]/g, "\\$&"); // Escape wildcard characters to avoid unintended matches.
    query = query.or( // Combine OR filters across multiple searchable columns.
      [
        `part_number.ilike.%${sanitized}%`,
        `name.ilike.%${sanitized}%`,
        `oem_reference.ilike.%${sanitized}%`,
        `barcode.ilike.%${sanitized}%`,
      ].join(",") // Join filters per Supabase syntax.
    ); // Close OR clause.
  } // Close search guard.
  if (!includeInactive) { // Unless explicit, hide inactive parts.
    query = query.eq("is_active", true); // Filter to active parts only.
  } // Close inactive guard.
  const { data, error, count } = await query; // Execute the query.
  if (error) { // Handle database errors.
    throw new Error(`Failed to list parts catalog: ${error.message}`); // Provide descriptive diagnostics.
  } // Close guard.
  return { // Return both rows and total count for pagination UI.
    rows: (data || []).map(mapPartRow), // Map result rows.
    total: count ?? 0, // Provide the count from Supabase (may be null).
  }; // Close return object.
}; // End listPartsCatalog.

export const getPartById = async (partId) => {
  if (!partId) {
    return { success: false, error: new Error("Part ID is required") };
  }

  try {
    const { data, error } = await db
      .from(PARTS_TABLE)
      .select("*")
      .eq("id", partId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return { success: false, error: new Error("Part not found") };
    }

    return { success: true, data };
  } catch (error) {
    console.error("getPartById error", error);
    return { success: false, error };
  }
};

export const createPart = async (payload = {}, { userId } = {}) => {
  try {
    const insertPayload = {
      ...payload,
      created_by: userId || null,
      updated_by: userId || null,
    };

    const { data, error } = await db
      .from(PARTS_TABLE)
      .insert([insertPayload])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("createPart error", error);
    return { success: false, error };
  }
};

export const updatePart = async (partId, updates = {}, { userId } = {}) => {
  if (!partId) {
    return { success: false, error: new Error("Part ID is required") };
  }

  if (Object.keys(updates || {}).length === 0) {
    return { success: false, error: new Error("No updates provided") };
  }

  try {
    const updatePayload = {
      ...updates,
      updated_by: userId || null,
    };

    const { data, error } = await db
      .from(PARTS_TABLE)
      .update(updatePayload)
      .eq("id", partId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("updatePart error", error);
    return { success: false, error };
  }
};

export const deletePart = async (partId) => { // Remove a part from the catalog.
  if (!partId) { // Validate input.
    throw new Error("deletePart requires a partId."); // Provide validation error.
  } // Close guard.
  const { error } = await db // Execute delete.
    .from(PARTS_TABLE) // Target catalog table.
    .delete() // Run delete command.
    .eq("id", partId); // Restrict to specific part.
  if (error) { // Handle failures.
    throw new Error(`Failed to delete part ${partId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return { success: true, deletedId: partId }; // Return acknowledgement payload.
}; // End deletePart.

export const listPartDeliveries = async ({ status } = {}) => { // Retrieve deliveries optionally filtered by status.
  let query = db // Start query builder.
    .from(DELIVERIES_TABLE) // Target deliveries table.
    .select(DELIVERY_COLUMNS) // Fetch canonical columns.
    .order("created_at", { ascending: false }); // Order newest first.
  if (status) { // Apply optional status filter.
    query = query.eq("status", status); // Filter rows by status.
  } // Close guard.
  const { data, error } = await query; // Execute query.
  if (error) { // Handle errors.
    throw new Error(`Failed to list part deliveries: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return (data || []).map(mapDeliveryRow); // Return mapped results.
}; // End listPartDeliveries.

export const createPartDelivery = async (payload) => { // Insert a new delivery record.
  const defaults = { status: "ordering" }; // Schema default but set explicitly for clarity.
  const { data, error } = await db // Execute insert.
    .from(DELIVERIES_TABLE) // Target deliveries table.
    .insert([{ ...defaults, ...payload }]) // Merge defaults with payload.
    .select(DELIVERY_COLUMNS) // Return canonical columns.
    .single(); // Expect one row.
  if (error) { // Handle insert error.
    throw new Error(`Failed to create parts delivery: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapDeliveryRow(data); // Return inserted row.
}; // End createPartDelivery.

export const addDeliveryItem = async (payload) => { // Attach a part line to a delivery record.
  const required = ["delivery_id", "part_id", "quantity_ordered"]; // Columns required by schema.
  const missing = required.filter((field) => !payload?.[field]); // Determine missing fields.
  if (missing.length) { // Throw when validation fails.
    throw new Error(`Missing required delivery item fields: ${missing.join(", ")}`); // Provide diagnostics.
  } // Close guard.
  const { data, error } = await db // Execute insert.
    .from(DELIVERY_ITEMS_TABLE) // Target delivery items table.
    .insert([payload]) // Insert payload row.
    .select(DELIVERY_ITEM_COLUMNS) // Return canonical columns.
    .single(); // Expect single row.
  if (error) { // Handle insert error.
    throw new Error(`Failed to add delivery item: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapDeliveryItemRow(data); // Return inserted row.
}; // End addDeliveryItem.

export const listDeliveryItems = async (deliveryId) => { // Fetch all items for a specific delivery.
  if (!deliveryId) { // Validate input.
    throw new Error("listDeliveryItems requires a deliveryId."); // Provide validation error.
  } // Close guard.
  const { data, error } = await db // Execute select.
    .from(DELIVERY_ITEMS_TABLE) // Target delivery items table.
    .select(DELIVERY_ITEM_COLUMNS) // Fetch canonical columns.
    .eq("delivery_id", deliveryId) // Filter by parent delivery.
    .order("created_at", { ascending: true }); // Order oldest first.
  if (error) { // Handle errors.
    throw new Error(`Failed to list items for delivery ${deliveryId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return (data || []).map(mapDeliveryItemRow); // Return mapped rows.
}; // End listDeliveryItems.

export const recordStockMovement = async (payload = {}) => {
  if (!payload.part_id) {
    return { success: false, error: new Error("part_id is required for stock movement") };
  }

  if (payload.quantity === undefined || payload.quantity === null) {
    return { success: false, error: new Error("quantity is required for stock movement") };
  }

  try {
    const { data, error } = await db
      .from(STOCK_MOVEMENTS_TABLE)
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("recordStockMovement error", error);
    return { success: false, error };
  }
};

export const fetchJobWithParts = async (searchTerm) => {
  if (!searchTerm) {
    return {
      success: false,
      error: new Error("Search term is required"),
    };
  }

  try {
    const job = await getJobByNumberOrReg(searchTerm);

    if (!job) {
      return {
        success: false,
        error: new Error("Job card not found for provided search term"),
      };
    }

    const partsList = Array.isArray(job.parts_job_items)
      ? job.parts_job_items
      : job.parts || [];

    return {
      success: true,
      data: {
        job,
        parts: partsList,
      },
    };
  } catch (error) {
    console.error("fetchJobWithParts error", error);
    return { success: false, error };
  }
};

export const createJobPart = async (jobId, payload = {}, { userId } = {}) => {
  if (!jobId) {
    return { success: false, error: new Error("Job ID is required") };
  }

  if (!payload?.part_id) {
    return { success: false, error: new Error("part_id is required") };
  }

  try {
    const insertPayload = {
      ...payload,
      job_id: jobId,
      created_by: userId || null,
      updated_by: userId || null,
    };

    const { data, error } = await db
      .from(JOB_PART_ITEMS_TABLE)
      .insert([insertPayload])
      .select(JOB_PART_ITEM_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("createJobPart error", error);
    return { success: false, error };
  }
};

export const getJobPartById = async (jobPartId) => {
  if (!jobPartId) {
    return { success: false, error: new Error("Job part ID is required") };
  }

  try {
    const { data, error } = await db
      .from(JOB_PART_ITEMS_TABLE)
      .select(JOB_PART_ITEM_COLUMNS)
      .eq("id", jobPartId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return { success: false, error: new Error("Job part not found") };
    }

    return { success: true, data };
  } catch (error) {
    console.error("getJobPartById error", error);
    return { success: false, error };
  }
};

export const updateJobPart = async (jobPartId, updates = {}, { userId } = {}) => {
  if (!jobPartId) {
    return { success: false, error: new Error("Job part ID is required") };
  }

  try {
    const updatePayload = {
      ...updates,
      updated_by: userId || null,
    };

    const { data, error } = await db
      .from(JOB_PART_ITEMS_TABLE)
      .update(updatePayload)
      .eq("id", jobPartId)
      .select(JOB_PART_ITEM_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };
  } catch (error) {
    console.error("updateJobPart error", error);
    return { success: false, error };
  }
};

export const deleteJobPart = async (jobPartId) => {
  if (!jobPartId) {
    return { success: false, error: new Error("Job part ID is required") };
  }

  try {
    const { error } = await db
      .from(JOB_PART_ITEMS_TABLE)
      .delete()
      .eq("id", jobPartId);

    if (error) {
      throw error;
    }

    return { success: true, deletedId: jobPartId };
  } catch (error) {
    console.error("deleteJobPart error", error);
    return { success: false, error };
  }
};

export const getPartsManagerSummary = async () => {
  try {
    const { data, error } = await db
      .from(PARTS_TABLE)
      .select("qty_in_stock, qty_reserved, qty_on_order");

    if (error) {
      throw error;
    }

    const rows = data || [];
    const totals = rows.reduce(
      (acc, row) => ({
        totalInStock: acc.totalInStock + clampQuantity(row.qty_in_stock || 0),
        totalReserved: acc.totalReserved + clampQuantity(row.qty_reserved || 0),
        totalOnOrder: acc.totalOnOrder + clampQuantity(row.qty_on_order || 0),
      }),
      { totalInStock: 0, totalReserved: 0, totalOnOrder: 0 }
    );

    return {
      success: true,
      data: {
        partsCount: rows.length,
        totalInStock: totals.totalInStock,
        totalReserved: totals.totalReserved,
        totalOnOrder: totals.totalOnOrder,
      },
    };
  } catch (error) {
    console.error("getPartsManagerSummary error", error);
    return { success: false, error };
  }
};


// Legacy helper aliases preserved for backwards compatibility with existing imports
export const listPartsCatalog = async (options = {}) => {
  const result = await getPartsInventory({
    searchTerm: options.search || "",
    includeInactive: options.includeInactive ?? false,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
  });

  if (!result.success) {
    throw result.error;
  }

  return result.data;
};

export const createPartDelivery = async (payload, context) => {
  const result = await createDelivery(payload, context);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

export const addDeliveryItem = async (payload) => {
  const deliveryId = payload?.delivery_id;
  if (!deliveryId) {
    throw new Error("delivery_id is required");
  }
  const result = await createDeliveryItem(deliveryId, payload, {});
  if (!result.success) {
    throw result.error;
  }
  return result.data;
};

export const listDeliveryItems = async (deliveryId) => {
  if (!deliveryId) {
    throw new Error("deliveryId is required");
  }
  const { data, error } = await db
    .from(DELIVERY_ITEMS_TABLE)
    .select(DELIVERY_ITEM_COLUMNS)
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};
