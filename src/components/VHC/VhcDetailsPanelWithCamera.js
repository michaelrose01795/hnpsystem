// file location: src/components/VHC/VhcDetailsPanelWithCamera.js
import React, { useState, useCallback } from "react";
import VhcDetailsPanel from "./VhcDetailsPanel";
import VhcCameraIntegration from "./VhcCameraIntegration";

/**
 * Wrapper for VhcDetailsPanel that adds camera functionality
 *
 * This component wraps VhcDetailsPanel and injects camera capture buttons
 * into the customActions based on the active tab.
 *
 * Usage:
 * <VhcDetailsPanelWithCamera
 *   jobNumber={jobNumber}
 *   userId={user.id}
 *   showNavigation={false}
 *   customActions={existingCustomActions}
 *   onJobDataRefresh={() => refreshJobData()}
 * />
 */
export default function VhcDetailsPanelWithCamera({
  jobNumber,
  userId,
  showNavigation = true,
  readOnly = false,
  customActions = null,
  onJobDataRefresh,
  ...rest
}) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Handle upload complete
  const handleUploadComplete = useCallback((uploadedFile) => {
    console.log("📷 Camera upload complete, refreshing job data...", uploadedFile);

    // Trigger internal refresh by incrementing key
    setRefreshTrigger(prev => prev + 1);

    // Notify parent if callback provided
    if (onJobDataRefresh) {
      onJobDataRefresh(uploadedFile);
    }
  }, [onJobDataRefresh]);

  // Combine custom actions with camera integration
  // The camera integration component will handle its own visibility based on activeTab
  const combinedCustomActions = (
    <>
      {/* Existing custom actions (e.g., Customer View, Copy Link) */}
      {customActions}

      {/* Camera integration - will auto-show on photos/videos tab */}
      <VhcCameraIntegration
        jobNumber={jobNumber}
        userId={userId}
        activeTab={undefined} // VhcDetailsPanel will manage this internally
        readOnly={readOnly}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );

  return (
    <VhcDetailsPanel
      key={refreshTrigger} // Force re-render on upload to refresh file list
      jobNumber={jobNumber}
      showNavigation={showNavigation}
      readOnly={readOnly}
      customActions={combinedCustomActions}
      {...rest}
    />
  );
}
