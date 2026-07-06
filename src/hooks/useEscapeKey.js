// file location: src/hooks/useEscapeKey.js
//
// Small a11y helper (Phase 3.8): invoke a handler when Escape is pressed while
// active. Used by the workspace overlays (panel, shortcut hints, customise) so
// they all close on Escape consistently, matching the command palette.

import { useEffect } from "react";

export function useEscapeKey(handler, active = true) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        handler?.(event);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, active]);
}

export default useEscapeKey;
