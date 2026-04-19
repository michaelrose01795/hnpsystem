// file location: src/components/VHC/mediaCapture/SectionCameraButton.js
// Per-section camera launcher used in the footer of each VHC detail
// modal (Wheels, Brakes, Service, External, Internal, Underside).
//
// Behaviour:
//   - Disabled until at least one amber/red concern has been reported
//     in the section. Disabled state is still rendered so the button's
//     position and meaning stay consistent.
//   - One concern → tapping opens the camera with that concern
//     auto-selected. No picker.
//   - Two or more concerns → tapping opens ConcernPickerModal first.
//     The technician picks the specific issue; the camera then opens
//     with that concern attached.
//   - On capture the file is uploaded via uploadVhcMediaFile with the
//     concernLink payload, so job_files.vhc_concern_link stores the
//     back-reference.
//
// The component is self-contained: it manages the picker state, the
// FullScreenCapture visibility, and the upload lifecycle. Parents only
// pass the section key, the current vhcData, and the job identifiers.

import React, { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import CameraCaptureModal from "@/components/VHC/CameraCaptureModal";
import ConcernPickerModal from "@/components/VHC/mediaCapture/ConcernPickerModal";
import { collectSectionConcerns } from "@/components/VHC/mediaCapture/collectSectionConcerns";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";

// Simple inline camera icon so the button doesn't need an asset.
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

export default function SectionCameraButton({
  sectionKey, // "external" / "wheels" / "brakes" / "service" / "internal" / "underside"
  sectionLabel = "", // Human label used in the picker modal title
  vhcData = null, // Raw VHC state so we can derive concerns live
  jobId,
  jobNumber,
  userId,
  onUploadComplete, // (file) => void — parent may refresh after upload
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
  const [activeConcern, setActiveConcern] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const openCaptureFor = (concern) => {
    setActiveConcern(concern);
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
    // 2+ concerns — let the technician pick which one this capture is for.
    setPickerOpen(true);
  };

  const handleCapture = async (file /* , type */) => {
    setCaptureOpen(false);
    if (!file || !activeConcern) return;
    try {
      setUploading(true);
      setErrorMessage("");
      const saved = await uploadVhcMediaFile({
        file,
        jobId,
        jobNumber,
        userId,
        visibleToCustomer: true,
        concernLink: {
          section: activeConcern.section,
          category: activeConcern.category || null,
          categoryLabel: activeConcern.categoryLabel || null,
          concernId: activeConcern.concernId,
          index: activeConcern.index,
          label: activeConcern.label,
          status: activeConcern.status,
        },
      });
      onUploadComplete?.(saved, activeConcern);
    } catch (err) {
      console.error("Section camera upload failed:", err);
      setErrorMessage(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      setActiveConcern(null);
    }
  };

  // Count badge content — shows the number of concerns the button is
  // linking against so technicians can tell the state at a glance.
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
          gap: "6px",
          cursor: !isEnabled || uploading ? "not-allowed" : "pointer",
        }}
      >
        <CameraGlyph size={16} />
        {uploading ? "Uploading…" : `Camera${countLabel}`}
      </Button>

      {errorMessage ? (
        <span
          role="alert"
          style={{
            marginLeft: "8px",
            color: "var(--danger)",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {errorMessage}
        </span>
      ) : null}

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
        onClose={() => { setCaptureOpen(false); setActiveConcern(null); }}
        onCapture={handleCapture}
      />
    </>
  );
}
