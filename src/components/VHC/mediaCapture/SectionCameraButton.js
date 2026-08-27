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
import VideoEditorModal from "@/components/VHC/VideoEditorModal";
import PopupModal from "@/components/popups/popupStyleApi";
import LayerTheme from "@/components/ui/LayerTheme";
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

function PhotoHighlightPrompt({ isOpen, file, onYes, onNo, position = null }) {
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

  return (
    <PopupModal
      isOpen={isOpen}
      closeOnBackdrop={false}
      closeOnEscape={false}
      ariaLabel="Highlight this photo?"
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(680px, 100%)", overflow: "hidden" }}
    >
      <div className="app-settings-popup app-media-editor-popup">
        <header className="app-popup-compact-header">
          <h2>
            {position
              ? `Highlight this photo? · ${position.index + 1} of ${position.total}`
              : "Highlight this photo?"}
          </h2>
          <div className="app-popup-compact-header__actions">
            <Button variant="primary" size="sm" onClick={onYes}>
              Yes, highlight it
            </Button>
            <Button variant="secondary" size="sm" onClick={onNo}>
              No, keep original
            </Button>
          </div>
        </header>

        <LayerTheme
          radius="var(--radius-md)"
          padding="0"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Newly captured photo"
              style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : null}
        </LayerTheme>
      </div>
    </PopupModal>
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

  return (
    <PopupModal
      isOpen={isOpen}
      closeOnBackdrop={false}
      onClose={() => {
        if (!uploading) onDiscard();
      }}
      ariaLabel="Review captured media"
      cardClassName="app-settings-popup-card"
      cardStyle={{ width: "min(900px, 100%)", overflow: "hidden" }}
    >
      <div className="app-settings-popup app-media-editor-popup">
        <header className="app-popup-compact-header">
          <h2>Review captured media</h2>
          <div className="app-popup-compact-header__actions">
            <Button variant="primary" size="sm" onClick={onDone} disabled={uploading || items.length === 0}>
              {uploading ? `Uploading ${items.length}…` : `Done · Upload ${items.length}`}
            </Button>
            <Button variant="secondary" size="sm" onClick={onTakeAnother} disabled={uploading}>
              Take another
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!uploading) onDiscard();
              }}
              disabled={uploading}
            >
              Close
            </Button>
          </div>
        </header>

        <LayerTheme
          radius="var(--radius-md)"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: "var(--layout-card-gap)",
            flex: "0 0 auto",
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              flex: "1 1 240px",
              minWidth: 0,
              overflowX: "auto",
              overflowY: "hidden",
              paddingBottom: "var(--space-1)",
            }}
          >
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={item.id === selected?.id}
                title={`${item.type === "video" ? "Video" : "Photo"} ${index + 1}`}
                className={
                  item.id === selected?.id
                    ? "app-btn app-btn--primary app-btn--sm"
                    : "app-btn app-btn--secondary app-btn--sm"
                }
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "var(--space-1)",
                  flex: "0 0 auto",
                  width: "104px",
                  minHeight: "var(--control-height)",
                }}
              >
                {item.type === "video" ? (
                  <video
                    src={item.previewUrl}
                    muted
                    playsInline
                    style={{ width: "88px", height: "56px", objectFit: "cover", borderRadius: "var(--radius-xs)" }}
                  />
                ) : (
                  <img
                    src={item.previewUrl}
                    alt=""
                    style={{ width: "88px", height: "56px", objectFit: "cover", borderRadius: "var(--radius-xs)" }}
                  />
                )}
                <span
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.type === "video" ? "Video" : "Photo"} {index + 1}
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", flex: "0 0 auto" }}>
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
        </LayerTheme>

        {errorMessage ? (
          <div role="alert" className="app-alert app-alert--danger" style={{ flex: "0 0 auto" }}>
            {errorMessage}
          </div>
        ) : null}

        <LayerTheme
          radius="var(--radius-md)"
          padding="0"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "hidden",
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
              alt={`Photo ${items.indexOf(selected) + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span style={{ color: "var(--text-1)" }}>Take a photo to begin.</span>
          )}
        </LayerTheme>
      </div>
    </PopupModal>
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
  // When a single concern is supplied the picker is skipped entirely and the
  // capture session binds to that one issue. Used by the per-row camera button
  // inside the Reported Issues list.
  concern: fixedConcern = null,
  iconOnly = false,
  label = "Camera",
  disabled = false,
}) {
  const concerns = useMemo(
    () => (fixedConcern ? [fixedConcern] : collectSectionConcerns(sectionKey, vhcData)),
    [fixedConcern, sectionKey, vhcData],
  );
  const concernCount = concerns.length;
  const isEnabled = concernCount > 0 && !disabled;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [highlightPromptOpen, setHighlightPromptOpen] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [videoEditorOpen, setVideoEditorOpen] = useState(false);
  // One capture session can produce several photos and videos. They are held
  // here and taken through the highlight / edit step one at a time.
  const [editQueue, setEditQueue] = useState([]);
  const [editIndex, setEditIndex] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeConcern, setActiveConcern] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [pendingMedia, setPendingMedia] = useState([]);
  const [selectedMediaId, setSelectedMediaId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // In-capture tray editing. FullScreenCapture awaits a File (or null), so the
  // resolver is parked here while the editor popup is open over the camera.
  const [trayEdit, setTrayEdit] = useState(null);
  const trayEditResolverRef = useRef(null);
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
    setVideoEditorOpen(false);
    setReviewOpen(false);
  };

  const discardSession = () => {
    closeOverlays();
    pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingMedia([]);
    setSelectedMediaId(null);
    setCapturedPhoto(null);
    setEditQueue([]);
    setEditIndex(0);
    setActiveConcern(null);
    setErrorMessage("");
  };

  // Tapping a thumbnail in the capture tray opens that item's editor without
  // closing the camera. The promise resolves when the technician leaves the
  // editor: a File keeps their work, null leaves the capture as it was.
  const handleTrayEdit = (entry) =>
    new Promise((resolve) => {
      trayEditResolverRef.current = resolve;
      setTrayEdit({
        file: entry.file,
        type: entry.meta?.type === "video" ? "video" : "photo",
      });
    });

  const resolveTrayEdit = (file) => {
    const resolve = trayEditResolverRef.current;
    trayEditResolverRef.current = null;
    setTrayEdit(null);
    resolve?.(file || null);
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

  const buildPendingItem = (file, type) => ({
    id: `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    type: type === "video" ? "video" : "photo",
    previewUrl: URL.createObjectURL(file),
  });

  const queueMedia = (file, type) => {
    if (!file) return;
    const item = buildPendingItem(file, type);
    setPendingMedia((current) => [...current, item]);
    setSelectedMediaId(item.id);
    setCapturedPhoto(null);
    setHighlightPromptOpen(false);
    setPhotoEditorOpen(false);
    setReviewOpen(true);
  };

  // Everything that came out of the highlight / edit pass lands in the review
  // queue together, so the technician sees one list before uploading.
  const finishEditQueue = (queue) => {
    const items = queue
      .filter((entry) => entry.file)
      .map((entry) => buildPendingItem(entry.file, entry.type));
    setEditQueue([]);
    setEditIndex(0);
    setCapturedPhoto(null);
    setHighlightPromptOpen(false);
    setPhotoEditorOpen(false);
    setVideoEditorOpen(false);
    if (items.length === 0) {
      setReviewOpen(pendingMediaRef.current.length > 0);
      return;
    }
    setPendingMedia((current) => [...current, ...items]);
    setSelectedMediaId(items[0].id);
    setReviewOpen(true);
  };

  // Open the right surface for the item at `index`: photos are offered the
  // highlight prompt first, videos go straight into the video editor.
  // `preferEditor` keeps the technician in the editor when they use Back / Next
  // from inside it, instead of bouncing them back through the highlight prompt.
  const openEditStage = (index, queue, preferEditor = false) => {
    const item = queue[index];
    if (!item) {
      finishEditQueue(queue);
      return;
    }
    setEditQueue(queue);
    setEditIndex(index);
    if (item.type === "video") {
      setCapturedPhoto(null);
      setHighlightPromptOpen(false);
      setPhotoEditorOpen(false);
      setVideoEditorOpen(true);
      return;
    }
    setVideoEditorOpen(false);
    setCapturedPhoto(item.file);
    setPhotoEditorOpen(preferEditor);
    setHighlightPromptOpen(!preferEditor);
  };

  // Replace the current item's file (an applied edit) and move by `step`.
  const commitAndMove = (file, step, preferEditor = false) => {
    const queue = editQueue.map((entry, idx) => (
      idx === editIndex && file ? { ...entry, file } : entry
    ));
    openEditStage(editIndex + step, queue, preferEditor);
  };

  // Batch hand-off from the capture screen's Done button.
  const handleCaptureBatchDone = (batch) => {
    captureCompletedRef.current = true;
    setCaptureOpen(false);
    if (!activeConcern) return;
    const entries = (batch || []).filter((entry) => entry?.file);
    const stamp = Date.now();

    // Captures the technician already opened from the tray have had their edit
    // decision made, so they go straight to review. Only the untouched ones
    // still get the highlight / edit pass.
    const settled = entries
      .filter((entry) => entry.edited)
      .map((entry) => buildPendingItem(entry.file, entry.meta?.type));
    const queue = entries
      .filter((entry) => !entry.edited)
      .map((entry, idx) => ({
        id: `edit-${stamp}-${idx}`,
        file: entry.file,
        type: entry.meta?.type === "video" ? "video" : "photo",
      }));

    if (settled.length > 0) {
      setPendingMedia((current) => [...current, ...settled]);
      setSelectedMediaId((current) => current || settled[0].id);
    }

    if (queue.length === 0) {
      if (settled.length > 0 || pendingMediaRef.current.length > 0) setReviewOpen(true);
      return;
    }
    openEditStage(0, queue);
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

  const countLabel = fixedConcern || concernCount === 0 ? "" : ` · ${concernCount}`;
  const buttonTitle = uploading
    ? "Uploading…"
    : !isEnabled
      ? fixedConcern
        ? "Capture unavailable for this issue"
        : "Record a concern first to enable section capture"
      : concernCount === 1
        ? `Capture for: ${concerns[0].label}`
        : `Pick from ${concernCount} concerns to capture`;

  return (
    <>
      <Button
        variant={iconOnly ? "secondary" : "primary"}
        size="sm"
        className={iconOnly ? "app-btn--icon" : undefined}
        onClick={handleClick}
        disabled={!isEnabled || uploading}
        aria-disabled={!isEnabled || uploading}
        aria-label={iconOnly ? buttonTitle : undefined}
        title={buttonTitle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: iconOnly ? 0 : "var(--space-2)",
          cursor: !isEnabled || uploading ? "not-allowed" : "pointer",
        }}
      >
        <CameraGlyph size={16} />
        {iconOnly ? null : uploading ? "Uploading…" : `${label}${countLabel}`}
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
        batchMode
        onDone={handleCaptureBatchDone}
        onEditCapture={handleTrayEdit}
      />

      {/* Editors for the in-capture tray. Separate instances from the post-Done
          queue below: these sit on top of the live camera and resolve a promise
          rather than advancing a queue. */}
      <PhotoEditorModal
        isOpen={trayEdit?.type === "photo"}
        photoFile={trayEdit?.type === "photo" ? trayEdit.file : null}
        onSave={(file) => resolveTrayEdit(file)}
        onSkip={(file) => resolveTrayEdit(file)}
        onCancel={() => resolveTrayEdit(null)}
      />

      <VideoEditorModal
        isOpen={trayEdit?.type === "video"}
        videoFile={trayEdit?.type === "video" ? trayEdit.file : null}
        onSave={(file) => resolveTrayEdit(file)}
        onSkip={(file) => resolveTrayEdit(file)}
        onCancel={() => resolveTrayEdit(null)}
      />

      <PhotoHighlightPrompt
        isOpen={highlightPromptOpen}
        file={capturedPhoto}
        position={editQueue.length > 1 ? { index: editIndex, total: editQueue.length } : null}
        onYes={() => {
          setHighlightPromptOpen(false);
          setPhotoEditorOpen(true);
        }}
        onNo={() => {
          // Keep the original and move on to the next capture in the session.
          if (editQueue.length > 0) {
            commitAndMove(null, 1);
            return;
          }
          queueMedia(capturedPhoto, "photo");
        }}
      />

      <PhotoEditorModal
        isOpen={photoEditorOpen}
        photoFile={capturedPhoto}
        queueIndex={editIndex}
        queueTotal={editQueue.length}
        onSave={(file) => {
          if (editQueue.length > 0) {
            commitAndMove(file, 1);
            return;
          }
          queueMedia(file, "photo");
        }}
        onBack={editQueue.length > 1 && editIndex > 0 ? (file) => commitAndMove(file, -1, true) : undefined}
        onNext={editQueue.length > 1 && editIndex < editQueue.length - 1 ? (file) => commitAndMove(file, 1, true) : undefined}
        onCancel={() => {
          setPhotoEditorOpen(false);
          setHighlightPromptOpen(true);
        }}
      />

      <VideoEditorModal
        isOpen={videoEditorOpen}
        videoFile={editQueue[editIndex]?.file || null}
        queueIndex={editIndex}
        queueTotal={editQueue.length}
        onSave={(file) => commitAndMove(file, 1)}
        onSkip={() => commitAndMove(null, 1)}
        onBack={editQueue.length > 1 && editIndex > 0 ? (file) => commitAndMove(file, -1, true) : undefined}
        onNext={editQueue.length > 1 && editIndex < editQueue.length - 1 ? (file) => commitAndMove(file, 1, true) : undefined}
        onCancel={discardSession}
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
