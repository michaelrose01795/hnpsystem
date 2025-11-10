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
