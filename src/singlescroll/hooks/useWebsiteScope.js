// file location: src/singlescroll/hooks/useWebsiteScope.js
// Adds `website-scope` to <html> while a /website page is mounted so the
// customer stylesheet (src/styles/custglobal.css) takes effect, and
// cleanly removes it on unmount so the dashboard pages aren't affected.

import { useEffect } from "react";

export default function useWebsiteScope() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const root = document.documentElement;
    root.classList.add("website-scope");
    return () => {
      root.classList.remove("website-scope");
    };
  }, []);
}
