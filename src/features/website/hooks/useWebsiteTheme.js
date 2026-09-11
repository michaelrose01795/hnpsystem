// file location: src/features/website/hooks/useWebsiteTheme.js
// Pins the /website colour theme to LIGHT while any marketing page is mounted,
// so the light look is consistent across EVERY /website route.
//
// The customer site is light-only (2026-09-11)
// --------------------------------------------
// This hook used to resolve a mode from three sources — the `hnp-website-theme`
// localStorage choice, then the logged-in visitor's HNPSystem colour mode, then
// the staff-chosen `website_design.default_theme`. None of those are readable
// on the server or before hydration, so the page always painted on custglobal's
// dark baseline first and flicked to light once this effect ran. The site now
// has one answer, which `_document.js` paints before first paint as well (see
// isLightOnlyWebsitePath there) — the two must stay in step.
//
// The resolved mode is applied two ways: `setTemporaryOverride` swings the
// underlying semantic tokens, and `data-website-theme` on <html> gates the
// custglobal.css light overrides. Both unwind on unmount.

import { useEffect } from "react";
import { useTheme } from "@/styles/themeProvider";

// The one mode the customer site renders in.
const WEBSITE_MODE = "light";

export default function useWebsiteTheme() {
  const { setTemporaryOverride } = useTheme();

  useEffect(() => {
    // Underlying semantic tokens — brand-red accent, light surfaces.
    setTemporaryOverride({ mode: WEBSITE_MODE, accent: "red" });
    // custglobal.css light overrides are gated on data-website-theme="light".
    // Already set by the _document boot script on a hard load; set again here
    // so a client-side navigation onto a /website route lands the same way.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-website-theme", WEBSITE_MODE);
    }

    return () => {
      setTemporaryOverride(null);
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-website-theme");
      }
    };
  }, [setTemporaryOverride]);
}
