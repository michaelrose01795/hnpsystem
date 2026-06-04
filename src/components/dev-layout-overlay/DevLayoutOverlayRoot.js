// file location: src/components/dev-layout-overlay/DevLayoutOverlayRoot.js
import React from "react";
import DevLayoutOverlay from "@/components/dev-layout-overlay/DevLayoutOverlay";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";

export default function DevLayoutOverlayRoot() {
  const { canAccess, hydrated } = useDevLayoutOverlay();

  if (!hydrated || !canAccess) {
    return null;
  }

  // DevLayoutOverlay owns the visual overlay and its controls. When the master
  // toggle is off it renders just the launcher; when on it renders the visual
  // layer plus the controls panel.
  return <DevLayoutOverlay />;
}
