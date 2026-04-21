// file location: src/components/dev-layout-overlay/DevLayoutOverlayRoot.js
import React from "react";
import DevLayoutOverlay from "@/components/dev-layout-overlay/DevLayoutOverlay";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

export default function DevLayoutOverlayRoot() {
  const { canAccess, hydrated } = useDevLayoutOverlay();

  if (!hydrated || !canAccess) {
    return null;
  }

  // DevLayoutOverlay now owns both the visual overlay and the unified
  // control/inspector panel. When the master toggle is off it renders just
  // the launcher, when on it renders the visual layer plus the panel.
  return <DevLayoutOverlay />;
}
