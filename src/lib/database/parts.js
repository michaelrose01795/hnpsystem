// ✅ Connected to Supabase (server-side)
// ✅ Imports converted to use absolute alias "@/"
// file location: src/lib/database/parts.js
import { getDatabaseClient } from "@/lib/database/client"; // Import the shared Supabase client accessor for all parts-related queries.

const db = getDatabaseClient(); // Cache the Supabase client for repeated operations.
const PARTS_TABLE = "parts_catalog"; // Primary catalog table that stores each part definition.
const DELIVERIES_TABLE = "parts_deliveries"; // Table that tracks supplier deliveries.
const DELIVERY_ITEMS_TABLE = "parts_delivery_items"; // Table linking deliveries to specific parts.
const STOCK_MOVEMENTS_TABLE = "parts_stock_movements"; // Table capturing every inventory adjustment.

const PART_COLUMNS = [ // Canonical column list for the parts catalog.
  "id", // Primary key (UUID).
  "part_number", // Unique part number string.
  "name", // Descriptive part name.
  "description", // Optional description text.
  "category", // Optional category label.
  "supplier", // Preferred supplier.
  "oem_reference", // Optional OEM reference string.
  "barcode", // Optional barcode.
  "unit_cost", // Numeric cost price.
  "unit_price", // Numeric sell price.
  "qty_in_stock", // Quantity currently available.
  "qty_reserved", // Quantity on hold for jobs.
  "qty_on_order", // Quantity on order from suppliers.
  "reorder_level", // Threshold for reordering.
  "storage_location", // Physical bin location.
  "service_default_zone", // Preferred workshop zone.
  "sales_default_zone", // Preferred sales zone.
  "stairs_default_zone", // Preferred upstairs zone.
  "notes", // Internal notes.
  "is_active", // Whether the part is available.
  "created_by", // UUID of the creator.
  "updated_by", // UUID of the last editor.
  "created_at", // Creation timestamp.
  "updated_at", // Update timestamp.
].join(", "); // Convert array into Supabase select string.

const DELIVERY_COLUMNS = [ // Canonical column list for parts_deliveries.
  "id", // Primary key (UUID).
  "supplier", // Supplier name.
  "order_reference", // Supplier order reference.
  "status", // Workflow status (ordering, received, etc.).
  "expected_date", // Estimated delivery date.
  "received_date", // Actual receipt date.
  "notes", // Freeform notes.
  "created_by", // UUID of creator.
  "updated_by", // UUID of last editor.
  "created_at", // Creation timestamp.
  "updated_at", // Update timestamp.
].join(", "); // Join for select statements.

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


const JOB_ITEMS_TABLE = "parts_job_items"; // Table linking jobs to the parts allocated against them.
const JOB_ITEM_COLUMNS = [ // Canonical column list for parts_job_items.
  "id", // Primary key (UUID).
  "job_id", // Foreign key referencing jobs.id.
  "part_id", // Foreign key referencing parts_catalog.id.
  "quantity_requested", // Quantity requested by workshop.
  "quantity_allocated", // Quantity allocated from stock.
  "quantity_fitted", // Quantity fitted to the vehicle.
  "status", // Workflow status for the part allocation.
  "created_at", // Timestamp when the record was created.
  "updated_at", // Timestamp when the record was updated.
  "request_notes", // Optional notes captured at request time.
  "pre_pick_location", // Optional pre-pick bin location.
  "storage_location", // Storage bin for the part.
  "unit_cost", // Unit cost captured for the allocation.
  "unit_price", // Unit price captured for the allocation.
  "origin", // Origin of the request (vhc, direct, etc.).
  "allocated_by", // User id who allocated the part.
  "picked_by", // User id who picked the part.
  "fitted_by", // User id who fitted the part.
].join(", "); // Join for select statements.

const JOB_ITEM_STATUS_SET = new Set([ // Enumerate allowed status transitions for validation.
  "pending",
  "awaiting_stock",
  "allocated",
  "picked",
  "fitted",
  "cancelled",
]); // Close set definition.

