// file location: src/styles/themeProvider.js
// React theme provider that maps the saved mode and accent preference into the shared semantic CSS token system.
//
// Single-writer painting model:
//  - `mode` / `accent` state always hold the USER'S TRUE preference. Nothing
//    transient is ever allowed to overwrite them.
//  - `temporaryOverride` holds a short-lived display theme (e.g. the brand-red
//    /login theme). It is purely visual and never touches `mode` / `accent`.
//  - Exactly ONE effect paints the document. It paints `temporaryOverride` when
//    set, otherwise the true preference. Because nothing else writes theme
//    tokens to the DOM, the theme can never "fight itself" mid-transition.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/database/supabaseClient";
import { useUser } from "@/context/UserContext";
import { themes } from "@/styles/theme";
import {
  ACCENT_PALETTES,
  DEFAULT_ACCENT,
  buildThemeRuntime,
  normalizeAccent,
  normalizeDbMode,
  normalizeMode,
} from "@/styles/themeRuntime";
import { trace } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed

const STORAGE_KEY = "hp-dms-theme";
const ACCENT_STORAGE_KEY = "hp-dms-accent";
const THEME_COOKIE_KEY = "hp-dms-theme";
const ACCENT_COOKIE_KEY = "hp-dms-accent";
const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_SEQUENCE = ["system", "light", "dark"];
const NETWORK_TIMEOUT_MS = 4000;
const IS_PLAYWRIGHT_AUTH = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_AUTH === "1";

// Routes that always display the brand-red login theme regardless of which
// user's preference is stored. Used so the very first paint after a hard
// navigation onto /login is already red — _document.js mirrors this server-side.
const LOGIN_THEME_ROUTES = new Set(["/login"]);
const LOGIN_THEME_OVERRIDE = { mode: "system", accent: DEFAULT_ACCENT };

const isLoginThemeRoute = () =>
  typeof window !== "undefined" && LOGIN_THEME_ROUTES.has(window.location.pathname);

const withTimeout = (promise, label, timeoutMs = NETWORK_TIMEOUT_MS) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = NETWORK_TIMEOUT_MS) => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller?.signal,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getSystemPreferredMode = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const writePreferenceCookie = (key, value) => {
  if (typeof document === "undefined") return;
  const encodedValue = encodeURIComponent(String(value || ""));
  document.cookie = `${key}=${encodedValue}; path=/; max-age=${PREFERENCE_COOKIE_MAX_AGE}; samesite=lax`;
};

