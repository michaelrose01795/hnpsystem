// file location: src/components/VHC/VhcCameraButton.js
// Standalone VHC capture launcher that now saves media immediately after capture.

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import CameraCaptureModal from "./CameraCaptureModal";
import MediaUploadConfirmModal from "./MediaUploadConfirmModal";
import PhotoEditorModal from "./PhotoEditorModal";
import VideoEditorModal from "./VideoEditorModal";

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

      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCapture}
        initialMode="photo"
      />

      <PhotoEditorModal
        isOpen={showPhotoEditor}
        photoFile={capturedMedia}
        onSave={handlePhotoEditorSave}
        onSkip={handlePhotoEditorSkip}
        onCancel={resetFlow}
      />

      <VideoEditorModal
        isOpen={showVideoEditor}
        videoFile={capturedMedia}
        onSave={handleVideoEditorSave}
        onSkip={handleVideoEditorSkip}
        onCancel={resetFlow}
      />

      <MediaUploadConfirmModal
        isOpen={showUploadConfirm}
        mediaFile={editedMedia}
        mediaType={mediaType}
        existingFileId={null}
        jobId={jobId}
        jobNumber={jobNumber}
        userId={userId}
        onUploadComplete={handleUploadComplete}
        onCancel={resetFlow}
      />
    </>
  );
}
