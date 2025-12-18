"use client";

import React, { useCallback, useMemo, useState } from "react";
import { popupOverlayStyles, popupCardStyles } from "@/styles/appTheme";

const generateTempJobId = () => `temp-${Date.now()}`;

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export default function DocumentsUploadPopup({
  open,
  onClose,
  jobId,
  userId,
  onAfterUpload,
  onTempFilesQueued
}) {
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [backgroundUploads, setBackgroundUploads] = useState(false);

  const effectiveJobId = jobId ? String(jobId) : null;

  const hasFailedUploads = useMemo(
    () => uploadProgress.some((item) => item.status === "failed"),
    [uploadProgress]
  );

  const resetStateWhenClosed = useCallback(() => {
    setPendingDocuments([]);
    setUploadProgress([]);
    setIsUploading(false);
    setBackgroundUploads(false);
  }, []);

  const handleClose = useCallback(() => {
    setBackgroundUploads(true);
    if (typeof onClose === "function") {
      onClose();
    }
  }, [onClose]);

  const handlePendingSelection = useCallback((event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setPendingDocuments((prev) => [...prev, ...files]);
  }, []);

  const removePendingDocument = useCallback((removeIndex) => {
    setPendingDocuments((prev) => prev.filter((_, index) => index !== removeIndex));
  }, []);

  const updateProgressForFile = useCallback((fileName, updater) => {
    setUploadProgress((prev) =>
      prev.map((item) => (item.fileName === fileName ? updater(item) : item))
    );
  }, []);

  const uploadDocumentsForJob = useCallback(
    async (targetJobId, files, isRetry = false) => {
      if (!targetJobId || !Array.isArray(files) || files.length === 0) {
        return;
      }

      setIsUploading(true);

      if (!isRetry) {
        const initialProgress = files.map((file) => ({
          fileName: file.name || `document-${Date.now()}`,
          progress: 0,
          speed: 0,
          timeRemaining: 0,
          status: "pending",
          avgSpeed: 0,
          totalBytes: file.size,
          uploadedBytes: 0
        }));
        setUploadProgress(initialProgress);
      }

      const tempMetadata = [];

      try {
        for (const file of files) {
          const safeName = file.name || `document-${Date.now()}`;
          updateProgressForFile(safeName, (item) => ({ ...item, status: "uploading" }));

          const startTime = Date.now();
          let lastUpdate = startTime;
          let lastLoaded = 0;
          const speedSamples = [];

          try {
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              const formData = new FormData();
              formData.append("file", file);
              formData.append("jobId", targetJobId);
              formData.append("userId", userId || "system");

              xhr.upload.addEventListener("progress", (e) => {
                if (!e.lengthComputable) return;
                const now = Date.now();
                const timeDiff = (now - lastUpdate) / 1000;
                const bytesDiff = e.loaded - lastLoaded;
                const currentSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
                speedSamples.push(currentSpeed);
                if (speedSamples.length > 5) speedSamples.shift();
                const avgSpeed =
                  speedSamples.reduce((acc, value) => acc + value, 0) / speedSamples.length;
                const progress = (e.loaded / e.total) * 100;
                const remaining = e.total - e.loaded;
                const timeRemaining = avgSpeed > 0 ? remaining / avgSpeed : 0;

                updateProgressForFile(safeName, (item) => ({
                  ...item,
                  progress,
                  speed: currentSpeed,
                  avgSpeed,
                  timeRemaining,
                  uploadedBytes: e.loaded
                }));

                lastUpdate = now;
                lastLoaded = e.loaded;
              });

              xhr.addEventListener("load", () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  resolve(true);
                } else {
                  reject(new Error(`Upload failed with status ${xhr.status}`));
                }
              });

              xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

              xhr.open("POST", "/api/jobcards/upload-document");
              xhr.send(formData);
            });

            const totalTime = (Date.now() - startTime) / 1000;
            const finalAvgSpeed = totalTime > 0 ? file.size / totalTime : 0;
            updateProgressForFile(safeName, (item) => ({
              ...item,
              progress: 100,
              status: "completed",
              avgSpeed: finalAvgSpeed,
              timeRemaining: 0
            }));

            if (targetJobId.startsWith("temp-")) {
              tempMetadata.push({
                fileName: safeName,
                contentType: file.type || "application/octet-stream",
                jobId: targetJobId,
                uploadedBy: userId || "system"
              });
            }
          } catch (uploadError) {
            console.error("Document upload failed", uploadError);
            updateProgressForFile(safeName, (item) => ({
              ...item,
              status: "failed",
              progress: 0
            }));
            throw uploadError;
          }
        }

        if (tempMetadata.length && typeof onTempFilesQueued === "function") {
          onTempFilesQueued(tempMetadata);
        }

        if (!targetJobId.startsWith("temp-") && typeof onAfterUpload === "function") {
          onAfterUpload();
        }

        if (!backgroundUploads) {
          setTimeout(() => {
            if (typeof onClose === "function") {
              onClose();
            }
            resetStateWhenClosed();
          }, 1500);
        }
      } finally {
        setIsUploading(false);
        if (!backgroundUploads) {
          setPendingDocuments([]);
        }
      }
    },
    [
      backgroundUploads,
      onAfterUpload,
      onClose,
      onTempFilesQueued,
      resetStateWhenClosed,
      updateProgressForFile,
      userId
    ]
  );

  const retryFailedUploads = useCallback(async () => {
    const failedNames = uploadProgress
      .filter((item) => item.status === "failed")
      .map((item) => item.fileName);

    if (!failedNames.length) {
      alert("No failed uploads to retry");
      return;
    }

    const failedFiles = pendingDocuments.filter((file) => failedNames.includes(file.name));
    if (!failedFiles.length) {
      alert("Failed files are no longer in the pending queue");
      return;
    }

    const targetJobId = effectiveJobId || generateTempJobId();

    setUploadProgress((prev) =>
      prev.map((item) =>
        failedNames.includes(item.fileName)
          ? { ...item, status: "pending", progress: 0 }
          : item
      )
    );

    try {
      await uploadDocumentsForJob(targetJobId, failedFiles, true);
    } catch (error) {
      alert(error?.message || "Retry failed");
    }
  }, [effectiveJobId, pendingDocuments, uploadDocumentsForJob, uploadProgress]);

  const handleUploadClick = useCallback(async () => {
    if (pendingDocuments.length === 0) {
      alert("Please select files first");
      return;
    }

    const targetJobId = effectiveJobId || generateTempJobId();
    try {
      await uploadDocumentsForJob(targetJobId, pendingDocuments);
    } catch (error) {
      alert(error?.message || "Upload failed");
    }
  }, [effectiveJobId, pendingDocuments, uploadDocumentsForJob]);

  if (!open) {
    return null;
  }

  return (
    <div
      style={{ ...popupOverlayStyles, zIndex: 1300 }}
      onClick={() => {
        setBackgroundUploads(true);
        handleClose();
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          ...popupCardStyles,
          width: uploadProgress.length > 0 ? "920px" : "520px",
          maxWidth: "95%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "28px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          transition: "width 0.3s ease"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "var(--accent-purple)" }}>
              Upload Documents
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--info)" }}>
              {uploadProgress.length > 0 ? "Upload in progress..." : "Attach PDFs or images and upload immediately."}
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              border: "none",
              background: "transparent",
              fontSize: "22px",
              cursor: "pointer",
              color: "var(--info)"
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: "20px", flexWrap: uploadProgress.length > 0 ? "nowrap" : "wrap" }}>
          <div style={{ flex: uploadProgress.length > 0 ? "0 0 45%" : "1", display: "flex", flexDirection: "column", gap: "16px" }}>
            <label
              htmlFor="documents-input"
              style={{
                border: "2px dashed var(--accent-purple)",
                borderRadius: "16px",
                padding: "28px",
                textAlign: "center",
                cursor: "pointer",
                backgroundColor: "var(--accent-purple-surface)",
                color: "var(--accent-purple)",
                fontWeight: "600",
                fontSize: "14px"
              }}
            >
              Click to select files (PNG, JPG, PDF)
              <input
                id="documents-input"
                type="file"
                    multiple
                accept="image/*,application/pdf"
                style={{ display: "none" }}
                onChange={handlePendingSelection}
              />
            </label>

            {pendingDocuments.length > 0 && (
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid var(--info-surface)",
                  borderRadius: "12px",
                  padding: "12px"
                }}
              >
                {pendingDocuments.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px",
                      borderBottom: "1px solid var(--info-surface)"
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "var(--accent-purple)" }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--info-dark)" }}>{formatBytes(file.size)}</div>
                    </div>
                    <button
                      onClick={() => removePendingDocument(idx)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--danger)",
                        fontSize: "13px",
                        cursor: "pointer"
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={handleClose}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--info-surface)",
                  backgroundColor: "var(--surface)",
                  color: "var(--info-dark)",
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                Close
              </button>
              <button
                onClick={handleUploadClick}
                disabled={isUploading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: "600",
                  cursor: isUploading ? "not-allowed" : "pointer",
                  boxShadow: "none",
                  opacity: isUploading ? 0.7 : 1
                }}
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>

          {uploadProgress.length > 0 && (
            <div
              style={{
                flex: "0 0 50%",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                backgroundColor: "var(--surface)",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--info-surface)",
                maxHeight: "70vh",
                overflowY: "auto"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "600", color: "var(--accent-purple)" }}>
                  Upload Progress
                </h4>
                {hasFailedUploads && (
                  <button
                    onClick={retryFailedUploads}
                    disabled={isUploading}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--danger)",
                      color: "white",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: isUploading ? "not-allowed" : "pointer",
                      opacity: isUploading ? 0.6 : 1
                    }}
                  >
                    Retry Failed
                  </button>
                )}
              </div>

              {uploadProgress.map((item, idx) => {
                const statusColor =
                  item.status === "completed"
                    ? "var(--success)"
                    : item.status === "failed"
                    ? "var(--danger)"
                    : item.status === "uploading"
                    ? "var(--primary)"
                    : "var(--info)";

                return (
                  <div
                    key={`progress-${idx}`}
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--info-surface)",
                      borderRadius: "10px",
                      border: `1px solid ${statusColor}`
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: "600",
                          color: statusColor,
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginRight: "8px"
                        }}
                      >
                        {item.fileName}
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: statusColor }}>
                        {item.progress.toFixed(0)}%
                      </div>
                    </div>

                    <div
                      style={{
                        width: "100%",
                        height: "8px",
                        backgroundColor: "var(--surface)",
                        borderRadius: "4px",
                        overflow: "hidden",
                        marginBottom: "8px"
                      }}
                    >
                      <div
                        style={{
                          width: `${item.progress}%`,
                          height: "100%",
                          backgroundColor: statusColor,
                          transition: "width 0.3s ease"
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11px",
                        color: "var(--info)"
                      }}
                    >
                      <div>
                        {item.status === "uploading" && (
                          <>
                            <span style={{ fontWeight: "600" }}>Speed: </span>
                            {formatBytes(item.speed)}/s
                          </>
                        )}
                        {item.status === "completed" && (
                          <>
                            <span style={{ fontWeight: "600" }}>Avg Speed: </span>
                            {formatBytes(item.avgSpeed)}/s
                          </>
                        )}
                        {item.status === "failed" && (
                          <span style={{ color: "var(--danger)", fontWeight: "600" }}>Upload Failed</span>
                        )}
                        {item.status === "pending" && (
                          <span style={{ color: "var(--info-dark)" }}>Waiting...</span>
                        )}
                      </div>
                      <div>
                        {item.status === "uploading" && item.timeRemaining > 0 && (
                          <>
                            <span style={{ fontWeight: "600" }}>Time: </span>
                            {item.timeRemaining < 60
                              ? `${Math.ceil(item.timeRemaining)}s`
                              : `${Math.floor(item.timeRemaining / 60)}m ${Math.ceil(item.timeRemaining % 60)}s`}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
