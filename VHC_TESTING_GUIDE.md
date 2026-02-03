# VHC Status Movement - Testing & Debugging Guide

## ✅ What's Been Implemented

### 1. **Labour Column Persistence**
- Labour input field saves to database on blur
- Labour checkbox saves to database immediately
- Supports 0 values correctly

### 2. **Authorised & Declined Sections**
- Always visible in Summary tab
- Items should move here when authorized/declined

### 3. **Comprehensive Logging**
- Detailed console logs for every step
- Error messages with ❌ emoji
- Success messages with ✅ emoji

---

## 🔴 CRITICAL: Database Migration Required

The `display_status` column must exist in your database for this to work!

Additionally, we now add a `severity` column which stores the original severity (red/amber/green) derived from the checksheet so authorisation states do not overwrite it.

**Check if column exists:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'vhc_checks' AND column_name = 'display_status';
```

**If not found, run this SQL in Supabase Dashboard:**
```sql
ALTER TABLE public.vhc_checks
ADD COLUMN IF NOT EXISTS display_status text
CHECK (display_status IS NULL OR display_status IN ('red', 'amber', 'green', 'authorized', 'declined'));
```

---

## 🧪 Testing Steps

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Open Browser Console
1. Navigate to a job card with VHC items
2. Press F12 to open DevTools
3. Go to Console tab
4. Clear console (Ctrl+L or Cmd+K)

### Step 3: Navigate to VHC Summary
1. Go to VHC tab
2. Click on Summary sub-tab
3. Watch the console logs

### Step 4: Test Item Movement

**Test Bulk Authorise:**
1. Select one or more items in Red/Amber section (checkbox on right)
2. Click "Authorise" button
3. Watch console for logs starting with `[VHC BULK]`

**Test Bulk Decline:**
1. Select items
2. Click "Decline" button
3. Watch console logs

**Test Individual Item:**
1. Find an item
2. Click "Authorise" or "Decline" checkbox
3. Watch console for logs starting with `[VHC STATUS]`

---

## ✅ Customer Requests Pre-picked Location Check

1. Open a job card with VHC required.
2. Authorise a VHC item.
3. In VHC → Parts Authorized, select a location from the dropdown for that item.
4. Refresh the browser and confirm the dropdown still shows the selected location (persistence check).
5. Go to Customer Requests tab → Vehicle Health Check → Authorised items.
6. Confirm the authorised item shows `Pre-picked: <location>` in small text (same style as Note).
7. Clear the dropdown location (set it blank), refresh, confirm the `Pre-picked` line disappears.
8. If a note exists for that item, confirm `Note: ...` shows only when there is no pre-pick.

---

## 📋 What To Look For In Console

### On Page Load:
```
[VHC] Building vhcApprovalLookup from vhcChecksData: X checks
[VHC] Check vhc_id=123: approval_status=pending, display_status=null
[VHC] summaryItem: id=123, label=..., rawSeverity=red, displaySeverity=red, approvalStatus=pending
[VHC] severityLists: Item 123 in red section, displaySeverity=red
```

### When Authorizing an Item:
```
━━━ [VHC STATUS] STARTING UPDATE ━━━
[VHC STATUS] Item ID: 123
[VHC STATUS] New Status: authorized
[VHC STATUS] Canonical ID: 123, Parsed ID: 123
[VHC STATUS] DB Status: authorized, Display Status: authorized
[VHC STATUS] API Request Body: {vhcItemId: 123, approvalStatus: "authorized", ...}
[VHC STATUS] API Response: {success: true, ...}
✅ [VHC STATUS] Database updated successfully!
[VHC STATUS] FOUND CHECK TO UPDATE: {vhc_id: 123, ...}
[VHC STATUS] UPDATED CHECK: {vhc_id: 123, display_status: "authorized", ...}
✅ ━━━ [VHC STATUS] UPDATE COMPLETE ━━━
✅ Item 123 should now appear in "authorized" section
```

Then immediately after:
```
[VHC] Building vhcApprovalLookup from vhcChecksData: X checks
[VHC] Check vhc_id=123: approval_status=authorized, display_status=authorized
[VHC] summaryItem: id=123, displaySeverity=authorized
[VHC] severityLists: Item 123 in authorized section
```

---

## ❌ Common Errors & Solutions

### Error: `display_status` column doesn't exist
**Console shows:**
```
❌ [VHC STATUS ERROR] API Failed: column "display_status" does not exist
```
**Solution:** Run the database migration SQL (see CRITICAL section above)

### Error: Item not moving
**Check console for:**
1. `❌ Invalid ID` - Item ID resolution failed
2. `❌ API Failed` - Database update failed
3. No `UPDATED CHECK` log - Item not found in vhcChecksData

**Debug steps:**
1. Copy ALL console logs and send them
2. Check if `vhcChecksData` contains your item:
   - Look for log: `[VHC] Building vhcApprovalLookup from vhcChecksData: X checks`
   - Should show your item's vhc_id

### Error: No console logs at all
**Solution:** Make sure you're in dev mode (`npm run dev`, not build)

---

## 🔧 Critical Fix Applied

**Issue**: Items were using display IDs like `"Wheels & Tyres-2"` but the database uses numeric `vhc_id` values like `78`.

**Solution**: Added ID resolution using the `vhc_item_aliases` table to map display IDs to canonical vhc_ids before looking up approval data.

**What Changed**:
- Line 1336-1338 in VhcDetailsPanel.js now resolves display IDs to canonical vhc_ids
- Added `vhcIdAliases` to the `summaryItems` useMemo dependencies

**Expected Console Logs After Fix**:
```
[VHC] Item Wheels & Tyres-2: canonicalId=78, approvalData = {approvalStatus: 'authorized', displayStatus: 'authorized', ...}
```

---

## 🐛 If Items Still Don't Move

### Copy and Send These Console Logs:

1. **Initial Load Logs** (when you first open Summary tab):
```
[VHC] Building vhcApprovalLookup...
[VHC] summaryItems built...
[VHC] severityLists calculated...
```

2. **Update Logs** (when you click Authorise/Decline):
```
━━━ [VHC STATUS] STARTING UPDATE ━━━
... (all logs until)
✅ ━━━ [VHC STATUS] UPDATE COMPLETE ━━━
```

3. **After-Update Logs** (logs that appear immediately after update):
```
[VHC] Building vhcApprovalLookup...
[VHC] summaryItem: id=X, displaySeverity=...
[VHC] severityLists: Item X in Y section
```

### Also Note:
- Which button you clicked (Bulk Authorise/Decline or individual checkbox)
- Which section the item started in (Red/Amber)
- Whether the item disappeared or stayed
- Whether the Authorised/Declined section appeared

---

## 📁 Files Modified

- `src/components/VHC/VhcDetailsPanel.js` - Main VHC component with logging
- `src/pages/api/vhc/update-item-status.js` - API that updates database
- `src/lib/database/schema/addtable.sql` - Database migration
- `src/lib/database/schema/schemaReference.sql` - Updated schema reference
- `migrations/add-display-status-column.sql` - Migration file
- `scripts/run-migration.js` - Migration script

---

## 💡 Key Concepts

**Display Status Flow:**
1. Item starts with `display_status = null` → shows in Red/Amber based on severity
2. User clicks "Authorise" → `display_status = 'authorized'`
3. Item's `displaySeverity` becomes 'authorized'
4. `severityLists` puts item in `authorized` array
5. Item renders in Authorised section

**The item MUST:**
- Have a valid `vhc_id` in the database
- Be in `vhcChecksData` array
- Have `display_status` column in database
- Update successfully via API
- Trigger `vhcApprovalLookup` rebuild
- Trigger `summaryItems` rebuild
- Trigger `severityLists` rebuild

If ANY step fails, check the console logs for that step!
