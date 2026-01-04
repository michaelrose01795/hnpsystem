// file location: src/components/VHC/VhcCameraIntegration.js
import React, { useState } from "react";
import { createVhcButtonStyle } from "@/styles/appTheme";
import CameraCaptureModal from "./CameraCaptureModal";
import PhotoEditorModal from "./PhotoEditorModal";
import VideoEditorModal from "./VideoEditorModal";
import MediaUploadConfirmModal from "./MediaUploadConfirmModal";

/**
 * VHC Camera Integration Component
 *
 * Provides a camera button and handles the full flow:
 * 1. Camera Capture (photo or video)
 * 2. Editing (photo annotations or video trim/mute)
 * 3. Upload Confirmation (with customer visibility toggle)
 * 4. Upload to server
 *
 * Usage:
 * <VhcCameraIntegration
 *   jobNumber={job.job_number}
 *   userId={user.id}
 *   activeTab={activeTab}
 *   readOnly={readOnly}
 *   onUploadComplete={() => refreshJobData()}
 * />
 */
export default function VhcCameraIntegration({
  jobNumber,
  userId,
  activeTab,
  readOnly = false,
  onUploadComplete,
}) {
  // Modal states
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [launchMode, setLaunchMode] = useState(null);

  // Media states
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [editedMedia, setEditedMedia] = useState(null);

  // Determine initial mode based on active tab
  const getInitialMode = () => {
    if (launchMode) return launchMode;
    if (activeTab === "photos") return "photo";
    if (activeTab === "videos") return "video";
    return "photo"; // default
  };

  // Handle camera button click
  const handleCameraClick = (mode = null) => {
    setLaunchMode(mode);
    setShowCameraModal(true);
  };

  // Handle capture from camera
  const handleCapture = (file, type) => {
    setLaunchMode(null);
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
    setLaunchMode(null);

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
    setLaunchMode(null);
  };

  // Handle camera modal close
  const handleCameraClose = () => {
    setShowCameraModal(false);
    setCapturedMedia(null);
    setMediaType(null);
    setLaunchMode(null);
  };

  // Only show button on photos or videos tab and when not in read-only mode
  const shouldShowButton = (activeTab === "photos" || activeTab === "videos" || !activeTab) && !readOnly;

  if (!shouldShowButton) {
    return null;
  }

  const renderCaptureButtons = () => {
    if (activeTab === "photos") {
      return (
        <button
          onClick={() => handleCameraClick("photo")}
          style={{
            ...createVhcButtonStyle("primary"),
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
          }}
        >
          📷 Capture Photo
        </button>
      );
    }
    if (activeTab === "videos") {
      return (
        <button
          onClick={() => handleCameraClick("video")}
          style={{
            ...createVhcButtonStyle("primary"),
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
          }}
        >
          🎥 Capture Video
        </button>
      );
    }
    return (
      <>
        <button
          onClick={() => handleCameraClick("photo")}
          style={{
            ...createVhcButtonStyle("primary"),
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
          }}
        >
          📷 Capture Photo
        </button>
        <button
          onClick={() => handleCameraClick("video")}
          style={{
            ...createVhcButtonStyle("secondary"),
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "14px",
          }}
        >
          🎥 Capture Video
        </button>
      </>
    );
  };

  return (
    <>
      {renderCaptureButtons()}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={handleCameraClose}
        onCapture={handleCapture}
        initialMode={getInitialMode()}
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
