// file location: src/components/dev-layout-overlay/DevLayoutOverlayRoot.js
import React from "react";
import DevLayoutOverlay from "@/components/dev-layout-overlay/DevLayoutOverlay";
import DevOverlayControlPanel from "@/components/dev-layout-overlay/DevOverlayControlPanel";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

export default function DevLayoutOverlayRoot() {
  const { canAccess, hydrated, enabled } = useDevLayoutOverlay();

  if (!hydrated || !canAccess) {
    return null;
  }

  return (
    <>
      {enabled ? <DevLayoutOverlay /> : null}
      <DevOverlayControlPanel />
    </>
  );
}
