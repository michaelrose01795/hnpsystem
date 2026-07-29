// file location: src/components/VHC/mediaCapture/SectionCameraButton.js
// Per-section VHC camera launcher. Captures stay local until the technician
// reviews the session and presses Done. Each photo first asks whether it needs
// highlighting; accepted edits are flattened into the file before upload.
/* eslint-disable @next/next/no-img-element -- local blob previews cannot use next/image */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import CameraCaptureModal from "@/components/VHC/CameraCaptureModal";
import ConcernPickerModal from "@/components/VHC/mediaCapture/ConcernPickerModal";
import PhotoEditorModal from "@/components/VHC/PhotoEditorModal";
import VHCModalShell from "@/components/VHC/VHCModalShell";
import { collectSectionConcerns } from "@/components/VHC/mediaCapture/collectSectionConcerns";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";
import { uploadSectionCaptureQueue } from "@/lib/vhc/sectionCaptureSession";

function CameraGlyph({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PhotoHighlightPrompt({ isOpen, file, onYes, onNo }) {
  const previewUrl = useMemo(
    () => (isOpen && file ? URL.createObjectURL(file) : ""),
    [file, isOpen],
  );

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const footer = (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", width: "100%" }}>
      <Button variant="secondary" size="sm" onClick={onNo}>
        No, keep original
      </Button>
      <Button variant="primary" size="sm" onClick={onYes}>
        Yes, highlight it
      </Button>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Highlight this photo?"
      subtitle="You can draw a circle, box, line or arrow onto the image before it is saved."
      width="680px"
      height="min(88vh, 680px)"
      hideCloseButton
      footer={footer}
      sectionKey="section-photo-highlight-prompt"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "min(54vh, 440px)",
          overflow: "hidden",
          borderRadius: "var(--radius-md)",
          background: "var(--surfaceMutedToken)",
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Newly captured photo"
            style={{ display: "block", width: "100%", height: "100%", maxHeight: "54vh", objectFit: "contain" }}
          />
        ) : null}
      </div>
    </VHCModalShell>
  );
}

