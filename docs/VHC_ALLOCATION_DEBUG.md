# VHC Parts Allocation Debug Guide

## Current Issue
VHC Authorised parts allocation is not working the same as Customer Request allocation. When allocating a part to a "VHC Authorised" item in the ALLOCATE PARTS section, the part does not appear in the allocated parts table under the VHC item after allocation.

## Expected Behavior
When allocating parts to "VHC Authorised - Rear Discs":
1. User clicks "Assign selected" button on the VHC Authorised item
2. Selects parts from "PARTS ADDED TO JOB" section
3. Clicks "Assign" button
4. The allocated parts should appear in a table under "VHC Authorised - Rear Discs" showing:
   - Part Number
   - Description
   - Qty
   - Retail
   - Cost
   - Unassign button

This is exactly how Customer Request allocation works and is displayed.

## Data Flow

### Customer Request Allocation (WORKING)
1. Frontend calls `/api/parts/allocate-to-request` with numeric `requestId`
2. API sets `allocated_to_request_id = requestId` in `parts_job_items` table
3. API clears `vhc_item_id = null`
4. Frontend refreshes job data
5. Frontend groups parts by `allocated_to_request_id`
6. Parts appear under the customer request

### VHC Allocation (NOT WORKING)
1. Frontend calls `/api/parts/allocate-to-request` with `requestId = "vhc-108"`
2. API detects VHC allocation (starts with "vhc-")
3. API extracts numeric ID: `vhcItemId = 108`
4. API sets `vhc_item_id = 108` in `parts_job_items` table
5. API clears `allocated_to_request_id = null`
6. API runs VHC sync
7. Frontend refreshes job data
8. Frontend should group parts with `vhcItemId = 108` under key `"vhc-108"`
9. **Parts do NOT appear under the VHC request**

## Code Locations

### Frontend (PartsTab_New.js)
- **Line 111-180**: `jobParts` mapping - maps database fields including `vhc_item_id` to `vhcItemId`
- **Line 218-261**: `allRequests` creation - creates VHC requests with `id: "vhc-{vhcItemId}"`
- **Line 257-278**: Parts grouping by allocation - groups parts by both `allocated_to_request_id` and `vhc_item_id` (using "vhc-{id}" key format)
- **Line 280-290**: `vhcPartsByItemId` map - groups parts by numeric `vhcItemId`
- **Line 800-868**: `handleAssignSelectedToRequest` - allocation handler
- **Line 1615-1632**: Allocated parts retrieval for display

### Backend
- **/api/parts/allocate-to-request.js**: Handles both customer and VHC allocations
- **/lib/database/jobs.js Line 777-901**: `getAuthorizedVhcItemsWithDetails` - fetches VHC items
- **/lib/database/vhcPartsSync.js**: Syncs VHC status when parts are allocated/unallocated

## Debug Logging Added

### Backend API (/api/parts/allocate-to-request.js)
- Logs when request is received
- Logs whether it's a VHC allocation
- Logs the update data being sent to database
- Logs the result after database update
- Logs VHC sync execution

### Frontend (PartsTab_New.js)
- Logs the allocation request payload
- Logs the API response
- Logs part allocations grouping
- Logs sample parts with vhcItemId
- Logs all requests (customer + VHC)
- Logs VHC-specific allocation details per request

## Debugging Steps

1. **Open Browser Console** (F12)
2. **Navigate to Parts Tab**
3. **Look for logs starting with `[PartsTab]`**:
   - Check if VHC requests are being created
   - Check if parts with vhcItemId exist
   - Check part allocations mapping
4. **Click "Assign selected" on a VHC item**
5. **Select a part and click "Assign"**
6. **Look for logs starting with `[ALLOCATE API]`**:
   - Verify requestId format (should be "vhc-108")
   - Verify update data has correct vhc_item_id
   - Check database update result
   - Verify VHC sync runs
7. **After page refresh, check `[PartsTab]` logs again**:
   - Verify jobParts has parts with vhcItemId
   - Verify partAllocations has "vhc-108" key
   - Check if allocated parts are found for VHC request

## Key Fields

### Database (parts_job_items table)
- `id`: Part allocation ID
- `allocated_to_request_id`: NULL for VHC, numeric ID for customer requests
- `vhc_item_id`: NULL for customer requests, numeric ID for VHC
- `job_id`: Job ID

### Frontend (jobParts array)
- `id`: Part allocation ID
- `allocatedToRequestId`: From `allocated_to_request_id`
- `vhcItemId`: From `vhc_item_id`

### Frontend (allRequests array)
- Customer: `{ id: 123, type: "customer", ... }`
- VHC: `{ id: "vhc-108", type: "vhc", vhcItemId: 108, ... }`

## Potential Issues to Check

1. **Database Update**: Is `vhc_item_id` actually being set in the database?
2. **Data Refresh**: Is the frontend getting the updated part data after allocation?
3. **Field Mapping**: Is `vhc_item_id` being correctly mapped to `vhcItemId` in jobParts?
4. **Grouping Logic**: Are parts being correctly grouped with "vhc-{id}" key format?
5. **Request Matching**: Is the request.id ("vhc-108") matching the grouped parts key?
6. **VHC Items Source**: Are VHC requests being created from `authorizedVhcItems`?

## Testing Commands

```sql
-- Check if allocation was saved (replace 123 with actual part ID)
SELECT id, vhc_item_id, allocated_to_request_id, status
FROM parts_job_items
WHERE id = 123;

-- Check all VHC-allocated parts for a job (replace 456 with actual job ID)
SELECT id, vhc_item_id, allocated_to_request_id
FROM parts_job_items
WHERE job_id = 456 AND vhc_item_id IS NOT NULL;
```
