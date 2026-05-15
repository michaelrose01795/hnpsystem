// file location: src/singlescroll/hooks/useWebsiteTheme.js
// Drives the /website colour theme while any marketing page is mounted, so
// the light/dark choice is consistent across EVERY /website route — not
// just the profile page that owns the toggle.
//
// Resolution priority:
//   1. The explicit /website theme choice — persisted to localStorage under
//      `hnp-website-theme` by the profile / dev page theme cycles, and
//      therefore shared by every /website page.
//   2. For a logged-in visitor with no explicit /website choice, the colour
//      mode they picked for their HNPSystem account (themeProvider `mode`).
//   3. Otherwise the dark cinematic marketing default.
//
// The resolved mode is applied two ways: `setTemporaryOverride` swings the
// underlying semantic tokens, and `data-website-theme` on <html> gates the
// custglobal.css light overrides. Both unwind on unmount.

import { useEffect } from "react";
import { useTheme } from "@/styles/themeProvider";
import { useUser } from "@/context/UserContext";

// Shared key — must match WEBSITE_THEME_KEY in the profile / dev pages.
const WEBSITE_THEME_KEY = "hnp-website-theme";

// Resolve a "system" preference into a concrete light/dark value.
const resolveSystemMode = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

// Map a stored preference ("light" | "dark" | "system") to light/dark, or
// null when nothing valid is stored.
const resolveWebsiteTheme = (preference) => {
  if (preference === "light" || preference === "dark") return preference;
  if (preference === "system") return resolveSystemMode();
  return null;
};

export default function useWebsiteTheme() {
  const { setTemporaryOverride, mode } = useTheme();
  const { user } = useUser() || {};
  const isLoggedIn = Boolean(user);

  useEffect(() => {
    // 1. Explicit /website choice (shared across every /website page).
    let websiteMode = null;
    if (typeof window !== "undefined") {
      websiteMode = resolveWebsiteTheme(window.localStorage.getItem(WEBSITE_THEME_KEY));
    }
    // 2. Logged-in account colour mode, when no explicit /website choice.
    if (!websiteMode && isLoggedIn) {
      websiteMode = mode === "system" ? resolveSystemMode() : mode === "light" ? "light" : "dark";
    }
    // 3. Dark marketing default.
    if (!websiteMode) websiteMode = "dark";

    // Underlying semantic tokens — keep the brand-red accent in both modes.
    setTemporaryOverride({ mode: websiteMode, accent: "red" });
    // custglobal.css light overrides are gated on data-website-theme="light".
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-website-theme", websiteMode);
    }

    return () => {
      setTemporaryOverride(null);
      if (typeof document !== "undefined") {
        document.documentElement.removeAttribute("data-website-theme");
      }
    };
  }, [setTemporaryOverride, isLoggedIn, mode]);
}
