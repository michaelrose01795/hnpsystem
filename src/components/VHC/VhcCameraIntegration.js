// file location: src/components/VHC/VhcCameraIntegration.js
// Tab-aware VHC capture launcher that shares the full-screen camera flow.

import React, { useState } from "react";
import { createVhcButtonStyle } from "@/styles/appTheme";
import CameraCaptureModal from "./CameraCaptureModal";
import MediaUploadConfirmModal from "./MediaUploadConfirmModal";
import PhotoEditorModal from "./PhotoEditorModal";
import VideoEditorModal from "./VideoEditorModal";
import { uploadVhcMediaFile } from "@/lib/vhc/uploadMediaClient";

export default function VhcCameraIntegration({
  jobId,
  jobNumber,
  userId,
  activeTab,
  readOnly = false,
  onUploadComplete,
}) {
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [showVideoEditor, setShowVideoEditor] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [launchMode, setLaunchMode] = useState(null);
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
    setLaunchMode(null);
    setCapturedMedia(null);
    setEditedMedia(null);
    setMediaType(null);
    setUploadedMedia(null);
    setIsPersistingCapture(false);
  };

  const getInitialMode = () => {
    if (launchMode) return launchMode;
    if (activeTab === "videos") return "video";
    return "photo";
  };

  const handleCameraClick = (mode = null) => {
    setLaunchMode(mode);
    setShowCameraModal(true);
  };

  const handleCapture = async (file, type) => {
    setCapturedMedia(file);
    setEditedMedia(file);
    setMediaType(type);
    setShowCameraModal(false);
    setLaunchMode(null);
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

  const shouldShowButton = (activeTab === "photos" || activeTab === "videos" || !activeTab) && !readOnly;
  if (!shouldShowButton) return null;

  const renderCaptureButtons = () => {
    const commonButtonStyle = {
      padding: "var(--space-2) var(--space-md)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-1)",
      fontSize: "var(--text-body-sm)",
      minWidth: "148px",
    };

    if (activeTab === "photos") {
      return (
        <button
          type="button"
          onClick={() => handleCameraClick("photo")}
          disabled={isPersistingCapture}
          style={{ ...createVhcButtonStyle("primary"), ...commonButtonStyle }}
        >
          {isPersistingCapture ? "Saving..." : "Capture Photo"}
        </button>
      );
    }

    if (activeTab === "videos") {
      return (
        <button
          type="button"
          onClick={() => handleCameraClick("video")}
          disabled={isPersistingCapture}
          style={{ ...createVhcButtonStyle("primary"), ...commonButtonStyle }}
        >
          {isPersistingCapture ? "Saving..." : "Capture Video"}
        </button>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => handleCameraClick("photo")}
          disabled={isPersistingCapture}
          style={{ ...createVhcButtonStyle("primary"), ...commonButtonStyle }}
        >
          {isPersistingCapture ? "Saving..." : "Capture Photo"}
        </button>
        <button
          type="button"
          onClick={() => handleCameraClick("video")}
          disabled={isPersistingCapture}
          style={{ ...createVhcButtonStyle("secondary"), ...commonButtonStyle }}
        >
          {isPersistingCapture ? "Saving..." : "Capture Video"}
        </button>
      </>
    );
  };

  return (
    <>
      {renderCaptureButtons()}

      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={handleCapture}
        initialMode={getInitialMode()}
      />

      <PhotoEditorModal
        isOpen={showPhotoEditor}
        photoFile={capturedMedia}
        onSave={(file) => {
          setEditedMedia(file);
          setShowPhotoEditor(false);
          setShowUploadConfirm(true);
        }}
        onSkip={(file) => {
          setEditedMedia(file);
          setShowPhotoEditor(false);
          setShowUploadConfirm(true);
        }}
        onCancel={resetFlow}
      />

      <VideoEditorModal
        isOpen={showVideoEditor}
        videoFile={uploadedMedia?.file_url || capturedMedia}
        onSave={(file) => {
          setEditedMedia(file);
          setShowVideoEditor(false);
          setShowUploadConfirm(true);
        }}
        onSkip={(file) => {
          setEditedMedia(file);
          setShowVideoEditor(false);
          setShowUploadConfirm(true);
        }}
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
        onUploadComplete={(fileRecord) => {
          onUploadComplete?.(fileRecord);
          resetFlow();
        }}
        onCancel={resetFlow}
      />
    </>
  );
}
