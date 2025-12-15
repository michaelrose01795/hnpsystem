# Part Delivery Logging System

## Overview
This system tracks part delivery history and auto-fills delivery information when searching for parts. When you click on a part in the search results, it automatically displays the last delivery information including supplier, order reference, quantities, and unit cost.

## Database Setup

### 1. Run the SQL Migration
Execute the SQL in [src/lib/database/schema/addtable.sql](../src/lib/database/schema/addtable.sql) to create the `part_delivery_logs` table:

```sql
CREATE TABLE IF NOT EXISTS public.part_delivery_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  part_id uuid NOT NULL,
  supplier text,
  order_reference text,
  qty_ordered integer NOT NULL DEFAULT 0,
  qty_received integer NOT NULL DEFAULT 0,
  unit_cost numeric,
  delivery_date date,
  notes text,
  created_by integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT part_delivery_logs_pkey PRIMARY KEY (id),
  CONSTRAINT part_delivery_logs_part_id_fkey FOREIGN KEY (part_id) REFERENCES public.parts_catalog(id) ON DELETE CASCADE,
  CONSTRAINT part_delivery_logs_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id)
);

CREATE INDEX IF NOT EXISTS idx_part_delivery_logs_part_id ON public.part_delivery_logs(part_id);
CREATE INDEX IF NOT EXISTS idx_part_delivery_logs_created_at ON public.part_delivery_logs(created_at DESC);
```

## Features

### 1. Auto-Fill on Part Selection
When you search for a part and click on it in the search results:
- The system automatically fetches the last delivery information for that part
- Displays supplier, order reference, quantities ordered/received, unit cost, and delivery date
- This information is shown in a highlighted box within the selected part details

### 2. Delivery History Tracking
Every part delivery is logged with:
- **Supplier**: The supplier who provided the part
- **Order Reference**: The purchase order or delivery reference number
- **Qty Ordered**: How many units were ordered
- **Qty Received**: How many units were actually received (can differ from ordered)
- **Unit Cost**: The cost per unit for this delivery
- **Delivery Date**: When the delivery was received
- **Notes**: Any additional information about the delivery

## API Endpoints

### Get Last Delivery for a Part
```
GET /api/parts/delivery-logs/[partId]
```
Returns the most recent delivery log for the specified part.

**Response:**
```json
{
  "success": true,
  "deliveryLog": {
    "id": "uuid",
    "part_id": "uuid",
    "supplier": "Supplier Name",
    "order_reference": "PO-12345",
    "qty_ordered": 10,
    "qty_received": 10,
    "unit_cost": 25.50,
    "delivery_date": "2025-12-15",
    "notes": "Delivered on time",
    "created_at": "2025-12-15T10:30:00Z"
  }
}
```

### Get All Delivery Logs
```
GET /api/parts/delivery-logs?partId=[partId]&limit=10
```
Returns all delivery logs for a part (or all parts if partId not specified).

### Create a Delivery Log
```
POST /api/parts/delivery-logs
```

**Request Body:**
```json
{
  "partId": "uuid",
  "supplier": "Supplier Name",
  "orderReference": "PO-12345",
  "qtyOrdered": 10,
  "qtyReceived": 10,
  "unitCost": 25.50,
  "deliveryDate": "2025-12-15",
  "notes": "Optional notes",
  "userNumericId": 1
}
```

## Components

### PartDeliveryLogModal
Location: [src/components/Parts/PartDeliveryLogModal.js](../src/components/Parts/PartDeliveryLogModal.js)

A modal component for logging new part deliveries with auto-fill from the last delivery.

**Usage:**
```jsx
import PartDeliveryLogModal from "@/components/Parts/PartDeliveryLogModal";

<PartDeliveryLogModal
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  selectedPart={selectedPart}
  onDeliveryLogged={(log) => {
    console.log("Delivery logged:", log);
    // Refresh your data here
  }}
/>
```

### PartSearchModal (Updated)
Location: [src/components/VHC/PartSearchModal.js](../src/components/VHC/PartSearchModal.js)

Now displays last delivery information when a part is selected:
- Automatically fetches delivery history when a part is clicked
- Shows supplier, order reference, quantities, unit cost, and date
- Information appears in a highlighted info box below the part details

## Workflow Example

1. **Search for a Part**: User searches for "FPAD1" (Front brake pads)
2. **Click on Part**: User clicks on the part in search results
3. **View Auto-Filled Info**: System displays:
   - Part details (name, part number, stock levels)
   - **Last Delivery Info** (supplier, order ref, quantities, cost, date)
4. **Use the Information**: The delivery history helps users:
   - Know which supplier to order from
   - Reference previous order numbers
   - See typical order quantities
   - Check the last purchase price

## Integration with Existing Systems

This delivery logging system complements the existing `parts_delivery_items` table:
- **parts_delivery_items**: Tracks actual deliveries linked to delivery batches
- **part_delivery_logs**: Simple historical log for quick reference and auto-fill

Both systems can coexist, with `part_delivery_logs` providing a lightweight history view.

## Future Enhancements

Potential improvements:
1. Show multiple past deliveries instead of just the last one
2. Calculate average unit cost across deliveries
3. Alert if current price differs significantly from historical average
4. Auto-suggest reorder quantities based on typical order sizes
5. Integration with the main parts delivery system to auto-create logs

## Testing

To test the system:

1. **Create the table**: Run the SQL migration
2. **Search for a part**: Use the PartSearchModal to search for any part
3. **Select a part**: Click on a part - you'll see "No previous delivery" if none logged
4. **Log a delivery**: Use the PartDeliveryLogModal to log a delivery
5. **Search again**: Select the same part and verify the delivery info appears
6. **Verify auto-fill**: The supplier, order ref, and cost should match what you logged

## Troubleshooting

### Delivery history not showing
- Check that the `part_delivery_logs` table exists
- Verify API endpoints are accessible at `/api/parts/delivery-logs/`
- Check browser console for errors

### Auto-fill not working
- Ensure the part has a valid UUID `id` field
- Check network tab to confirm API calls are succeeding
- Verify the delivery log was created with the correct `part_id`
