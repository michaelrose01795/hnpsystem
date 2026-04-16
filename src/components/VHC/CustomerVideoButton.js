// file location: src/components/VHC/CustomerVideoButton.js
// Customer video entry point used from the VHC toolbar. This is the
// launcher only — the actual capture UI now lives in
// src/components/VHC/mediaCapture/FullScreenCapture.js. The old
// "overlay suggestion" builder modal has been removed; overlays are
// inserted live during recording from the left-side inspection panel
// and are burned into the video frame as it records.

import React, { useMemo, useState } from "react"; // React primitives
import FullScreenCapture from "@/components/VHC/mediaCapture/FullScreenCapture"; // New full-screen camera
import VideoEditorModal from "@/components/VHC/VideoEditorModal"; // Post-capture edit modal (trim/mute)
import { buildInspectionConcerns } from "@/components/VHC/mediaCapture/buildInspectionConcerns"; // Panel data helper

// Upload the final customer video (after optional editing) with the
// widget metadata preserved on the record. Widgets are already burned
// into the video file itself, but we also persist the structured list
// so the customer portal can tag playback in the future.
async function uploadCustomerVideo({ file, jobNumber, userId, widgets, contextLabel }) {
  const formData = new FormData(); // Build multipart body
  formData.append("file", file); // The video file itself
  formData.append("jobNumber", String(jobNumber)); // Job reference
  formData.append("uploadedBy", String(userId || "system")); // User reference
  formData.append("overlays", JSON.stringify(widgets || [])); // Persist widget metadata
  formData.append("contextLabel", String(contextLabel || "")); // Optional section label

  const response = await fetch("/api/vhc/customer-video-upload", { // Existing endpoint — unchanged
    method: "POST", // File upload
    body: formData, // FormData body
  });
  const payload = await response.json().catch(() => ({})); // Read body defensively
  if (!response.ok || !payload?.success) { // Surface upload errors
    throw new Error(payload?.message || "Upload failed");
  }
  return payload.record; // Return the saved DB record
}

export default function CustomerVideoButton({
  jobNumber, // Job we're attaching the video to
  userId, // Uploading user id
  vhcContextLabel = "", // Optional VHC section label for analytics
  vhcData = null, // Raw VHC state — used to build the left panel
  buttonStyle, // Style override from the parent toolbar
  onUploadComplete, // Invoked after a successful upload
}) {
  const [showCapture, setShowCapture] = useState(false); // Controls the full-screen overlay
  const [pendingVideo, setPendingVideo] = useState(null); // Holds { file, widgets } awaiting edit
  const [uploading, setUploading] = useState(false); // Upload in-flight flag
  const [uploadError, setUploadError] = useState(""); // Surface errors from the upload call

  // Build the panel data from the current VHC state. Recomputed when
  // vhcData changes so freshly-entered concerns appear on the panel.
  const panelData = useMemo(() => {
    if (!vhcData) return null; // No data → no panel (hook still works without it)
    const { tyres, brakes } = buildInspectionConcerns(vhcData); // Extract concerns
    return { tyres, brakes }; // Panel input shape
  }, [vhcData]);

  // Capture hand-off — FullScreenCapture finishes and gives us the file + widgets snapshot.
  const handleCapture = (file, meta) => {
    if (!file) return; // Defensive (cancel path)
    if (meta?.type === "video") { // We only care about videos here
      setPendingVideo({ file, widgets: meta?.widgets || [] }); // Hand to the editor next
    }
    setShowCapture(false); // Close the capture overlay
  };

  // After the editor returns a (possibly trimmed/muted) file, upload it.
  const handleEditorSave = async (editedFile) => {
    if (!pendingVideo) return; // Nothing to save
    try {
      setUploading(true); // Disable UI
      setUploadError(""); // Reset error
      const record = await uploadCustomerVideo({ // Upload with widget metadata
        file: editedFile, // The file the editor gave us (edited or original)
        jobNumber, // Job reference
        userId, // User reference
        widgets: pendingVideo.widgets, // Widget list captured during recording
        contextLabel: vhcContextLabel, // Optional VHC context string
      });
      setPendingVideo(null); // Clear pending state
      onUploadComplete?.(record); // Let parent refresh its data
    } catch (err) {
      console.error("Customer video upload failed:", err); // Log
      setUploadError(err?.message || "Upload failed"); // Surface to user
    } finally {
      setUploading(false); // Re-enable UI
    }
  };

  // Editor cancelled without saving — discard the pending file.
  const handleEditorCancel = () => {
    setPendingVideo(null); // Drop file from memory
    setUploadError(""); // Clear any prior errors
  };

  // "Keep original" path: skip the trim/mute processing and upload as-is.
  const handleEditorSkip = async (originalFile) => {
    if (!pendingVideo) return; // Nothing to do
    try {
      setUploading(true); // Disable UI
      setUploadError(""); // Reset error
      const record = await uploadCustomerVideo({ // Upload raw file
        file: originalFile || pendingVideo.file, // Prefer the provided file
        jobNumber, // Job reference
        userId, // User reference
        widgets: pendingVideo.widgets, // Widget metadata
        contextLabel: vhcContextLabel, // Optional label
      });
      setPendingVideo(null); // Clear
      onUploadComplete?.(record); // Notify parent
    } catch (err) {
      console.error("Customer video upload failed:", err); // Log
      setUploadError(err?.message || "Upload failed"); // Surface
    } finally {
      setUploading(false); // Re-enable
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCapture(true)}
        style={buttonStyle}
      >
        Customer Video
      </button>

      {/* Full-screen capture surface (photo/video; defaults to video-only here). */}
      <FullScreenCapture
        isOpen={showCapture}
        initialMode="video" // Customer video flow defaults to video mode
        allowModeSwitch={false} // Keep this flow focused on video only
        panel={panelData} // Left-side inspection panel
        panelInitiallyOpen // Default to expanded for discoverability
        title="Customer Video" // Subtle top-left caption
        onClose={() => setShowCapture(false)} // User dismissed
        onCapture={handleCapture} // File + widgets handoff
      />

      {/* Post-capture editor (trim / mute / keep original) */}
      <VideoEditorModal
        isOpen={Boolean(pendingVideo)} // Visible when a recording is waiting
        videoFile={pendingVideo?.file || null} // Provide the captured file
        busyLabel={uploading ? "Uploading…" : ""} // Bubble upload progress into the editor's header
        errorLabel={uploadError} // Show upload errors in the editor
        widgetCount={pendingVideo?.widgets?.length || 0} // Informational — count of burned-in widgets
        onCancel={handleEditorCancel} // Discard without upload
        onSkip={handleEditorSkip} // Keep original + upload
        onSave={handleEditorSave} // Save edited + upload
      />
    </>
  );
}