const readCookieValue = (key) => {
  if (typeof document === "undefined") return null;
  const escaped = key.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const readStoredMode = () => {
  if (typeof window === "undefined") return "system";
  const local = window.localStorage.getItem(STORAGE_KEY);
  if (local === "light" || local === "dark" || local === "system") return local;
  const cookieMode = readCookieValue(THEME_COOKIE_KEY);
  return cookieMode === "light" || cookieMode === "dark" || cookieMode === "system" ? cookieMode : "system";
};

const readStoredAccent = () => {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  const local = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  if (local) return normalizeAccent(local);
  const cookieAccent = readCookieValue(ACCENT_COOKIE_KEY);
  return normalizeAccent(cookieAccent || DEFAULT_ACCENT);
};

// Pure DOM painter — the single source of truth for what is on screen. Writes
// every semantic token + shell colour for the given resolved mode + accent and
// never touches React state, so it cannot trigger or fight other effects.
const paintTheme = (resolvedMode, accentName) => {
  if (typeof document === "undefined") return;

  // Build the complete semantic token set from the sidebar-led accent model.
  const runtime = buildThemeRuntime({ resolvedMode, accentName });
  const root = document.documentElement;

  trace("theme", `paint -> ${resolvedMode} / ${accentName}`, { shell: runtime.shellBackground });

  // Apply every semantic and compatibility variable directly to the root element.
  Object.entries(runtime.legacy).forEach(([token, value]) => {
    root.style.setProperty(token, value);
  });

  // Keep the resolved-mode signals in sync for CSS / boot logic that reads them.
  root.setAttribute("data-theme", resolvedMode);
  root.style.colorScheme = resolvedMode;

  // Update html/body background so mobile overscroll areas and safe-area insets
  // show the shell colour instead of plain white/dark.
  root.style.backgroundColor = runtime.shellBackground;
  if (document.body) document.body.style.backgroundColor = runtime.shellBackground;

  // Keep mobile browser chrome (theme-color meta) matching the shell colour.
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (!themeMeta) {
    themeMeta = document.createElement("meta");
    themeMeta.setAttribute("name", "theme-color");
    document.head.appendChild(themeMeta);
  }
  themeMeta.setAttribute("content", runtime.shellBackground);
};

const ThemeContext = createContext({
  mode: "system",
  resolvedMode: "light",
  isDark: false,
  currentTheme: themes.light,
  toggleTheme: () => {},
  accent: DEFAULT_ACCENT,
  effectiveAccent: DEFAULT_ACCENT,
  setAccent: () => {},
  setTemporaryOverride: () => {},
  commitUserTheme: async () => null,
  loading: true,
});

export function ThemeProvider({ children, defaultMode = "system" }) {
  const { user, dbUserId, authUserId } = useUser() || {};
  const normalizedDefault = normalizeMode(defaultMode);

  // `mode` / `accent` always hold the user's TRUE preference — never an override.
  const [mode, setMode] = useState(() => {
    if (typeof document !== "undefined") {
      const docMode = document.documentElement.getAttribute("data-theme");
      if (docMode === "dark" || docMode === "light") {
        const storedMode = readStoredMode();
        return storedMode === "system" ? "system" : docMode;
      }
    }
    const storedMode = readStoredMode();
    return storedMode === "light" || storedMode === "dark" || storedMode === "system"
      ? storedMode
      : normalizedDefault;
  });
  const [accent, setAccent] = useState(() => readStoredAccent());

  // Concrete light/dark resolution of the OS preference — the only "resolved"
  // value kept in state; everything else is derived from it each render.
  const [systemMode, setSystemMode] = useState(() => getSystemPreferredMode());

  const [loading, setLoading] = useState(true);

  // Transient display theme. Initialised to the red login theme when the app
  // first paints on /login so there is no flash before the login page mounts.
  const [temporaryOverride, setTemporaryOverride] = useState(() =>
    isLoginThemeRoute() ? LOGIN_THEME_OVERRIDE : null
  );

  // Resolved mode of the true preference.
  const resolvedMode = mode === "system" ? systemMode : normalizeMode(mode);

  // What the painter should actually show right now: the override when present,
  // otherwise the true preference.
  let paintMode = resolvedMode;
  let paintAccent = accent;
  if (temporaryOverride) {
    const overrideMode = normalizeMode(temporaryOverride.mode || mode);
    paintMode = overrideMode === "system" ? systemMode : overrideMode;
    paintAccent = normalizeAccent(temporaryOverride.accent || accent);
  }

  // THE single paint pass. Nothing else writes theme tokens to the document, so
  // a transition can only ever produce one repaint into one final theme.
  useEffect(() => {
    paintTheme(paintMode, paintAccent);
  }, [paintMode, paintAccent]);

  // Track the OS colour-scheme so `system` mode stays correct.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => setSystemMode(event.matches ? "dark" : "light");
    setSystemMode(media.matches ? "dark" : "light");
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const persistPreference = useCallback(
    async (nextMode) => {
      if (!dbUserId) return;
      try {
        const query = new URLSearchParams();
        if (process.env.NODE_ENV !== "production") {
          query.set("userId", String(dbUserId));
        }
        const response = await fetchWithTimeout(
          `/api/profile/theme-preferences${query.toString() ? `?${query.toString()}` : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ mode: normalizeMode(nextMode) }),
          }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Theme preference save failed (${response.status})`);
        }
      } catch (error) {
        console.error("Failed to save theme preference", error?.message || error);
      }
    },
    [dbUserId]
  );

  const persistAccentPreference = useCallback(
    async (nextAccent) => {
      if (!dbUserId) return;
      try {
        const query = new URLSearchParams();
        if (process.env.NODE_ENV !== "production") {
          query.set("userId", String(dbUserId));
        }
        const response = await fetchWithTimeout(
          `/api/profile/theme-preferences${query.toString() ? `?${query.toString()}` : ""}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ accent: normalizeAccent(nextAccent) }),
          }
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Accent preference save failed (${response.status})`);
        }
      } catch (error) {
        console.error("Failed to save accent preference", error?.message || error);
      }
    },
    [dbUserId]
  );

  // Load the signed-in user's saved preference into state. STATE-ONLY — the
  // paint effect picks it up. It never paints directly, so it cannot fight an
  // active override (e.g. the red /login theme during a login redirect).
  useEffect(() => {
    let cancelled = false;

    const writePreferenceState = (modeValue, accentValue) => {
      const nextMode = normalizeDbMode(modeValue);
      const nextAccent =
        typeof accentValue === "string" && accentValue.length > 0
          ? normalizeAccent(accentValue)
          : DEFAULT_ACCENT;
      setMode(nextMode);
      setAccent(nextAccent);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, nextMode);
        window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      }
      writePreferenceCookie(THEME_COOKIE_KEY, nextMode);
      writePreferenceCookie(ACCENT_COOKIE_KEY, nextAccent);
    };

    const applyLocalPreference = () => {
      const storedMode = readStoredMode();
      const nextMode =
        storedMode === "light" || storedMode === "dark" || storedMode === "system"
          ? storedMode
          : normalizedDefault;
      writePreferenceState(nextMode, readStoredAccent());
    };

    const fetchPreference = async () => {
      const numericUserId =
        Number.isInteger(Number(dbUserId)) && Number(dbUserId) > 0
          ? Number(dbUserId)
          : Number.isInteger(Number(user?.id)) && Number(user?.id) > 0
          ? Number(user.id)
          : null;

      if (!user && !numericUserId && !authUserId) {
        applyLocalPreference();
        setLoading(false);
        return;
      }
      if (IS_PLAYWRIGHT_AUTH) {
        applyLocalPreference();
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let data = null;

        if (numericUserId) {
          try {
            const { data: fullData, error: fullError } = await withTimeout(
              supabaseClient
                .from("users")
                .select("dark_mode, accent_color")
                .eq("user_id", numericUserId)
                .maybeSingle(),
              "Theme preference Supabase load"
            );
            if (fullError) throw fullError;
            data = fullData;
          } catch (fullErr) {
            try {
              const { data: fallbackData, error: fallbackError } = await withTimeout(
                supabaseClient
                  .from("users")
                  .select("dark_mode")
                  .eq("user_id", numericUserId)
                  .maybeSingle(),
                "Theme preference fallback Supabase load"
              );
              if (fallbackError) throw fallbackError;
              data = fallbackData;
            } catch (fallbackErr) {
              data = null;
              console.warn("Theme DB preference unavailable, using local preference", fallbackErr?.message || fallbackErr);
            }
            console.warn("Accent DB column unavailable, using local accent preference", fullErr?.message || fullErr);
          }
        } else if (authUserId) {
          const response = await fetchWithTimeout("/api/profile/me", {
            method: "GET",
            credentials: "include",
          });
          if (!response.ok) {
            throw new Error(`Profile preference load failed (${response.status})`);
          }
          const payload = await response.json().catch(() => null);
          data = payload?.data?.profile || payload?.profile || null;
        }

        if (!cancelled && data) {
          writePreferenceState(data.dark_mode ?? data.themeMode, data.accent_color ?? data.accentColor);
        } else if (!cancelled) {
          applyLocalPreference();
        }
      } catch (err) {
        console.warn("Failed to load theme preference; using local preference", err.message || err);
        if (!cancelled) {
          applyLocalPreference();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPreference();
    return () => {
      cancelled = true;
    };
  }, [user, dbUserId, authUserId, normalizedDefault]);

  const toggleTheme = useCallback(() => {
    const currentIndex = THEME_SEQUENCE.indexOf(mode);
    const nextMode = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
    setMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
    }
    writePreferenceCookie(THEME_COOKIE_KEY, nextMode);
    persistPreference(nextMode);
  }, [mode, persistPreference]);

  const setAccentPreference = useCallback(
    (nextAccent) => {
      const normalizedAccent = normalizeAccent(nextAccent);
      setAccent(normalizedAccent);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACCENT_STORAGE_KEY, normalizedAccent);
      }
      writePreferenceCookie(ACCENT_COOKIE_KEY, normalizedAccent);
      persistAccentPreference(normalizedAccent);
    },
    [persistAccentPreference]
  );

  // Resolve a specific user's saved theme. Used at the login → app boundary so
  // the destination theme is known before the navigation completes.
  const resolveUserThemePreference = useCallback(async (userId) => {
    const numericUserId =
      Number.isInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null;

    if (numericUserId) {
      try {
        const { data, error } = await withTimeout(
          supabaseClient
            .from("users")
            .select("dark_mode, accent_color")
            .eq("user_id", numericUserId)
            .maybeSingle(),
          "Theme preference commit load"
        );
        if (error) throw error;
        if (data) return { mode: data.dark_mode, accent: data.accent_color };
      } catch (fullErr) {
        try {
          const { data, error } = await withTimeout(
            supabaseClient
              .from("users")
              .select("dark_mode")
              .eq("user_id", numericUserId)
              .maybeSingle(),
            "Theme preference commit fallback load"
          );
          if (error) throw error;
          if (data) return { mode: data.dark_mode, accent: null };
        } catch (fallbackErr) {
          console.warn("Theme commit DB load failed", fallbackErr?.message || fallbackErr);
        }
        console.warn("Theme commit accent column unavailable", fullErr?.message || fullErr);
      }
      return null;
    }

    // No numeric id available — fall back to the session-scoped profile endpoint.
    try {
      const response = await fetchWithTimeout("/api/profile/me", {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) return null;
      const payload = await response.json().catch(() => null);
      const profile = payload?.data?.profile || payload?.profile || null;
      if (!profile) return null;
      return {
        mode: profile.dark_mode ?? profile.themeMode,
        accent: profile.accent_color ?? profile.accentColor,
      };
    } catch (err) {
      console.warn("Theme commit profile load failed", err?.message || err);
      return null;
    }
  }, []);

  // Atomically: store the real preference, release any override, and let the
  // single paint pass repaint exactly once into the final theme.
  const commitTheme = useCallback(({ mode: nextModeRaw, accent: nextAccentRaw }) => {
    const nextMode = normalizeDbMode(nextModeRaw);
    const nextAccent =
      typeof nextAccentRaw === "string" && nextAccentRaw.length > 0
        ? normalizeAccent(nextAccentRaw)
        : DEFAULT_ACCENT;
    trace("theme", `commitTheme -> ${nextMode} / ${nextAccent} (override cleared)`);
    setMode(nextMode);
    setAccent(nextAccent);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextMode);
      window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
    }
    writePreferenceCookie(THEME_COOKIE_KEY, nextMode);
    writePreferenceCookie(ACCENT_COOKIE_KEY, nextAccent);
    setTemporaryOverride(null);
    return { mode: nextMode, accent: nextAccent };
  }, []);

  // Resolve a user's saved theme and commit it. Called during the login loading
  // screen so the colour changes once, mid-transition, then stays put. Returns
  // null (committing nothing) if the preference cannot be resolved — the normal
  // fetchPreference pass then settles the theme on the destination page.
  const commitUserTheme = useCallback(
    async (userId) => {
      trace("theme", "commitUserTheme: resolving preference", { userId: userId ?? null });
      const preference = await resolveUserThemePreference(userId);
      trace("theme", "commitUserTheme: resolved", preference);
      if (!preference) return null;
      return commitTheme(preference);
    },
    [resolveUserThemePreference, commitTheme]
  );

  const contextValue = useMemo(
    () => ({
      mode,
      resolvedMode: paintMode,
      isDark: paintMode === "dark",
      currentTheme: themes[paintMode] || themes.light,
      toggleTheme,
      // `accent` is the user's TRUE saved preference (for theme controls).
      // `effectiveAccent` is what is actually painted right now — it follows a
      // temporary override (e.g. the red /login theme), so UI that must match
      // the on-screen colour (the brand logo) should read this one.
      accent,
      effectiveAccent: paintAccent,
      setAccent: setAccentPreference,
      setTemporaryOverride,
      commitUserTheme,
      loading,
    }),
    [mode, paintMode, paintAccent, toggleTheme, accent, setAccentPreference, setTemporaryOverride, commitUserTheme, loading]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export { ACCENT_PALETTES };

export default ThemeProvider;
