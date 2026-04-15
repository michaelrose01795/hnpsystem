// file location: src/components/VHC/VhcCameraButton.js
// Standalone VHC capture launcher that now saves media immediately after capture.

import React, { useState } from "react";
import { createVhcButtonStyle } from "@/styles/appTheme";
import CameraCaptureModal from "./CameraCaptureModal";
import MediaUploadConfirmModal from "./MediaUploadConfirmModal";
import PhotoEditorModal from "./PhotoEditorModal";
import VideoEditorModal from "./VideoEditorModal";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";

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
  const [isPersistingCapture, setIsPersistingCapture] = useState(false);

  const [capturedMedia, setCapturedMedia] = useState(null);
  const [editedMedia, setEditedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [uploadedMedia, setUploadedMedia] = useState(null);

  const resetFlow = () => {
    setShowCameraModal(false);
    setShowPhotoEditor(false);
    setShowVideoEditor(false);
    setShowUploadConfirm(false);
    setCapturedMedia(null);
    setEditedMedia(null);
    setMediaType(null);
    setUploadedMedia(null);
    setIsPersistingCapture(false);
  };

  const handleCameraClick = () => {
    setShowCameraModal(true);
  };

  const handleCapture = async (file, type) => {
    setCapturedMedia(file);
    setEditedMedia(file);
    setMediaType(type);
    setShowCameraModal(false);
    setIsPersistingCapture(true);

    try {
      const savedFile = await uploadVhcMediaFile({
        file,
        jobId,
        jobNumber,
        userId,
        visibleToCustomer: true,
      });

      setUploadedMedia(savedFile);
      onUploadComplete?.(savedFile);

      if (type === "photo") {
        setShowPhotoEditor(true);
      } else {
        setShowVideoEditor(true);
      }
    } catch (error) {
      console.error("Failed to save captured VHC media:", error);
      alert(error?.message || "Failed to save captured media");
      resetFlow();
    } finally {
      setIsPersistingCapture(false);
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
      <button
        type="button"
        onClick={handleCameraClick}
        disabled={isPersistingCapture}
        style={{
          ...createVhcButtonStyle("primary"),
          padding: "8px 16px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
          ...(buttonStyle || {}),
        }}
        title="Capture VHC photo or video"
      >
        {isPersistingCapture ? "Saving..." : "Camera"}
      </button>

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
        videoFile={uploadedMedia?.file_url || capturedMedia}
        onSave={handleVideoEditorSave}
        onSkip={handleVideoEditorSkip}
        onCancel={resetFlow}
      />

      <MediaUploadConfirmModal
        isOpen={showUploadConfirm}
        mediaFile={editedMedia}
        mediaType={mediaType}
        existingFileId={uploadedMedia?.file_id || uploadedMedia?.id || null}
        jobId={jobId}
        jobNumber={jobNumber}
        userId={userId}
        onUploadComplete={handleUploadComplete}
        onCancel={resetFlow}
      />
    </>
  );
}