const mapJobItemRow = (row = {}) => ({ // Normalise parts_job_items rows into camelCase.
  id: row.id, // Primary key UUID.
  jobId: row.job_id, // Associated job id.
  partId: row.part_id, // Associated part UUID.
  quantityRequested: row.quantity_requested, // Requested quantity.
  quantityAllocated: row.quantity_allocated, // Allocated quantity.
  quantityFitted: row.quantity_fitted, // Fitted quantity.
  status: row.status, // Current workflow status.
  requestNotes: row.request_notes, // Optional notes field.
  prePickLocation: row.pre_pick_location, // Pre-pick location reference.
  storageLocation: row.storage_location, // Storage bin reference.
  unitCost: row.unit_cost, // Unit cost captured.
  unitPrice: row.unit_price, // Unit price captured.
  origin: row.origin, // Origin of the allocation.
  allocatedBy: row.allocated_by, // User id for allocation action.
  pickedBy: row.picked_by, // User id for picking action.
  fittedBy: row.fitted_by, // User id for fitting action.
  createdAt: row.created_at, // Creation timestamp.
  updatedAt: row.updated_at, // Update timestamp.
  part: row.part
    ? { // Map joined part information when requested.
        id: row.part.id, // Part UUID.
        partNumber: row.part.part_number, // Part number string.
        name: row.part.name, // Part name string.
      }
    : null, // Null when no join requested.
}); // Close mapper helper.

const assertJobItemStatus = (status) => { // Validate job item status values.
  if (!status) { // Reject falsy inputs.
    throw new Error('status is required'); // Provide validation feedback.
  } // Close null guard.
  const normalised = status.toLowerCase(); // Normalise case for comparison.
  if (!JOB_ITEM_STATUS_SET.has(normalised)) { // Ensure the status is permitted.
    throw new Error(`Invalid job item status: ${status}`); // Provide descriptive error.
  } // Close validation guard.
  return normalised; // Return the normalised status value.
}; // End assertJobItemStatus helper.


const toInteger = (value, fallback = 0) => { // Safely convert numeric inputs to integers.
  if (value === null || value === undefined || value === "") { // Treat empty inputs as fallback.
    return fallback; // Return fallback when empty.
  } // Close guard.
  const parsed = Number.parseInt(value, 10); // Attempt integer coercion.
  return Number.isNaN(parsed) ? fallback : parsed; // Return fallback on NaN.
}; // End toInteger helper.

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

