// file location: src/components/VHC/MediaUploadConfirmModal.js
import React, { useState, useEffect, useRef } from "react";
import VHCModalShell, { buildModalButton } from "./VHCModalShell";

export default function MediaUploadConfirmModal({
  isOpen,
  mediaFile,
  mediaType,
  jobNumber,
  userId,
  onUploadComplete,
  onCancel,
}) {
  const [visibleToCustomer, setVisibleToCustomer] = useState(true);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const abortControllerRef = useRef(null);

  // Generate preview URL when modal opens
  useEffect(() => {
    if (isOpen && mediaFile) {
      const url = URL.createObjectURL(mediaFile);
      setPreviewUrl(url);

      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [isOpen, mediaFile]);

  // Upload media to server
  const handleUpload = async () => {
    if (!mediaFile || !jobNumber) {
      setError("Missing required information");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      // Create form data
      const formData = new FormData();
      formData.append("file", mediaFile);
      formData.append("jobId", String(jobNumber));
      formData.append("userId", String(userId || "system"));
      formData.append("visibleToCustomer", String(visibleToCustomer));
      if (description.trim()) {
        formData.append("description", description.trim());
      }

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log("✅ Upload successful:", response);
            setUploading(false);
            onUploadComplete(response.file);
          } catch (err) {
            console.error("Error parsing response:", err);
            setError("Upload succeeded but response was invalid");
            setUploading(false);
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            setError(errorResponse.error || "Upload failed");
          } catch {
            setError(`Upload failed with status ${xhr.status}`);
          }
          setUploading(false);
        }
      });

      xhr.addEventListener("error", () => {
        setError("Network error during upload");
        setUploading(false);
      });

      xhr.addEventListener("abort", () => {
        setError("Upload cancelled");
        setUploading(false);
      });

      xhr.open("POST", "/api/vhc/upload-media");
      xhr.send(formData);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload");
      setUploading(false);
    }
  };

  // Cancel upload
  const handleCancel = () => {
    if (uploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onCancel();
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Modal footer
  const footer = (
    <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", width: "100%" }}>
      <button
        onClick={handleCancel}
        style={{
          ...buildModalButton("ghost"),
          padding: "10px 20px",
        }}
        disabled={uploading}
      >
        {uploading ? "Cancel Upload" : "Cancel"}
      </button>

      <button
        onClick={handleUpload}
        style={{
          ...buildModalButton("primary"),
          padding: "10px 20px",
        }}
        disabled={uploading || !mediaFile}
      >
        {uploading ? `Uploading... ${uploadProgress}%` : "Upload to VHC"}
      </button>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Confirm Upload"
      subtitle="Review and configure media upload settings"
      width="650px"
      height="620px"
      onClose={handleCancel}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
        {/* Preview */}
        <div style={{
          flex: 1,
          background: "var(--background)",
          borderRadius: "12px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "250px",
        }}>
          {previewUrl && mediaType === "photo" ? (
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          ) : previewUrl && mediaType === "video" ? (
            <video
              src={previewUrl}
              controls
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div style={{ textAlign: "center", color: "var(--info)" }}>
              <div style={{ fontSize: "48px", marginBottom: "8px" }}>
                {mediaType === "photo" ? "📷" : "🎥"}
              </div>
              <div style={{ fontSize: "14px" }}>Preview not available</div>
            </div>
          )}
        </div>

        {/* File Info */}
        {mediaFile && (
          <div style={{
            background: "var(--surface)",
            borderRadius: "12px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
            }}>
              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>File Name:</span>
              <span style={{ color: "var(--text)" }}>{mediaFile.name}</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
            }}>
              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>File Size:</span>
              <span style={{ color: "var(--text)" }}>{formatFileSize(mediaFile.size)}</span>
            </div>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "13px",
            }}>
              <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>Type:</span>
              <span style={{ color: "var(--text)" }}>{mediaFile.type}</span>
            </div>
          </div>
        )}

        {/* Customer Visibility Toggle */}
        <div style={{
          background: "var(--surface)",
          borderRadius: "12px",
          padding: "16px",
        }}>
          <label style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
          }}>
            <input
              type="checkbox"
              checked={visibleToCustomer}
              onChange={(e) => setVisibleToCustomer(e.target.checked)}
              disabled={uploading}
              style={{
                width: "20px",
                height: "20px",
                cursor: "pointer",
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--accent-purple)",
                marginBottom: "4px",
              }}>
                {visibleToCustomer ? "👁️ Visible to Customer" : "🔒 Internal Only"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--info)" }}>
                {visibleToCustomer
                  ? "This media will be included in the customer portal and VHC reports"
                  : "This media will only be visible to staff members"}
              </div>
            </div>
          </label>
        </div>

        {/* Optional Description */}
        <div>
          <label style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--accent-purple)",
            marginBottom: "8px",
            display: "block",
          }}>
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={uploading}
            placeholder="Add notes about this media..."
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid var(--accent-purple-surface)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: "13px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div style={{
            background: "var(--accent-purple-surface)",
            borderRadius: "12px",
            padding: "16px",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--accent-purple)",
            }}>
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div style={{
              width: "100%",
              height: "8px",
              background: "var(--background)",
              borderRadius: "4px",
              overflow: "hidden",
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: "var(--primary)",
                transition: "width 0.3s",
              }} />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div style={{
            background: "var(--danger-surface)",
            borderRadius: "12px",
            padding: "16px",
            color: "var(--danger)",
            fontSize: "13px",
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>
    </VHCModalShell>
  );
}
