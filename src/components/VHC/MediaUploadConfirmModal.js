// file location: src/components/VHC/MediaUploadConfirmModal.js
// Final confirmation modal that replaces an existing VHC media record
// when edits are saved. Rendered inside the shared VHCModalShell so
// the header / footer / overlay behaviour matches every other VHC
// modal. All colour / radius / spacing / typography values resolve
// through the global design tokens in src/styles/theme.css.

import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell from "./VHCModalShell";
import Button from "@/components/ui/Button";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";
import { showAlert } from "@/lib/notifications/alertBus";
import { buildErrorAlert } from "@/lib/notifications/buildErrorAlert";

const PANEL_STYLE = {
  background: "var(--surfaceMain)",
  border: "1px solid var(--accentBorder)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
};

const LABEL_STYLE = {
  fontSize: "var(--text-label)",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "var(--tracking-caps)",
  fontWeight: 700,
};

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

  const previewUrl = useMemo(() => {
    if (!isOpen || !mediaFile) return "";
    return URL.createObjectURL(mediaFile);
  }, [isOpen, mediaFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  const fileSizeMb = Number.isFinite(mediaFile?.size)
    ? `${(mediaFile.size / (1024 * 1024)).toFixed(2)} MB`
    : "Unknown size";

  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        width: "100%",
        flexWrap: "wrap",
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        disabled={uploading}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
      >
        Cancel
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={handleUpload}
        disabled={uploading || !mediaFile}
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
      >
        {uploading ? "Saving…" : "Save to VHC"}
      </Button>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Review Media"
      subtitle="Choose whether this media is visible to the customer before finishing."
      width="760px"
      height="min(92vh, 760px)"
      onClose={onCancel}
      footer={footer}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
          gap: "var(--space-5)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            background: "var(--surfaceMutedToken)",
            border: "1px solid var(--accentBorder)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 320,
          }}
        >
          {previewUrl && mediaType === "photo" ? (
            <img
              src={previewUrl}
              alt="Media preview"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : previewUrl && mediaType === "video" ? (
            <video
              src={previewUrl}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-body-sm)" }}>
              Preview unavailable
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-md)",
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              ...PANEL_STYLE,
              display: "grid",
              gap: "var(--space-2)",
            }}
          >
            <div style={LABEL_STYLE}>File details</div>
            <div style={{ fontSize: "var(--text-body)", color: "var(--text-primary)", fontWeight: 700 }}>
              {mediaFile?.name || "Captured media"}
            </div>
            <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-secondary)" }}>
              {mediaFile?.type || "Unknown type"}
            </div>
            <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-secondary)" }}>
              {fileSizeMb}
            </div>
          </div>

          <label
            style={{
              ...PANEL_STYLE,
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-3)",
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.7 : 1,
              transition: "var(--control-transition)",
            }}
          >
            <input
              type="checkbox"
              checked={visibleToCustomer}
              onChange={(event) => setVisibleToCustomer(event.target.checked)}
              disabled={uploading}
              style={{
                marginTop: 2,
                width: 18,
                height: 18,
                accentColor: "var(--accentMain)",
                cursor: "inherit",
              }}
            />
            <div style={{ display: "grid", gap: "var(--space-xs)" }}>
              <div style={{ fontSize: "var(--text-body)", color: "var(--text-primary)", fontWeight: 700 }}>
                Visible to customer
              </div>
              <div style={{ fontSize: "var(--text-body-sm)", color: "var(--text-secondary)" }}>
                Turn this off to keep the media internal-only for workshop staff.
              </div>
            </div>
          </label>

          {error ? (
            <div
              role="alert"
              style={{
                borderRadius: "var(--radius-sm)",
                background: "var(--danger-surface)",
                color: "var(--danger-text)",
                border: "none",
                padding: "var(--space-sm) var(--space-3)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </VHCModalShell>
  );
}