export const getPartById = async (partId) => { // Retrieve a single part by UUID primary key.
  if (!partId) { // Validate input presence.
    throw new Error("getPartById requires a partId."); // Provide descriptive validation error.
  } // Close guard.
  const { data, error } = await db // Execute select query.
    .from(PARTS_TABLE) // Target catalog table.
    .select(PART_COLUMNS) // Fetch canonical columns.
    .eq("id", partId) // Filter by UUID.
    .maybeSingle(); // Expect zero or one row.
  if (error) { // Handle query errors.
    throw new Error(`Failed to fetch part ${partId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return data ? mapPartRow(data) : null; // Return mapped row or null.
}; // End getPartById.

export const createPart = async (payload) => { // Insert a new part definition.
  const required = ["part_number", "name"]; // part_number and name are NOT NULL in schema.
  const missing = required.filter((field) => !payload?.[field]); // Determine missing required fields.
  if (missing.length) { // If any required fields missing, throw.
    throw new Error(`Missing required part fields: ${missing.join(", ")}`); // Provide detail for debugging.
  } // Close guard.
  const { data, error } = await db // Execute insert.
    .from(PARTS_TABLE) // Target catalog table.
    .insert([payload]) // Insert provided payload.
    .select(PART_COLUMNS) // Return canonical columns.
    .single(); // Expect a single row back.
  if (error) { // Handle insert failure.
    throw new Error(`Failed to create part: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapPartRow(data); // Return inserted row.
}; // End createPart.

export const updatePart = async (partId, updates = {}) => { // Modify an existing part.
  if (!partId) { // Validate input.
    throw new Error("updatePart requires a partId."); // Provide validation error.
  } // Close guard.
  if (Object.keys(updates).length === 0) { // Prevent empty updates.
    throw new Error("updatePart requires at least one field to update."); // Provide feedback.
  } // Close guard.
  const { data, error } = await db // Execute update.
    .from(PARTS_TABLE) // Target catalog table.
    .update(updates) // Apply provided changes.
    .eq("id", partId) // Restrict to specific part.
    .select(PART_COLUMNS) // Return canonical columns.
    .single(); // Expect one row.
  if (error) { // Handle update errors.
    throw new Error(`Failed to update part ${partId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapPartRow(data); // Return updated row.
}; // End updatePart.

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


export const listJobItems = async (jobId) => { // Fetch all parts assigned to a specific job.
  if (!jobId) { // Validate job identifier.
    throw new Error('listJobItems requires a jobId.'); // Provide validation feedback.
  } // Close guard.
  const { data, error } = await db // Execute select query.
    .from(JOB_ITEMS_TABLE) // Target parts_job_items table.
    .select(`${JOB_ITEM_COLUMNS}, part:part_id(id, part_number, name)`) // Fetch canonical columns plus part metadata.
    .eq('job_id', jobId) // Filter by job.
    .order('created_at', { ascending: true }); // Order chronologically for UI consistency.
  if (error) { // Handle database errors.
    throw new Error(`Failed to list job items for job ${jobId}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return (data || []).map(mapJobItemRow); // Map rows into camelCase objects.
}; // End listJobItems.

export const createJobItem = async (payload = {}) => { // Insert a new parts_job_items row.
  const jobId = payload.job_id ?? payload.jobId; // Accept both camelCase and snake_case inputs.
  const partId = payload.part_id ?? payload.partId; // Accept both casing variants for part reference.
  if (!jobId) { // Ensure job id is present.
    throw new Error('createJobItem requires job_id.'); // Provide validation feedback.
  } // Close guard.
  if (!partId) { // Ensure part id is present.
    throw new Error('createJobItem requires part_id.'); // Provide validation feedback.
  } // Close guard.
  const status = assertJobItemStatus(payload.status || 'pending'); // Normalise and validate status.
  const row = { // Build insert payload in snake_case.
    job_id: jobId, // Persist job id reference.
    part_id: partId, // Persist part reference.
    quantity_requested: toInteger(payload.quantity_requested ?? payload.quantityRequested ?? 0, 0), // Normalise requested quantity.
    quantity_allocated: toInteger(payload.quantity_allocated ?? payload.quantityAllocated ?? 0, 0), // Normalise allocated quantity.
    quantity_fitted: toInteger(payload.quantity_fitted ?? payload.quantityFitted ?? 0, 0), // Normalise fitted quantity.
    status, // Persist validated status.
    request_notes: payload.request_notes ?? payload.requestNotes ?? null, // Optional notes.
    pre_pick_location: payload.pre_pick_location ?? payload.prePickLocation ?? null, // Optional pre-pick location.
    storage_location: payload.storage_location ?? payload.storageLocation ?? null, // Optional storage bin.
    unit_cost: payload.unit_cost ?? payload.unitCost ?? null, // Optional unit cost.
    unit_price: payload.unit_price ?? payload.unitPrice ?? null, // Optional unit price.
    origin: payload.origin ?? null, // Optional origin.
    allocated_by: payload.allocated_by ?? payload.allocatedBy ?? null, // Optional allocated-by reference.
    picked_by: payload.picked_by ?? payload.pickedBy ?? null, // Optional picked-by reference.
    fitted_by: payload.fitted_by ?? payload.fittedBy ?? null, // Optional fitted-by reference.
  }; // Close insert payload.
  const { data, error } = await db // Execute insert.
    .from(JOB_ITEMS_TABLE) // Target parts_job_items table.
    .insert([row]) // Insert the row.
    .select(`${JOB_ITEM_COLUMNS}, part:part_id(id, part_number, name)`) // Return canonical columns plus joined part info.
    .single(); // Expect exactly one inserted row.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to create job item: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapJobItemRow(data); // Return mapped row.
}; // End createJobItem.

export const updateJobItem = async (id, updates = {}) => { // Patch an existing parts_job_items row.
  if (!id) { // Validate identifier presence.
    throw new Error('updateJobItem requires an id.'); // Provide validation feedback.
  } // Close guard.
  const row = {}; // Prepare payload container.
  if (Object.prototype.hasOwnProperty.call(updates, 'quantity_requested') || Object.prototype.hasOwnProperty.call(updates, 'quantityRequested')) { // Detect requested quantity updates.
    row.quantity_requested = toInteger(updates.quantity_requested ?? updates.quantityRequested, 0); // Normalise to integer.
  } // Close requested branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'quantity_allocated') || Object.prototype.hasOwnProperty.call(updates, 'quantityAllocated')) { // Detect allocated quantity updates.
    row.quantity_allocated = toInteger(updates.quantity_allocated ?? updates.quantityAllocated, 0); // Normalise to integer.
  } // Close allocated branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'quantity_fitted') || Object.prototype.hasOwnProperty.call(updates, 'quantityFitted')) { // Detect fitted quantity updates.
    row.quantity_fitted = toInteger(updates.quantity_fitted ?? updates.quantityFitted, 0); // Normalise to integer.
  } // Close fitted branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) { // Detect status updates.
    row.status = assertJobItemStatus(updates.status); // Validate and normalise status.
  } // Close status branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'request_notes') || Object.prototype.hasOwnProperty.call(updates, 'requestNotes')) { // Detect notes update.
    row.request_notes = updates.request_notes ?? updates.requestNotes ?? null; // Allow null.
  } // Close notes branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'pre_pick_location') || Object.prototype.hasOwnProperty.call(updates, 'prePickLocation')) { // Detect pre-pick location update.
    row.pre_pick_location = updates.pre_pick_location ?? updates.prePickLocation ?? null; // Allow null.
  } // Close pre-pick branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'storage_location') || Object.prototype.hasOwnProperty.call(updates, 'storageLocation')) { // Detect storage location update.
    row.storage_location = updates.storage_location ?? updates.storageLocation ?? null; // Allow null.
  } // Close storage branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'unit_cost') || Object.prototype.hasOwnProperty.call(updates, 'unitCost')) { // Detect unit cost update.
    row.unit_cost = updates.unit_cost ?? updates.unitCost ?? null; // Allow null.
  } // Close unit cost branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'unit_price') || Object.prototype.hasOwnProperty.call(updates, 'unitPrice')) { // Detect unit price update.
    row.unit_price = updates.unit_price ?? updates.unitPrice ?? null; // Allow null.
  } // Close unit price branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'origin')) { // Detect origin update.
    row.origin = updates.origin ?? null; // Allow null.
  } // Close origin branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'allocated_by') || Object.prototype.hasOwnProperty.call(updates, 'allocatedBy')) { // Detect allocated-by update.
    row.allocated_by = updates.allocated_by ?? updates.allocatedBy ?? null; // Allow null.
  } // Close allocated-by branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'picked_by') || Object.prototype.hasOwnProperty.call(updates, 'pickedBy')) { // Detect picked-by update.
    row.picked_by = updates.picked_by ?? updates.pickedBy ?? null; // Allow null.
  } // Close picked-by branch.
  if (Object.prototype.hasOwnProperty.call(updates, 'fitted_by') || Object.prototype.hasOwnProperty.call(updates, 'fittedBy')) { // Detect fitted-by update.
    row.fitted_by = updates.fitted_by ?? updates.fittedBy ?? null; // Allow null.
  } // Close fitted-by branch.
  if (Object.keys(row).length === 0) { // Ensure at least one field supplied.
    throw new Error('No valid fields provided to update job item.'); // Provide validation feedback.
  } // Close guard.
  row.updated_at = new Date().toISOString(); // Stamp update time for audit trail.
  const { data, error } = await db // Execute update.
    .from(JOB_ITEMS_TABLE) // Target parts_job_items table.
    .update(row) // Apply patch payload.
    .eq('id', id) // Filter by primary key.
    .select(`${JOB_ITEM_COLUMNS}, part:part_id(id, part_number, name)`) // Return canonical columns plus part metadata.
    .maybeSingle(); // Expect zero or one row.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to update job item ${id}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return data ? mapJobItemRow(data) : null; // Return mapped row or null if not found.
}; // End updateJobItem.

