// file location: src/components/VHC/VhcCameraButton.js
// Standalone VHC capture launcher that now saves media immediately after capture.

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Button from "@/components/ui/Button";
import useIdleWarm from "@/hooks/useIdleWarm";

// The launcher Button below stays in the first-load bundle - the camera control
// has to be immediately available. What it OPENS does not: every surface here
// renders nothing until its own isOpen flag is true (each one bottoms out in
// VHCModalShell / FullScreenCapture, both of which return null when closed), so
// mounting them only while open produces the same DOM and runs the same effects.
// They are fetched on idle by useIdleWarm below, which means the first press
// still finds the chunk in cache rather than waiting on a request.
const loadCameraCaptureModal = () => import("./CameraCaptureModal");
const loadMediaUploadConfirmModal = () => import("./MediaUploadConfirmModal");
const loadPhotoEditorModal = () => import("./PhotoEditorModal");
const loadVideoEditorModal = () => import("./VideoEditorModal");

const CameraCaptureModal = dynamic(loadCameraCaptureModal, { ssr: false });
const MediaUploadConfirmModal = dynamic(loadMediaUploadConfirmModal, { ssr: false });
const PhotoEditorModal = dynamic(loadPhotoEditorModal, { ssr: false });
const VideoEditorModal = dynamic(loadVideoEditorModal, { ssr: false });

export default function VhcCameraButton({
  jobId,
  jobNumber,
  userId,
  onUploadComplete,
  buttonStyle,
}) {
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  useIdleWarm([
    loadCameraCaptureModal,
    loadMediaUploadConfirmModal,
    loadPhotoEditorModal,
    loadVideoEditorModal,
  ]);

  const [capturedMedia, setCapturedMedia] = useState(null);
  const [editedMedia, setEditedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);

  const resetFlow = () => {
    setShowCameraModal(false);
    setShowPhotoEditor(false);
    setShowVideoEditor(false);
    setShowUploadConfirm(false);
    setCapturedMedia(null);
    setEditedMedia(null);
    setMediaType(null);
  };

  const handleCameraClick = () => {
    setShowCameraModal(true);
  };

  const handleCapture = (file, type) => {
    // Hand the local File straight to the editor so trimming /
    // captureStream() works without remote-URL CORS issues. We only
    // upload the final (edited or original) file once the user
    // confirms in MediaUploadConfirmModal.
    setCapturedMedia(file);
    setEditedMedia(file);
    setMediaType(type);
    setShowCameraModal(false);
    if (type === "photo") {
      setShowPhotoEditor(true);
    } else {
      setShowVideoEditor(true);
    }
  };

  const handlePhotoEditorSave = (file) => {
    setEditedMedia(file);
    setShowPhotoEditor(false);
    setShowUploadConfirm(true);
  };

  const handlePhotoEditorSkip = (file) => {
    setEditedMedia(file);
    setShowPhotoEditor(false);
    setShowUploadConfirm(true);
  };

  const handleVideoEditorSave = (file) => {
    setEditedMedia(file);
    setShowVideoEditor(false);
    setShowUploadConfirm(true);
  };

  const handleVideoEditorSkip = (file) => {
    setEditedMedia(file);
    setShowVideoEditor(false);
    setShowUploadConfirm(true);
  };

  const handleUploadComplete = (fileRecord) => {
    onUploadComplete?.(fileRecord);
    resetFlow();
  };

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={handleCameraClick}
        style={{
          padding: "var(--space-sm) var(--space-md)",
          display: "inline-flex",
          alignItems: "center",
          gap: "var(--space-1)",
          fontSize: "var(--text-body-sm)",
          ...(buttonStyle || {}),
        }}
        title="Capture VHC photo or video"
      >
        Camera
      </Button>

      {showCameraModal && <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCapture}
        initialMode="photo"
      />}

      {showPhotoEditor && <PhotoEditorModal
        isOpen={showPhotoEditor}
        photoFile={capturedMedia}
        onSave={handlePhotoEditorSave}
        onSkip={handlePhotoEditorSkip}
        onCancel={resetFlow}
      />}

      {showVideoEditor && <VideoEditorModal
        isOpen={showVideoEditor}
        videoFile={capturedMedia}
        onSave={handleVideoEditorSave}
        onSkip={handleVideoEditorSkip}
        onCancel={resetFlow}
      />}

      {showUploadConfirm && <MediaUploadConfirmModal
        isOpen={showUploadConfirm}
        mediaFile={editedMedia}
        mediaType={mediaType}
        existingFileId={null}
        jobId={jobId}
        jobNumber={jobNumber}
        userId={userId}
        onUploadComplete={handleUploadComplete}
        onCancel={resetFlow}
      />}
    </>
  );
}
