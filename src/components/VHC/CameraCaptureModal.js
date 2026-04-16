// file location: src/components/VHC/CameraCaptureModal.js
// Thin compatibility wrapper over the new FullScreenCapture component.
// Older call sites (VhcCameraButton, VhcCameraIntegration) import this
// file by name and pass `{ isOpen, onClose, onCapture, initialMode }`.
// We keep that signature stable and simply forward into the new
// full-screen implementation so the whole app gets the richer UI
// without changing any of the existing launchers.

import React from "react"; // React primitive (only needed for JSX here)
import FullScreenCapture from "./mediaCapture/FullScreenCapture"; // New full-screen implementation

export default function CameraCaptureModal({ isOpen, onClose, onCapture, initialMode = "photo" }) {
  // Forward the simple capture callback. The new component emits a
  // second argument with additional metadata; we strip it here so the
  // legacy onCapture(file, type) signature still works everywhere.
  const handleCapture = (file, meta) => {
    const type = meta?.type || (initialMode === "video" ? "video" : "photo"); // Derive type for callers
    onCapture?.(file, type); // Call the original onCapture contract
  };

  return (
    <FullScreenCapture
      isOpen={isOpen} // Control open state
      onClose={onClose} // User-initiated close
      onCapture={handleCapture} // File + type hand-off
      initialMode={initialMode} // Photo or video default
      allowModeSwitch // Allow users to toggle mode within the capture screen
      panel={null} // No concern panel in the plain capture path
      panelInitiallyOpen={false} // Irrelevant without a panel
      title="" // Minimal chrome — no floating title text
    />
  );
}