export const deleteJobItem = async (id) => { // Remove a parts_job_items row by id.
  if (!id) { // Validate identifier presence.
    throw new Error('deleteJobItem requires an id.'); // Provide validation feedback.
  } // Close guard.
  const { error } = await db // Execute delete.
    .from(JOB_ITEMS_TABLE) // Target parts_job_items table.
    .delete() // Perform deletion.
    .eq('id', id); // Filter by primary key.
  if (error) { // Handle Supabase errors.
    throw new Error(`Failed to delete job item ${id}: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return true; // Indicate successful deletion.
}; // End deleteJobItem.

export const recordStockMovement = async (payload) => { // Insert a stock movement entry for auditing inventory adjustments.
  const required = ["part_id", "movement_type", "quantity"]; // Required columns according to schema.
  const missing = required.filter((field) => !payload?.[field] && payload?.[field] !== 0); // Determine missing values while allowing zero quantities if needed.
  if (missing.length) { // Throw when required fields absent.
    throw new Error(`Missing required stock movement fields: ${missing.join(", ")}`); // Provide descriptive feedback.
  } // Close guard.
  const { data, error } = await db // Execute insert.
    .from(STOCK_MOVEMENTS_TABLE) // Target stock movements table.
    .insert([payload]) // Insert payload row.
    .select(STOCK_MOVEMENT_COLUMNS) // Return canonical columns.
    .single(); // Expect one row.
  if (error) { // Handle errors.
    throw new Error(`Failed to record stock movement: ${error.message}`); // Provide diagnostics.
  } // Close guard.
  return mapStockMovementRow(data); // Return inserted row.
}; // End recordStockMovement.

// This parts data layer now provides schema-accurate helpers for catalog management, delivery tracking, and stock movement auditing.
