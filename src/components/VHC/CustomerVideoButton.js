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
import { showAlert } from "@/lib/notifications/alertBus";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";
import { supabaseClient } from "@/lib/database/supabaseClient";

const postUploadJson = async (body) => {
  const response = await fetch("/api/vhc/customer-video-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Upload failed");
  }
  return payload;
};

// Upload the final customer video (after optional editing) with the
// widget metadata preserved on the record. Widgets are already burned
// into the video file itself, but we also persist the structured list
// so the customer portal can tag playback in the future.
async function uploadCustomerVideo({ file, jobNumber, userId, widgets, contextLabel }) {
  const fallbackName = `customer_video_${Date.now()}.webm`;
  const mimeType = file?.type || "video/webm";

  const uploadPlan = await postUploadJson({
    action: "createSignedUpload",
    jobNumber: String(jobNumber),
    fileName: file?.name || fallbackName,
    mimeType,
    fileSize: file?.size || 0,
  });

  const { error: storageError } = await supabaseClient
    .storage
    .from(uploadPlan.bucket)
    .uploadToSignedUrl(uploadPlan.storagePath, uploadPlan.token, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (storageError) {
    throw new Error(storageError.message || "Upload failed");
  }

  const completePayload = await postUploadJson({
    action: "completeSignedUpload",
    jobNumber: String(jobNumber),
    uploadedBy: String(userId || "system"),
    overlays: widgets || [],
    contextLabel: String(contextLabel || ""),
    storagePath: uploadPlan.storagePath,
    fileName: file?.name || fallbackName,
    mimeType,
    fileSize: file?.size || 0,
  });

  return completePayload.record; // Return the saved DB record
}

export default function CustomerVideoButton({
  jobNumber, // Job we're attaching the video to
  userId, // Uploading user id
  vhcContextLabel = "", // Optional VHC section label for analytics
  vhcData = null, // Raw VHC state — used to build the left panel
  buttonStyle, // Optional style override (kept for callers that need it, but the default look now comes from the global `.vhc-btn` class so this button matches "Reopen VHC" etc.)
  buttonClassName = "vhc-btn", // Global VHC button class — override only when a caller has a good reason
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
    const { tyres, brakes, external } = buildInspectionConcerns(vhcData); // Extract concerns including external items (wipers, lights, etc.)
    return { tyres, brakes, external }; // Panel input shape
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
      const friendlyMsg = "Customer video could not be uploaded. Please try again.";
      setUploadError(friendlyMsg);
      showAlert(buildErrorAlert(friendlyMsg, err, {
        component: "CustomerVideoButton",
        action: "handleEditorSave",
        endpoint: "POST /api/vhc/customer-video-upload",
        jobNumber,
        userId,
      }));
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
      const friendlyMsg = "Customer video could not be uploaded. Please try again.";
      setUploadError(friendlyMsg);
      showAlert(buildErrorAlert(friendlyMsg, err, {
        component: "CustomerVideoButton",
        action: "handleEditorSkip",
        endpoint: "POST /api/vhc/customer-video-upload",
        jobNumber,
        userId,
      }));
    } finally {
      setUploading(false); // Re-enable
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCapture(true)}
        className={buttonClassName}
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
