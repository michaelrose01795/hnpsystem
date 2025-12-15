# VHC Camera Button - Exact Location Guide

## ✅ IMPLEMENTATION COMPLETE

The camera button has been added and is now **always visible** for technicians, regardless of VHC completion status.

---

## 📍 Exact Location

**File**: `/workspaces/hnpsystem/src/pages/job-cards/myjobs/[jobNumber].js`

**Lines**: 1872-1882 (inside the VHC Header)

**Visual Location**:
```
┌─────────────────────────────────────────────────────────────────────┐
│  Vehicle Health Check               [Save Status] [📷 Camera]        │
│  Complete mandatory sections to finish VHC                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Code Added

### 1. Import (Line 28)
```javascript
import VhcCameraButton from "@/components/VHC/VhcCameraButton";
```

### 2. Button in VHC Header (Lines 1872-1882)
```javascript
{/* Camera Button - Always visible for technicians */}
{jobNumber && (
  <VhcCameraButton
    jobNumber={jobNumber}
    userId={dbUserId || user?.id}
    onUploadComplete={() => {
      console.log("📷 VHC media uploaded, refreshing job data...");
      loadJobData();
    }}
  />
)}
```

---

## When Button Appears

✅ **Always visible** when:
- User is viewing a job in `/job-cards/myjobs/[jobNumber]`
- `jobNumber` is available
- VHC tab is open

❌ **No restrictions**:
- Does NOT require VHC to be started
- Does NOT require VHC to be complete
- Does NOT require any sections to be filled
- No role restrictions (any user can see it)

---

## Navigation Path

1. Go to **My Jobs** (technician view)
2. Click on a job
3. Scroll down to **"Vehicle Health Check"** section
4. Button appears in **top right** of the purple header box
5. Next to save status indicators (💾 Saving, ✅ Saved, etc.)

---

## Troubleshooting

### "I don't see the button"

**Check these:**

1. **Are you in the right page?**
   - URL should be: `/job-cards/myjobs/[jobNumber]`
   - NOT in: `/job-cards/[jobNumber]` (staff/admin view)

2. **Can you see the VHC section?**
   - Look for the purple header box with "Vehicle Health Check"
   - If you don't see this section, scroll down

3. **Is the page fully loaded?**
   - Wait for the page to finish loading
   - Check browser console for errors

4. **Check browser console:**
   ```
   Press F12 → Console tab
   Look for any red errors
   ```

5. **Verify file changes:**
   ```bash
   # Check if import was added
   grep "VhcCameraButton" src/pages/job-cards/myjobs/[jobNumber].js

   # Should show:
   # import VhcCameraButton from "@/components/VHC/VhcCameraButton";
   # <VhcCameraButton
   ```

### "Button appears but doesn't work"

**Check these:**

1. **Database migration ran?**
   ```sql
   -- Check if column exists
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'job_files'
   AND column_name = 'visible_to_customer';
   ```

2. **API endpoint exists?**
   - File exists: `/workspaces/hnpsystem/src/pages/api/vhc/upload-media.js`

3. **Component files exist?**
   - `/workspaces/hnpsystem/src/components/VHC/VhcCameraButton.js`
   - `/workspaces/hnpsystem/src/components/VHC/CameraCaptureModal.js`
   - `/workspaces/hnpsystem/src/components/VHC/PhotoEditorModal.js`
   - `/workspaces/hnpsystem/src/components/VHC/VideoEditorModal.js`
   - `/workspaces/hnpsystem/src/components/VHC/MediaUploadConfirmModal.js`

4. **Camera permissions:**
   - Browser may block camera access
   - HTTPS required for camera API
   - Check browser settings

---

## Expected Behavior

### Click Camera Button:
1. Camera modal opens
2. Request camera permission (first time)
3. Live camera feed appears
4. Can switch between Photo/Video modes

### Capture Photo:
1. Click "Capture Photo"
2. Photo editor opens
3. Draw annotations (pen, highlighter, eraser)
4. Click "Save & Continue"
5. Upload confirmation shows
6. Toggle "Visible to Customer" on/off
7. Click "Upload to VHC"
8. Photo appears in VHC Photos tab

### Capture Video:
1. Click "Start Recording"
2. Record video
3. Click "Stop Recording"
4. Video editor opens
5. Trim and/or mute
6. Click "Save & Continue"
7. Upload confirmation shows
8. Toggle "Visible to Customer" on/off
9. Click "Upload to VHC"
10. Video appears in VHC Videos tab

---

## Testing Checklist

- [ ] Button visible in VHC header (top right)
- [ ] Button shows even when VHC not started
- [ ] Button shows even when VHC not complete
- [ ] Click button → Camera modal opens
- [ ] Camera permission prompt appears
- [ ] Live camera feed shows
- [ ] Can switch Photo/Video modes
- [ ] Photo capture works
- [ ] Video recording works
- [ ] Photo editor opens
- [ ] Video editor opens
- [ ] Upload confirmation shows
- [ ] Upload completes successfully
- [ ] Media appears in VHC tabs
- [ ] Visibility toggle works

---

## Complete Header Code (Lines 1838-1884)

```javascript
{/* VHC Header with Save Status */}
<div style={{
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  backgroundColor: "var(--accent-purple-surface)",
  borderRadius: "12px",
  border: "1px solid var(--accent-purple)"
}}>
  <div>
    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "var(--accent-purple)" }}>
      Vehicle Health Check
    </h2>
    <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--info)" }}>
      Complete mandatory sections to finish VHC
    </p>
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
    {saveStatus === "saving" && (
      <span style={{ fontSize: "13px", color: "var(--info)" }}>💾 Saving...</span>
    )}
    {saveStatus === "saved" && (
      <span style={{ fontSize: "13px", color: "var(--success)" }}>✅ Saved</span>
    )}
    {saveStatus === "error" && (
      <span style={{ fontSize: "13px", color: "var(--danger)" }}>❌ {saveError || "Save failed"}</span>
    )}
    {lastSavedAt && (
      <span style={{ fontSize: "12px", color: "var(--info)" }}>
        Last saved: {formatDateTime(lastSavedAt)}
      </span>
    )}

    {/* Camera Button - Always visible for technicians */}
    {jobNumber && (
      <VhcCameraButton
        jobNumber={jobNumber}
        userId={dbUserId || user?.id}
        onUploadComplete={() => {
          console.log("📷 VHC media uploaded, refreshing job data...");
          loadJobData();
        }}
      />
    )}
  </div>
</div>
```

---

## Summary

✅ **Button Location**: Top right of "Vehicle Health Check" purple header box
✅ **Always Visible**: No VHC completion required
✅ **Page**: `/job-cards/myjobs/[jobNumber]` (technician view)
✅ **Lines**: 1872-1882 in myjobs/[jobNumber].js

The button is now active and ready to use!
