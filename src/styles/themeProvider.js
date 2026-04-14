// file location: src/styles/themeProvider.js
// React theme provider that maps the saved mode and accent preference into the shared semantic CSS token system.

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

const STORAGE_KEY = "hp-dms-theme";
const ACCENT_STORAGE_KEY = "hp-dms-accent";
const THEME_COOKIE_KEY = "hp-dms-theme";
const ACCENT_COOKIE_KEY = "hp-dms-accent";
const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_SEQUENCE = ["system", "light", "dark"];
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

const ThemeContext = createContext({
  mode: "system",
  resolvedMode: "light",
  isDark: false,
  currentTheme: themes.light,
  toggleTheme: () => {},
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
  setTemporaryOverride: () => {},
  loading: true,
});

export function ThemeProvider({ children, defaultMode = "system" }) {
  const { user, dbUserId, authUserId } = useUser() || {};
  const normalizedDefault = normalizeMode(defaultMode);
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
  const [resolvedMode, setResolvedMode] = useState(() => {
    if (typeof document !== "undefined") {
      const docMode = document.documentElement.getAttribute("data-theme");
      if (docMode === "dark" || docMode === "light") return docMode;
    }
    const storedMode = readStoredMode();
    const initialMode =
      storedMode === "light" || storedMode === "dark" || storedMode === "system"
        ? storedMode
        : normalizedDefault;
    return initialMode === "system" ? getSystemPreferredMode() : initialMode;
  });
  const [accent, setAccent] = useState(() => readStoredAccent());
  const [loading, setLoading] = useState(true);
  const [temporaryOverride, setTemporaryOverride] = useState(null);

  const applyAccent = useCallback((nextAccent, modeOverride = null) => {
    // Normalise the requested accent so only supported palettes are applied.
    const normalizedAccent = normalizeAccent(nextAccent);

    // Resolve the current colour mode so the runtime helper can derive the right light/dark tokens.
    const resolved =
      modeOverride ||
      (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null) ||
      "light";

    // Build the complete semantic token set from the sidebar-led accent model.
    const runtime = buildThemeRuntime({ resolvedMode: resolved, accentName: normalizedAccent });

    if (typeof document !== "undefined") {
      // Apply every semantic and compatibility variable directly to the root element.
      Object.entries(runtime.legacy).forEach(([token, value]) => {
        document.documentElement.style.setProperty(token, value);
      });

      // Update html/body background to accent layer so mobile browser overscroll
      // areas and safe-area insets show the accent colour instead of plain white/dark.
      document.documentElement.style.backgroundColor = runtime.shellBackground;
      if (document.body) document.body.style.backgroundColor = runtime.shellBackground;
      // Update theme-color meta so mobile browser chrome matches
      let themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement("meta");
        themeMeta.setAttribute("name", "theme-color");
        document.head.appendChild(themeMeta);
      }
      themeMeta.setAttribute("content", runtime.shellBackground);
    }
    setAccent(normalizedAccent);
    return normalizedAccent;
  }, []);

  const applyMode = useCallback((nextMode) => {
    const requested = normalizeMode(nextMode);
    const resolved = requested === "system" ? getSystemPreferredMode() : requested;
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    setMode(requested);
    setResolvedMode(resolved);
    return { requested, resolved };
  }, []);

  useEffect(() => {
    const storedMode = readStoredMode();
    const storedAccent = readStoredAccent();
    const initial =
      storedMode === "light" || storedMode === "dark" || storedMode === "system" ? storedMode : normalizedDefault;
    const { resolved } = applyMode(initial);
    applyAccent(storedAccent, resolved);
    writePreferenceCookie(THEME_COOKIE_KEY, initial);
    writePreferenceCookie(ACCENT_COOKIE_KEY, storedAccent);
  }, [applyAccent, applyMode, normalizedDefault]);

  useEffect(() => {
    applyAccent(accent, resolvedMode);
  }, [accent, applyAccent, resolvedMode]);

  useEffect(() => {
    if (!temporaryOverride) {
      const targetMode = mode === "system" ? getSystemPreferredMode() : mode;
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", targetMode);
      }
      setResolvedMode(targetMode);
      applyAccent(accent, targetMode);
      return;
    }

    const overrideMode = normalizeMode(temporaryOverride.mode || mode);
    const overrideResolved = overrideMode === "system" ? getSystemPreferredMode() : overrideMode;
    const overrideAccent = normalizeAccent(temporaryOverride.accent || accent);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", overrideResolved);
    }
    setResolvedMode(overrideResolved);
    applyAccent(overrideAccent, overrideResolved);
  }, [temporaryOverride, mode, accent, applyAccent]);

  useEffect(() => {
    if (mode !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => {
      const nextResolved = event.matches ? "dark" : "light";
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", nextResolved);
      }
      setResolvedMode(nextResolved);
      applyAccent(accent, nextResolved);
    };

    const supportsAddEventListener = typeof media.addEventListener === "function";
    const supportsRemoveEventListener = typeof media.removeEventListener === "function";

    if (supportsAddEventListener) {
      media.addEventListener("change", handleChange);
    } else {
      media.addListener(handleChange);
    }
    return () => {
      if (supportsRemoveEventListener) {
        media.removeEventListener("change", handleChange);
      } else {
        media.removeListener(handleChange);
      }
    };
  }, [accent, applyAccent, mode]);

  useEffect(() => {
    let cancelled = false;

    const applyPreferencePayload = (payload = {}) => {
      const preference = normalizeDbMode(payload.dark_mode ?? payload.themeMode);
      const { resolved } = applyMode(preference);
      const nextAccent =
        typeof (payload.accent_color ?? payload.accentColor) === "string" &&
        (payload.accent_color ?? payload.accentColor).length > 0
          ? normalizeAccent(payload.accent_color ?? payload.accentColor)
          : DEFAULT_ACCENT;
      applyAccent(nextAccent, resolved);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, preference);
        window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
      }
      writePreferenceCookie(THEME_COOKIE_KEY, preference);
      writePreferenceCookie(ACCENT_COOKIE_KEY, nextAccent);
    };

    const fetchPreference = async () => {
      const numericUserId =
        Number.isInteger(Number(dbUserId)) && Number(dbUserId) > 0
          ? Number(dbUserId)
          : Number.isInteger(Number(user?.id)) && Number(user?.id) > 0
            ? Number(user.id)
            : null;

      if (!user && !numericUserId && !authUserId) {
        const storedMode = readStoredMode();
        const storedAccent = readStoredAccent();
        const nextMode =
          storedMode === "light" || storedMode === "dark" || storedMode === "system"
            ? storedMode
            : normalizedDefault;
        const { resolved } = applyMode(nextMode);
        applyAccent(storedAccent, resolved);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let data = null;

        if (numericUserId) {
          try {
            const { data: fullData, error: fullError } = await supabaseClient
              .from("users")
              .select("dark_mode, accent_color")
              .eq("user_id", numericUserId)
              .maybeSingle();
            if (fullError) throw fullError;
            data = fullData;
          } catch (fullErr) {
            const { data: fallbackData, error: fallbackError } = await supabaseClient
              .from("users")
              .select("dark_mode")
              .eq("user_id", numericUserId)
              .maybeSingle();
            if (fallbackError) throw fallbackError;
            data = fallbackData;
            console.warn("Accent DB column unavailable, using local accent preference", fullErr?.message || fullErr);
          }
        } else if (authUserId) {
          const response = await fetch("/api/profile/me", {
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
          applyPreferencePayload(data);
        }
      } catch (err) {
        console.error("Failed to load theme preference", err.message || err);
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
  }, [user, dbUserId, authUserId, applyAccent, applyMode, normalizedDefault]);

  const persistPreference = useCallback(
    async (nextMode) => {
      if (!dbUserId) return;
      try {
        const query = new URLSearchParams();
        if (process.env.NODE_ENV !== "production") {
          query.set("userId", String(dbUserId));
        }
        const response = await fetch(
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
        const response = await fetch(
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

  const toggleTheme = useCallback(() => {
    const currentIndex = THEME_SEQUENCE.indexOf(mode);
    const nextMode = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
    const { requested } = applyMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, requested);
    }
    writePreferenceCookie(THEME_COOKIE_KEY, requested);
    persistPreference(requested);
  }, [applyMode, mode, persistPreference]);

  const setAccentPreference = useCallback((nextAccent) => {
    const normalizedAccent = applyAccent(nextAccent);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, normalizedAccent);
    }
    writePreferenceCookie(ACCENT_COOKIE_KEY, normalizedAccent);
    persistAccentPreference(normalizedAccent);
  }, [applyAccent, persistAccentPreference]);

  const contextValue = useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark: resolvedMode === "dark",
      currentTheme: themes[resolvedMode] || themes.light,
      toggleTheme,
      accent,
      setAccent: setAccentPreference,
      setTemporaryOverride,
      loading,
    }),
    [mode, resolvedMode, toggleTheme, accent, setAccentPreference, loading, setTemporaryOverride]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export { ACCENT_PALETTES };

export default ThemeProvider;
