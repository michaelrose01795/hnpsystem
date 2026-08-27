// file location: src/components/VHC/VhcCameraButton.js
// Standalone VHC capture launcher. Captures accumulate inside the capture
// screen rather than ending it: each shot lands in the tray in the bottom-left
// corner and the camera stays live. Tapping a thumbnail opens that item's
// editor over the camera; pressing Done hands the whole session over and each
// file is confirmed and uploaded in turn.

import React, { useRef, useState } from "react";
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
  // Captures handed over by Done, confirmed and uploaded one at a time.
  const [uploadQueue, setUploadQueue] = useState([]);
  // The capture currently open in an editor over the live camera, if any.
  const [trayEdit, setTrayEdit] = useState(null);
  const trayEditResolverRef = useRef(null);

  useIdleWarm([
    loadCameraCaptureModal,
    loadMediaUploadConfirmModal,
    loadPhotoEditorModal,
    loadVideoEditorModal,
  ]);

  const handleCameraClick = () => {
    setShowCameraModal(true);
  };

  // Tapping a thumbnail in the capture tray opens that item's editor without
  // closing the camera. FullScreenCapture awaits the promise: a File keeps the
  // technician's work, null leaves the capture exactly as it was.
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

  const handleBatchDone = (batch) => {
    setShowCameraModal(false);
    const items = (batch || [])
      .filter((entry) => entry?.file)
      .map((entry) => ({
        file: entry.file,
        type: entry.meta?.type === "video" ? "video" : "photo",
      }));
    setUploadQueue(items);
  };

  // Local Files are handed straight to the editor and the confirm modal so
  // trimming / captureStream() work without remote-URL CORS issues. Nothing is
  // uploaded until the technician confirms that individual file.
  const activeUpload = uploadQueue[0] || null;

  const handleUploadComplete = (fileRecord) => {
    onUploadComplete?.(fileRecord);
    setUploadQueue((current) => current.slice(1));
  };

  // Cancelling drops just this file — the rest of the session still gets its
  // turn, so one unwanted shot does not discard the others.
  const handleUploadCancel = () => {
    setUploadQueue((current) => current.slice(1));
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCameraClick}
        style={buttonStyle}
        title="Capture VHC photo or video"
      >
        Camera
      </Button>

      {showCameraModal && <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        initialMode="photo"
        batchMode
        onDone={handleBatchDone}
        onEditCapture={handleTrayEdit}
      />}

      {trayEdit?.type === "photo" && <PhotoEditorModal
        isOpen
        photoFile={trayEdit.file}
        onSave={(file) => resolveTrayEdit(file)}
        onSkip={(file) => resolveTrayEdit(file)}
        onCancel={() => resolveTrayEdit(null)}
      />}

      {trayEdit?.type === "video" && <VideoEditorModal
        isOpen
        videoFile={trayEdit.file}
        onSave={(file) => resolveTrayEdit(file)}
        onSkip={(file) => resolveTrayEdit(file)}
        onCancel={() => resolveTrayEdit(null)}
      />}

      {activeUpload && <MediaUploadConfirmModal
        isOpen
        mediaFile={activeUpload.file}
        mediaType={activeUpload.type}
        existingFileId={null}
        jobId={jobId}
        jobNumber={jobNumber}
        userId={userId}
        onUploadComplete={handleUploadComplete}
        onCancel={handleUploadCancel}
      />}
    </>
  );
}
