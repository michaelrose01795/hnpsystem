// file location: src/components/VHC/CustomerVideoButton.js

import React, { useMemo, useState } from "react";
import CameraCaptureModal from "@/components/VHC/CameraCaptureModal";
import VHCModalShell, { buildModalButton } from "@/components/VHC/VHCModalShell";

const OVERLAY_LIBRARY = [
  { type: "tyre_depth", label: "Tyre depth", hint: "Add tread depth reading and unit (mm)." },
  { type: "brake_measurement", label: "Brake measurement", hint: "Show pad/disc thickness and minimum spec." },
  { type: "damage_marker", label: "Damage marker", hint: "Circle crack/leak/wear and add short explanation." },
  { type: "service_note", label: "Service note", hint: "Add a plain-English note for the customer." },
];

const buildAssistantSuggestions = (context = "") => {
  const text = String(context || "").toLowerCase();
  if (text.includes("tyre") || text.includes("wheel")) {
    return [OVERLAY_LIBRARY[0], OVERLAY_LIBRARY[2], OVERLAY_LIBRARY[3]];
  }
  if (text.includes("brake") || text.includes("hub")) {
    return [OVERLAY_LIBRARY[1], OVERLAY_LIBRARY[2], OVERLAY_LIBRARY[3]];
  }
  return [OVERLAY_LIBRARY[2], OVERLAY_LIBRARY[3], OVERLAY_LIBRARY[0]];
};

function CustomerVideoBuilderModal({
  isOpen,
  videoFile,
  jobNumber,
  userId,
  vhcContextLabel,
  onClose,
  onUploaded,
}) {
  const [overlayType, setOverlayType] = useState("service_note");
  const [overlayText, setOverlayText] = useState("");
  const [overlayTimestamp, setOverlayTimestamp] = useState(0);
  const [overlays, setOverlays] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const previewUrl = useMemo(() => {
    if (!videoFile) return "";
    return URL.createObjectURL(videoFile);
  }, [videoFile]);

  const assistantSuggestions = useMemo(() => buildAssistantSuggestions(vhcContextLabel), [vhcContextLabel]);

  const addOverlay = () => {
    if (!overlayText.trim()) return;
    setOverlays((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        type: overlayType,
        text: overlayText.trim(),
        timestampSeconds: Number.isFinite(Number(overlayTimestamp)) ? Number(overlayTimestamp) : 0,
      },
    ]);
    setOverlayText("");
  };

  const removeOverlay = (id) => {
    setOverlays((prev) => prev.filter((overlay) => overlay.id !== id));
  };

  const uploadCustomerVideo = async () => {
    if (!videoFile || !jobNumber) return;
    try {
      setIsUploading(true);
      setUploadError("");
      const formData = new FormData();
      formData.append("file", videoFile);
      formData.append("jobNumber", String(jobNumber));
      formData.append("uploadedBy", String(userId || "system"));
      formData.append("overlays", JSON.stringify(overlays));
      formData.append("contextLabel", String(vhcContextLabel || ""));

      const response = await fetch("/api/vhc/customer-video-upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Upload failed");
      }
      onUploaded?.(payload.record);
      onClose?.();
    } catch (error) {
      setUploadError(error?.message || "Unable to upload customer video.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <VHCModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Video"
      subtitle="Record a customer-facing walkthrough and add guided overlays"
      width="1080px"
      height="720px"
      footer={(
        <>
          <button type="button" onClick={onClose} style={buildModalButton("ghost")}>
            Cancel
          </button>
          <button type="button" onClick={uploadCustomerVideo} disabled={isUploading} style={buildModalButton("primary")}>
            {isUploading ? "Uploading..." : "Save Customer Video"}
          </button>
        </>
      )}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: "16px", height: "100%" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-light)", padding: "10px" }}>
          {previewUrl ? (
            <video src={previewUrl} controls style={{ width: "100%", height: "100%", borderRadius: "var(--radius-sm)", objectFit: "contain" }} />
          ) : (
            <div style={{ color: "var(--text-secondary)" }}>No video captured yet.</div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 0 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px", background: "var(--surface)" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>AI-like overlay suggestions</div>
            <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "6px" }}>
              {assistantSuggestions.map((suggestion) => (
                <li key={suggestion.type} style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{suggestion.label}: {suggestion.hint}</li>
              ))}
            </ul>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px", background: "var(--surface)" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--text-secondary)" }}>
              Overlay type
              <select value={overlayType} onChange={(event) => setOverlayType(event.target.value)} style={{ padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                {OVERLAY_LIBRARY.map((overlay) => <option key={overlay.type} value={overlay.type}>{overlay.label}</option>)}
              </select>
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
              Timestamp (seconds)
              <input type="number" min="0" value={overlayTimestamp} onChange={(event) => setOverlayTimestamp(event.target.value)} style={{ padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "12px", color: "var(--text-secondary)", marginTop: "8px" }}>
              Overlay text
              <textarea rows={3} value={overlayText} onChange={(event) => setOverlayText(event.target.value)} style={{ padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", resize: "vertical" }} />
            </label>
            <button type="button" onClick={addOverlay} style={{ ...buildModalButton("secondary"), marginTop: "8px" }}>
              Add overlay
            </button>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px", background: "var(--surface)", flex: 1, minHeight: 0, overflowY: "auto" }}>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)", marginBottom: "8px" }}>Overlay timeline</div>
            {overlays.length === 0 ? (
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-secondary)" }}>No overlays yet.</p>
            ) : overlays.map((overlay) => (
              <div key={overlay.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px", marginBottom: "8px", background: "var(--surface-light)" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{overlay.type} @ {overlay.timestampSeconds}s</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>{overlay.text}</div>
                <button type="button" onClick={() => removeOverlay(overlay.id)} style={{ ...buildModalButton("ghost"), marginTop: "6px", padding: "6px 10px", fontSize: "12px" }}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          {uploadError ? <p style={{ margin: 0, color: "var(--danger)", fontSize: "12px" }}>{uploadError}</p> : null}
        </div>
      </div>
    </VHCModalShell>
  );
}

export default function CustomerVideoButton({ jobNumber, userId, vhcContextLabel = "", buttonStyle, onUploadComplete }) {
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [videoFile, setVideoFile] = useState(null);

  const handleCapture = (file, type) => {
    if (type !== "video") return;
    setVideoFile(file);
    setShowCaptureModal(false);
    setShowBuilder(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowCaptureModal(true)}
        style={buttonStyle}
      >
        Customer Video
      </button>

      <CameraCaptureModal
        isOpen={showCaptureModal}
        onClose={() => setShowCaptureModal(false)}
        onCapture={handleCapture}
        initialMode="video"
      />

      <CustomerVideoBuilderModal
        isOpen={showBuilder}
        videoFile={videoFile}
        jobNumber={jobNumber}
        userId={userId}
        vhcContextLabel={vhcContextLabel}
        onClose={() => {
          setShowBuilder(false);
          setVideoFile(null);
        }}
        onUploaded={(record) => {
          onUploadComplete?.(record);
          setShowBuilder(false);
          setVideoFile(null);
        }}
      />
    </>
  );
}
