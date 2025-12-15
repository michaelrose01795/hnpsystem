// file location: src/components/VHC/VhcCameraButton.js
import React, { useState } from "react";
import { createVhcButtonStyle } from "@/styles/appTheme";
import CameraCaptureModal from "./CameraCaptureModal";
import PhotoEditorModal from "./PhotoEditorModal";
import VideoEditorModal from "./VideoEditorModal";
import MediaUploadConfirmModal from "./MediaUploadConfirmModal";

/**
 * VHC Camera Button Component
 *
 * Provides a standalone camera button for the VHC section header.
 * Handles the full flow: Camera Capture → Editing → Upload
 *
 * Usage:
 * <VhcCameraButton
 *   jobNumber={jobNumber}
 *   userId={user.id}
 *   onUploadComplete={() => refreshJobData()}
 * />
 */
export default function VhcCameraButton({
  jobNumber,
  userId,
  onUploadComplete,
}) {
  // Modal states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);

  // Media states
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [editedMedia, setEditedMedia] = useState(null);

  // Handle camera button click
  const handleCameraClick = () => {
    setShowCameraModal(true);
  };

  // Handle capture from camera
  const handleCapture = (file, type) => {
    setCapturedMedia(file);
    setMediaType(type);
    setShowCameraModal(false);

    // Open appropriate editor
    if (type === "photo") {
      setShowPhotoEditor(true);
    } else if (type === "video") {
      setShowVideoEditor(true);
    }
  };

  // Handle photo editor save
  const handlePhotoEditorSave = (editedFile) => {
    setEditedMedia(editedFile);
    setShowPhotoEditor(false);
    setShowUploadConfirm(true);
  };

  // Handle photo editor cancel
  const handlePhotoEditorCancel = () => {
    setShowPhotoEditor(false);
    setCapturedMedia(null);
    setMediaType(null);
  };

  // Handle video editor save
  const handleVideoEditorSave = (editedFile) => {
    setEditedMedia(editedFile);
    setShowVideoEditor(false);
    setShowUploadConfirm(true);
  };

  // Handle video editor cancel
  const handleVideoEditorCancel = () => {
    setShowVideoEditor(false);
    setCapturedMedia(null);
    setMediaType(null);
  };

  // Handle upload complete
  const handleUploadComplete = (uploadedFile) => {
    console.log("✅ Upload complete:", uploadedFile);
    setShowUploadConfirm(false);

    // Reset all states
    setCapturedMedia(null);
    setEditedMedia(null);
    setMediaType(null);

    // Notify parent to refresh
    if (onUploadComplete) {
      onUploadComplete(uploadedFile);
    }
  };

  // Handle upload cancel
  const handleUploadCancel = () => {
    setShowUploadConfirm(false);
    setCapturedMedia(null);
    setEditedMedia(null);
    setMediaType(null);
  };

  // Handle camera modal close
  const handleCameraClose = () => {
    setShowCameraModal(false);
    setCapturedMedia(null);
    setMediaType(null);
  };

  return (
    <>
      {/* Camera Button */}
      <button
        onClick={handleCameraClick}
        style={{
          ...createVhcButtonStyle("primary"),
          padding: "8px 16px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13px",
        }}
        title="Capture photo or video for VHC"
      >
        📷 Camera
      </button>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={handleCameraClose}
        onCapture={handleCapture}
        initialMode="photo"
      />

      {/* Photo Editor Modal */}
      <PhotoEditorModal
        isOpen={showPhotoEditor}
        photoFile={capturedMedia}
        onSave={handlePhotoEditorSave}
        onCancel={handlePhotoEditorCancel}
      />

      {/* Video Editor Modal */}
      <VideoEditorModal
        isOpen={showVideoEditor}
        videoFile={capturedMedia}
        onSave={handleVideoEditorSave}
        onCancel={handleVideoEditorCancel}
      />

      {/* Media Upload Confirm Modal */}
      <MediaUploadConfirmModal
        isOpen={showUploadConfirm}
        mediaFile={editedMedia}
        mediaType={mediaType}
        jobNumber={jobNumber}
        userId={userId}
        onUploadComplete={handleUploadComplete}
        onCancel={handleUploadCancel}
      />
    </>
  );
}