function CaptureReviewModal({
  isOpen,
  items,
  selectedId,
  onSelect,
  onRemove,
  onTakeAnother,
  onDone,
  onDiscard,
  uploading,
  errorMessage,
}) {
  const selected = items.find((item) => item.id === selectedId) || items[0] || null;
  const photoCount = items.filter((item) => item.type === "photo").length;
  const videoCount = items.filter((item) => item.type === "video").length;

  const footer = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "var(--space-3)",
        width: "100%",
        flexWrap: "wrap",
      }}
    >
      <Button variant="secondary" size="sm" onClick={onTakeAnother} disabled={uploading}>
        Take another
      </Button>
      <Button variant="primary" size="sm" onClick={onDone} disabled={uploading || items.length === 0}>
        {uploading ? `Uploading ${items.length}…` : `Done · Upload ${items.length}`}
      </Button>
    </div>
  );

  return (
    <VHCModalShell
      isOpen={isOpen}
      title="Review captured media"
      subtitle={`${photoCount} photo${photoCount === 1 ? "" : "s"} · ${videoCount} video${videoCount === 1 ? "" : "s"} — nothing uploads until Done is pressed.`}
      width="900px"
      height="min(92vh, 760px)"
      onClose={() => {
        if (!uploading) onDiscard();
      }}
      footer={footer}
      sectionKey="section-capture-review"
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
          gap: "var(--layout-card-gap)",
          height: "100%",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 0,
            overflow: "hidden",
            borderRadius: "var(--radius-md)",
            background: "var(--surfaceMutedToken)",
          }}
        >
          {selected?.type === "video" ? (
            <video
              src={selected.previewUrl}
              controls
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : selected ? (
            <img
              src={selected.previewUrl}
              alt={selected.file?.name || "Captured photo"}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ color: "var(--text-1)", fontSize: "var(--text-body-sm)" }}>
              Take a photo to begin.
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}>
          <div style={{ display: "grid", gap: "var(--space-2)", overflowY: "auto", minHeight: 0 }}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={item.id === selected?.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px minmax(0, 1fr)",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  width: "100%",
                  minHeight: "64px",
                  padding: "var(--space-2)",
                  borderRadius: "var(--radius-sm)",
                  background: item.id === selected?.id ? "var(--dropdown-option-selected-bg)" : "var(--surface)",
                  color: "var(--text-1)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {item.type === "video" ? (
                  <video
                    src={item.previewUrl}
                    muted
                    playsInline
                    style={{ width: "64px", height: "52px", objectFit: "cover", borderRadius: "var(--radius-xs)" }}
                  />
                ) : (
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ width: "64px", height: "52px", objectFit: "cover", borderRadius: "var(--radius-xs)" }}
                  />
                )}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: "var(--text-body-sm)" }}>
                    {item.type === "video" ? "Video" : "Photo"} {index + 1}
                  </span>
                  <span
                    style={{
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: "var(--text-caption)",
                      opacity: 0.7,
                    }}
                  >
                    {item.file?.name}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              <a
                href={selected.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="app-btn app-btn--secondary app-btn--sm"
              >
                View full size
              </a>
              <Button variant="secondary" size="sm" onClick={() => onRemove(selected.id)} disabled={uploading}>
                Remove
              </Button>
            </div>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              style={{
                padding: "var(--space-3)",
                borderRadius: "var(--radius-sm)",
                background: "var(--danger-surface)",
                color: "var(--danger-text)",
                fontSize: "var(--text-body-sm)",
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </VHCModalShell>
  );
}

export default function SectionCameraButton({
  sectionKey,
  sectionLabel = "",
  vhcData = null,
  jobId,
  jobNumber,
  userId,
  onUploadComplete,
  initialMode = "photo",
}) {
  const concerns = useMemo(
    () => collectSectionConcerns(sectionKey, vhcData),
    [sectionKey, vhcData],
  );
  const concernCount = concerns.length;
  const isEnabled = concernCount > 0;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [highlightPromptOpen, setHighlightPromptOpen] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeConcern, setActiveConcern] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [pendingMedia, setPendingMedia] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const pendingMediaRef = useRef([]);
  const captureCompletedRef = useRef(false);

  useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  useEffect(
    () => () => {
      pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const closeOverlays = () => {
    setPickerOpen(false);
    setCaptureOpen(false);
    setHighlightPromptOpen(false);
    setPhotoEditorOpen(false);
    setReviewOpen(false);
  };

  const discardSession = () => {
    closeOverlays();
    pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingMedia([]);
    setSelectedMediaId(null);
    setCapturedPhoto(null);
    setActiveConcern(null);
    setErrorMessage("");
  };

  const openCaptureFor = (concern) => {
    setActiveConcern(concern);
    captureCompletedRef.current = false;
    setPickerOpen(false);
    setCaptureOpen(true);
    setErrorMessage("");
  };

  const handleClick = () => {
    if (!isEnabled || uploading) return;
    if (concernCount === 1) {
      openCaptureFor(concerns[0]);
      return;
    }
    setPickerOpen(true);
  };

  const queueMedia = (file, type) => {
    if (!file) return;
    const item = {
      id: `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      type: type === "video" ? "video" : "photo",
      previewUrl: URL.createObjectURL(file),
    };
    setPendingMedia((current) => [...current, item]);
    setSelectedMediaId(item.id);
    setCapturedPhoto(null);
    setHighlightPromptOpen(false);
    setPhotoEditorOpen(false);
    setReviewOpen(true);
  };

  const handleCapture = (file, type) => {
    captureCompletedRef.current = true;
    setCaptureOpen(false);
    if (!file || !activeConcern) return;
    if (type === "photo") {
      setCapturedPhoto(file);
      setHighlightPromptOpen(true);
      return;
    }
    queueMedia(file, type);
  };

  const handleCaptureClose = () => {
    setCaptureOpen(false);
    if (captureCompletedRef.current) {
      captureCompletedRef.current = false;
      return;
    }
    if (pendingMediaRef.current.length > 0) {
      setReviewOpen(true);
    } else {
      setActiveConcern(null);
    }
  };

  const removeMedia = (itemId) => {
    setPendingMedia((current) => {
      const removed = current.find((item) => item.id === itemId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const next = current.filter((item) => item.id !== itemId);
      setSelectedMediaId((selected) => (
        selected === itemId ? next[0]?.id || null : selected
      ));
      return next;
    });
  };

  const handleDone = async () => {
    const items = pendingMediaRef.current;
    if (!items.length || !activeConcern || uploading) return;

    setUploading(true);
    setErrorMessage("");
    const result = await uploadSectionCaptureQueue({
      items,
      uploadFile: uploadVhcMediaFile,
      uploadContext: { jobId, jobNumber, userId },
      concern: activeConcern,
    });

    const savedIds = new Set(result.saved.map((entry) => entry.itemId));
    items
      .filter((item) => savedIds.has(item.id))
      .forEach((item) => URL.revokeObjectURL(item.previewUrl));

    if (result.saved.length > 0) {
      const savedFiles = result.saved.map((entry) => entry.file);
      onUploadComplete?.(savedFiles.length === 1 ? savedFiles[0] : savedFiles, activeConcern);
    }

    if (result.failed.length > 0) {
      const failedItems = result.failed.map((entry) => entry.item);
      setPendingMedia(failedItems);
      setSelectedMediaId(failedItems[0]?.id || null);
      setErrorMessage(
        `${result.failed.length} item${result.failed.length === 1 ? "" : "s"} could not be uploaded. The failed media is still here so you can press Done to retry.`,
      );
      setUploading(false);
      return;
    }

    setPendingMedia([]);
    setSelectedMediaId(null);
    setActiveConcern(null);
    setReviewOpen(false);
    setUploading(false);
  };

  const countLabel = concernCount > 0 ? ` · ${concernCount}` : "";

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={handleClick}
        disabled={!isEnabled || uploading}
        aria-disabled={!isEnabled || uploading}
        title={
          uploading
            ? "Uploading…"
            : !isEnabled
              ? "Record a concern first to enable section capture"
              : concernCount === 1
                ? `Capture for: ${concerns[0].label}`
                : `Pick from ${concernCount} concerns to capture`
        }
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-2)",
          cursor: !isEnabled || uploading ? "not-allowed" : "pointer",
        }}
      >
        <CameraGlyph size={16} />
        {uploading ? "Uploading…" : `Camera${countLabel}`}
      </Button>

      <ConcernPickerModal
        isOpen={pickerOpen}
        title={sectionLabel ? `Link capture · ${sectionLabel}` : "Link capture to a concern"}
        concerns={concerns}
        onPick={openCaptureFor}
        onClose={() => setPickerOpen(false)}
      />

      <CameraCaptureModal
        isOpen={captureOpen}
        initialMode={initialMode}
        onClose={handleCaptureClose}
        onCapture={handleCapture}
      />

      <PhotoHighlightPrompt
        isOpen={highlightPromptOpen}
        file={capturedPhoto}
        onYes={() => {
          setHighlightPromptOpen(false);
          setPhotoEditorOpen(true);
        }}
        onNo={() => queueMedia(capturedPhoto, "photo")}
      />

      <PhotoEditorModal
        isOpen={photoEditorOpen}
        photoFile={capturedPhoto}
        onSave={(file) => queueMedia(file, "photo")}
        onCancel={() => {
          setPhotoEditorOpen(false);
          setHighlightPromptOpen(true);
        }}
      />

      <CaptureReviewModal
        isOpen={reviewOpen}
        items={pendingMedia}
        selectedId={selectedMediaId}
        onSelect={setSelectedMediaId}
        onRemove={removeMedia}
        onTakeAnother={() => {
          setReviewOpen(false);
          captureCompletedRef.current = false;
          setCaptureOpen(true);
        }}
        onDone={handleDone}
        onDiscard={discardSession}
        uploading={uploading}
        errorMessage={errorMessage}
      />
    </>
  );
}
