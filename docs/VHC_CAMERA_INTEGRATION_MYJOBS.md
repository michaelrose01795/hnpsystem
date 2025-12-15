# VHC Camera Integration - MyJobs Page

## Location

The camera button will appear in the **top right** of the **"Vehicle Health Check"** section header in the technician's job view:

**File**: `/workspaces/hnpsystem/src/pages/job-cards/myjobs/[jobNumber].js`
**Line**: Around 1855 (in the VHC header `<div>`)

---

## Integration Steps

### Step 1: Add Import at the Top of the File

Add this import with the other VHC component imports (around line 22-27):

```javascript
import VhcCameraButton from "@/components/VHC/VhcCameraButton";
```

### Step 2: Add Refresh State

Add this state variable with the other useState declarations (around line 182-210):

```javascript
const [vhcRefreshKey, setVhcRefreshKey] = useState(0);
```

### Step 3: Add Camera Button to VHC Header

Find the VHC Header section (around line 1838-1871) and update it:

**BEFORE** (Current Code):
```javascript
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
  </div>
</div>
```

**AFTER** (Updated Code with Camera Button):
```javascript
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

    {/* Camera Button - NEW */}
    {user?.role === "technician" && jobNumber && (
      <VhcCameraButton
        jobNumber={jobNumber}
        userId={dbUserId || user?.id}
        onUploadComplete={() => {
          console.log("📷 VHC media uploaded, refreshing...");
          setVhcRefreshKey(prev => prev + 1);
          // Optionally reload job data
          loadJobData();
        }}
      />
    )}
  </div>
</div>
```

---

## What This Does

1. **Camera Button Appears**: Only for technicians in the VHC section header (top right)
2. **Click Camera Button**: Opens the camera capture modal
3. **Select Mode**: Technician chooses Photo or Video
4. **Capture**: Uses device camera (browser-based, no file system access)
5. **Edit**:
   - **Photo**: Draw annotations, highlights with pen/highlighter/eraser
   - **Video**: Trim duration, toggle mute
6. **Upload Confirmation**:
   - Preview the edited media
   - Toggle "👁️ Visible to Customer" or "🔒 Internal Only"
   - Add optional description
7. **Upload**: Files saved to `/public/uploads/vhc-media/` and appear in VHC Photos/Videos tabs
8. **Refresh**: Job data refreshes to show the new media

---

## Visual Location

```
┌─────────────────────────────────────────────────────────────────┐
│  Vehicle Health Check                      [Save Status] [📷 Camera] │
│  Complete mandatory sections to finish VHC                       │
└─────────────────────────────────────────────────────────────────┘
```

The camera button appears in the top right, next to the save status indicators.

---

## Role-Based Access

The button only appears when:
- ✅ User role is "technician"
- ✅ Job number is available

This ensures only technicians can capture VHC media from the job detail page.

---

## Complete Example

Here's the complete VHC Header section with the camera button integrated:

```javascript
{/* VHC Header with Save Status and Camera Button */}
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
    {/* Save Status Indicators */}
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

    {/* Camera Button */}
    {user?.role === "technician" && jobNumber && (
      <VhcCameraButton
        jobNumber={jobNumber}
        userId={dbUserId || user?.id}
        onUploadComplete={() => {
          console.log("📷 VHC media uploaded, refreshing...");
          setVhcRefreshKey(prev => prev + 1);
          loadJobData(); // Refresh job data to show new media
        }}
      />
    )}
  </div>
</div>
```

---

## Database Migration Required

Before this will work, you **must run the database migration**:

**File**: `/workspaces/hnpsystem/src/lib/migrations/013_add_customer_visibility_to_job_files.sql`

Run this SQL in your Supabase dashboard or via command line:

```bash
psql -U your_user -d your_database -f src/lib/migrations/013_add_customer_visibility_to_job_files.sql
```

This adds the `visible_to_customer` column to the `job_files` table.

---

## Files Created

All the necessary components have been created:

1. ✅ `/workspaces/hnpsystem/src/components/VHC/VhcCameraButton.js` - Main camera button
2. ✅ `/workspaces/hnpsystem/src/components/VHC/CameraCaptureModal.js` - Camera interface
3. ✅ `/workspaces/hnpsystem/src/components/VHC/PhotoEditorModal.js` - Photo editor
4. ✅ `/workspaces/hnpsystem/src/components/VHC/VideoEditorModal.js` - Video editor
5. ✅ `/workspaces/hnpsystem/src/components/VHC/MediaUploadConfirmModal.js` - Upload confirmation
6. ✅ `/workspaces/hnpsystem/src/pages/api/vhc/upload-media.js` - Upload API endpoint

---

## Testing Checklist

After integration:

- [ ] Camera button appears in VHC header (top right)
- [ ] Button only visible to technician role
- [ ] Clicking button opens camera modal
- [ ] Camera permission prompts correctly
- [ ] Photo capture works
- [ ] Video recording works
- [ ] Photo editor allows drawing
- [ ] Video editor allows trimming/muting
- [ ] Upload confirmation shows preview
- [ ] Customer visibility toggle works
- [ ] Upload completes successfully
- [ ] Media appears in VHC Photos/Videos tabs
- [ ] Visibility indicators show (👁️/🔒)
- [ ] Customer portal filters correctly

---

## Support

See the main implementation guide for more details:
`/workspaces/hnpsystem/docs/VHC_CAMERA_IMPLEMENTATION.md`
