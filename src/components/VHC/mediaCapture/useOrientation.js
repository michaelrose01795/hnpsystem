// file location: src/components/VHC/mediaCapture/useOrientation.js
// React hook that detects device orientation and provides landscape-only mode enforcement.
// Listens to orientationchange and resize events to track orientation state across different devices.

import { useCallback, useEffect, useState } from "react";

// Determine if device is in landscape mode.
// Uses multiple detection methods for maximum compatibility:
// 1. window.innerWidth > window.innerHeight (most reliable)
// 2. window.orientation API (legacy, some browsers)
// 3. screen.orientation API (modern browsers)
function isLandscapeMode() {
  // Primary method: width > height
  if (typeof window !== "undefined") {
    if (window.innerWidth > window.innerHeight) {
      return true;
    }
  }

  // Fallback: window.orientation (0 or 360 = portrait, 90 or -90 = landscape)
  if (typeof window !== "undefined" && window.orientation !== undefined) {
    const angle = Math.abs(window.orientation);
    return angle === 90 || angle === 270;
  }

  // Fallback: screen.orientation.type
  if (typeof screen !== "undefined" && screen.orientation) {
    return screen.orientation.type.includes("landscape");
  }

  return false;
}

export default function useOrientation() {
  const [isLandscape, setIsLandscape] = useState(() => isLandscapeMode());
  const [screenWidth, setScreenWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );
  const [screenHeight, setScreenHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 0
  );

  // Update orientation when window resizes or orientation changes
  const updateOrientation = useCallback(() => {
    setIsLandscape(isLandscapeMode());
    if (typeof window !== "undefined") {
      setScreenWidth(window.innerWidth);
      setScreenHeight(window.innerHeight);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Listen to multiple events for better cross-device support
    window.addEventListener("orientationchange", updateOrientation);
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("fullscreenchange", updateOrientation);

    return () => {
      window.removeEventListener("orientationchange", updateOrientation);
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("fullscreenchange", updateOrientation);
    };
  }, [updateOrientation]);

  return {
    isLandscape, // true = landscape, false = portrait
    screenWidth, // current window width in px
    screenHeight, // current window height in px
    aspectRatio: screenWidth / (screenHeight || 1), // w/h ratio for layout decisions
  };
}
