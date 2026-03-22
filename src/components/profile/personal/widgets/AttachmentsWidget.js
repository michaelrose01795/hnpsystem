import React, { useRef, useState } from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import {
  EmptyState,
  SectionLabel,
  formatDate,
  widgetButtonStyle,
  widgetGhostButtonStyle,
} from "@/components/profile/personal/widgets/shared";

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(bytes / 1024, 0.1).toFixed(1)} KB`;
}

export default function AttachmentsWidget({
  widget,
  datasets,
  actions,
  onRemove,
  dragHandleProps,
  resizeHandleProps,
  compact = false,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await actions.uploadAttachment(file);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  return (
    <BaseWidget
      title={widget.config?.title || "Attachments"}
      subtitle="Private files held behind your personal unlock"
      accent="var(--accent-purple)"
      onRemove={onRemove}
      dragHandleProps={dragHandleProps}
      resizeHandleProps={resizeHandleProps}
      compact={compact}
    >
      <SectionLabel>Upload</SectionLabel>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} style={widgetButtonStyle}>
          {isUploading ? "Uploading..." : "Upload file"}
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />
      </div>

      <SectionLabel>Saved files</SectionLabel>
      {(datasets.attachments || []).length === 0 ? (
        <EmptyState>No attachments uploaded yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gap: "8px", overflowY: "auto" }}>
          {(datasets.attachments || []).map((attachment) => (
            <div
              key={attachment.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                alignItems: "center",
                padding: "12px",
                borderRadius: "14px",
                background: "rgba(var(--accent-purple-rgb), 0.04)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <a
                  href={attachment.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {attachment.fileName}
                </a>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                  {formatFileSize(attachment.fileSize)} · {formatDate(attachment.createdAt)}
                </div>
              </div>
              <button type="button" onClick={() => actions.deleteAttachment(attachment.id)} style={widgetGhostButtonStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </BaseWidget>
  );
}
