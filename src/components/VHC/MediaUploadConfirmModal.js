// file location: src/components/VHC/MediaUploadConfirmModal.js
// Final confirmation modal that replaces an existing VHC media record when
// edits are saved. Canonical popup and layer primitives keep all visuals under
// staffglobal.css and the shared theme token system.
/* eslint-disable @next/next/no-img-element -- local blob previews cannot use next/image */

import React, { useEffect, useState } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import Button from "@/components/ui/Button";
import LayerTheme from "@/components/ui/LayerTheme";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";
import { showAlert } from "@/lib/notifications/alertBus";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";

export default function MediaUploadConfirmModal({
  isOpen,
  mediaFile,
  mediaType,
  existingFileId,
  jobId,
  jobNumber,
  userId,
  onUploadComplete,
  onCancel,
}) {
  const [visibleToCustomer, setVisibleToCustomer] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    if (!isOpen || !mediaFile) {
      setPreviewUrl("");
      return undefined;
    }

    const nextPreviewUrl = URL.createObjectURL(mediaFile);
    setPreviewUrl(nextPreviewUrl);
    setPreviewError(false);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [isOpen, mediaFile]);

  useEffect(() => {
    if (!isOpen) return;
    setVisibleToCustomer(true);
    setError("");
  }, [isOpen, mediaFile]);

  const handleUpload = async () => {
    const hasJobReference =
      (jobId !== undefined && jobId !== null && String(jobId).trim()) ||
      (jobNumber !== undefined && jobNumber !== null && String(jobNumber).trim());

    if (!mediaFile || !hasJobReference) {
      setError("Missing required information");
      return;
    }

    try {
      setUploading(true);
      setError("");

      const uploadedFile = await uploadVhcMediaFile({
        file: mediaFile,
        jobId,
        jobNumber,
        userId,
        visibleToCustomer,
        replaceFileId: existingFileId,
      });

      onUploadComplete?.(uploadedFile);
    } catch (uploadError) {
      console.error("Failed to save VHC media:", uploadError);
      const friendlyMsg = "Media could not be saved. Please try again.";
      setError(friendlyMsg);
      showAlert(buildErrorAlert(friendlyMsg, uploadError, {
        component: "MediaUploadConfirmModal",
        endpoint: "POST /api/vhc/upload-media",
        jobId: jobId ?? "",
        jobNumber: jobNumber ?? "",
        mediaType,
        fileSize: mediaFile?.size ?? "",
        replaceFileId: existingFileId ?? "",
      }));
    } finally {
      setUploading(false);
    }
  };

  const mimeType = String(mediaFile?.type || "").toLowerCase();
  const isVideo = mediaType === "video" || mimeType.startsWith("video/");
  const isPhoto = !isVideo && (mediaType === "photo" || mimeType.startsWith("image/"));

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={uploading ? undefined : onCancel}
      closeOnBackdrop={!uploading}
      closeOnEscape={!uploading}
      ariaLabelledBy="review-media-title"
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(760px, 100%)", overflow: "hidden" }}
    >
      <div className="app-settings-popup app-media-editor-popup">
        <header className="app-popup-compact-header">
          <h2 id="review-media-title">Review media</h2>
          <div className="app-popup-compact-header__actions">
            <Button
              variant="primary"
              size="sm"
              onClick={handleUpload}
              disabled={!mediaFile}
              busy={uploading}
            >
              Save to VHC
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={uploading}>
              Close
            </Button>
          </div>
        </header>

        <LayerTheme
          as="label"
          padding="0 var(--section-card-padding)"
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            height: "50px",
            minHeight: "50px",
            flex: "0 0 50px",
            boxSizing: "border-box",
            cursor: uploading ? "not-allowed" : "pointer",
            opacity: uploading ? 0.7 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={visibleToCustomer}
            onChange={(event) => setVisibleToCustomer(event.target.checked)}
            disabled={uploading}
          />
          <strong>Visible to customer</strong>
        </LayerTheme>

        <LayerTheme
          as="section"
          aria-label={`${isVideo ? "Video" : "Photo"} preview`}
          padding="0"
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            flex: "1 1 auto",
            minHeight: "240px",
            overflow: "hidden",
          }}
        >
          {previewUrl && isPhoto && !previewError ? (
            <img
              src={previewUrl}
              alt="Media awaiting upload"
              onError={() => setPreviewError(true)}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : previewUrl && isVideo && !previewError ? (
            <video
              src={previewUrl}
              controls
              playsInline
              aria-label="Media awaiting upload"
              onError={() => setPreviewError(true)}
              style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
              Preview unavailable
            </span>
          )}
        </LayerTheme>

        {error ? (
          <div role="alert" className="app-alert app-alert--danger">
            {error}
          </div>
        ) : null}
      </div>
    </PopupModal>
  );
}
