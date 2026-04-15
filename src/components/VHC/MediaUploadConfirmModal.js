// file location: src/components/VHC/MediaUploadConfirmModal.js
// Final confirmation modal that replaces an existing VHC media record when edits are saved.

import React, { useEffect, useMemo, useState } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";

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
      setError(uploadError?.message || "Failed to save media");
    } finally {
      setUploading(false);
    }
  };

  const footer = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", width: "100%" }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={uploading}
        style={{ ...buildModalButton("ghost"), padding: "12px 18px" }}
      >
        Cancel
      </button>

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading || !mediaFile}
        style={{ ...buildModalButton("primary"), padding: "12px 18px" }}
      >
        {uploading ? "Saving..." : "Save to VHC"}
      </button>
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
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)", gap: "20px", height: "100%" }}>
        <div
          style={{
            background: "var(--background)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "320px",
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
            <div style={{ color: "var(--info)" }}>Preview unavailable</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              border: "1px solid var(--accent-surface)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              padding: "16px",
              display: "grid",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "12px", color: "var(--info)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              File details
            </div>
            <div style={{ fontSize: "14px", color: "var(--primary)", fontWeight: 700 }}>{mediaFile?.name || "Captured media"}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{mediaFile?.type || "Unknown type"}</div>
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              {Number.isFinite(mediaFile?.size) ? `${(mediaFile.size / (1024 * 1024)).toFixed(2)} MB` : "Unknown size"}
            </div>
          </div>

          <label
            style={{
              border: "1px solid var(--accent-surface)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface)",
              padding: "16px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={visibleToCustomer}
              onChange={(event) => setVisibleToCustomer(event.target.checked)}
              disabled={uploading}
              style={{ marginTop: "2px" }}
            />
            <div style={{ display: "grid", gap: "4px" }}>
              <div style={{ fontSize: "14px", color: "var(--primary)", fontWeight: 700 }}>Visible to customer</div>
              <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                Turn this off to keep the media internal-only for workshop staff.
              </div>
            </div>
          </label>

          {error ? (
            <div
              style={{
                borderRadius: "var(--radius-sm)",
                background: "var(--danger-surface)",
                color: "var(--danger)",
                padding: "12px 14px",
                fontSize: "13px",
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
