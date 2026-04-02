import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { themes } from "@/styles/theme";

const STORAGE_KEY = "hp-dms-theme";
const ACCENT_STORAGE_KEY = "hp-dms-accent";
const THEME_COOKIE_KEY = "hp-dms-theme";
const ACCENT_COOKIE_KEY = "hp-dms-accent";
const PREFERENCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const THEME_SEQUENCE = ["system", "light", "dark"];
const DEFAULT_ACCENT = "red";

export const ACCENT_PALETTES = {
  red: { label: "Red", light: "#dc2626", dark: "#f87171" },
  beige: { label: "Beige", light: "#d2b48c", dark: "#c2a27b" },
  grey: { label: "Grey", light: "#6b7280", dark: "#9ca3af" },
  blue: { label: "Blue", light: "#2563eb", dark: "#60a5fa" },
  green: { label: "Green", light: "#16a34a", dark: "#4ade80" },
  yellow: { label: "Yellow", light: "#ca8a04", dark: "#facc15" },
  pink: { label: "Pink", light: "#db2777", dark: "#f472b6" },
  orange: { label: "Orange", light: "#ea580c", dark: "#fb923c" },
  purple: { label: "Purple", light: "#7c3aed", dark: "#a78bfa" },
};

const hexToRgb = (hexColor) => {
  const hex = String(hexColor || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return "220, 38, 38";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const hexToRgbObject = (hexColor) => {
  const hex = String(hexColor || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return { r: 220, g: 38, b: 38 };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

const clampChannel = (value) => Math.max(0, Math.min(255, Math.round(value)));
const rgbToHex = (rgb) =>
  `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clampChannel(value).toString(16).padStart(2, "0"))
    .join("")}`;

const blend = (from, to, ratio = 0.5) => {
  const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0));
  return {
    r: from.r * (1 - safeRatio) + to.r * safeRatio,
    g: from.g * (1 - safeRatio) + to.g * safeRatio,
    b: from.b * (1 - safeRatio) + to.b * safeRatio,
  };
};

const normalizeAccent = (value) => {
  if (!value || typeof value !== "string") return DEFAULT_ACCENT;
  const normalized = value.toLowerCase();
  return ACCENT_PALETTES[normalized] ? normalized : DEFAULT_ACCENT;
};

const normalizeMode = (value) => {
  if (value === "system" || value === "dark") return value;
  return "light";
};

const normalizeDbMode = (value) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return "system";
  }
  if (typeof value === "boolean") {
    return value ? "dark" : "light";
  }
  return normalizeMode(value);
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
  const { dbUserId } = useUser() || {};
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
    const normalizedAccent = normalizeAccent(nextAccent);
    const palette = ACCENT_PALETTES[normalizedAccent] || ACCENT_PALETTES[DEFAULT_ACCENT];
    const resolved =
      modeOverride ||
      (typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null) ||
      "light";
    const resolvedAccent = resolved === "dark" ? palette.dark : palette.light;
    const resolvedAccentRgb = hexToRgb(resolvedAccent);
    const baseAccentRgb = hexToRgbObject(resolvedAccent);
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 0, g: 0, b: 0 };
    const surfaceTarget = resolved === "dark" ? { r: 22, g: 22, b: 26 } : white;
    const primaryLight = rgbToHex(
      resolved === "dark" ? blend(baseAccentRgb, white, 0.18) : blend(baseAccentRgb, black, 0.18)
    );
    const primaryDark = rgbToHex(
      resolved === "dark" ? blend(baseAccentRgb, white, 0.34) : blend(baseAccentRgb, black, 0.32)
    );
    const accentSurface = resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.16)` : `rgba(${resolvedAccentRgb}, 0.08)`;
    const accentBase = resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.22)` : `rgba(${resolvedAccentRgb}, 0.14)`;
    const accentBaseHover = resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.3)` : `rgba(${resolvedAccentRgb}, 0.22)`;
    const accentSurfaceHover = accentBase;
    const accentStrong = resolvedAccent;
    const sectionLevel1 = accentSurface;
    const sectionLevel2 = accentBase;
    const sectionLevel3 = accentBaseHover;
    const sectionLevel4 = accentStrong;
    const borderTone = resolved === "dark" ? blend(baseAccentRgb, white, 0.45) : blend(baseAccentRgb, black, 0.22);
    const shellBgColor = rgbToHex(blend(baseAccentRgb, surfaceTarget, resolved === "dark" ? 0.78 : 0.86));
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--accent-base", accentBase);
      document.documentElement.style.setProperty("--accent-base-rgb", resolvedAccentRgb);
      document.documentElement.style.setProperty("--accent-surface", accentSurface);
      document.documentElement.style.setProperty("--accent-base-hover", accentBaseHover);
      document.documentElement.style.setProperty("--accent-surface-hover", accentSurfaceHover);
      document.documentElement.style.setProperty("--accent-strong", accentStrong);
      document.documentElement.style.setProperty("--primary", resolvedAccent);
      document.documentElement.style.setProperty("--primary-light", primaryLight);
      document.documentElement.style.setProperty("--primary-dark", primaryDark);
      document.documentElement.style.setProperty("--primary-rgb", resolvedAccentRgb);
      document.documentElement.style.setProperty("--border", rgbToHex(borderTone));
      document.documentElement.style.setProperty(
        "--overlay",
        resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.5)` : `rgba(${resolvedAccentRgb}, 0.35)`
      );
      document.documentElement.style.setProperty("--search-text", primaryDark);
      document.documentElement.style.setProperty("--layer-section-level-1", sectionLevel1);
      document.documentElement.style.setProperty("--layer-section-level-2", sectionLevel2);
      document.documentElement.style.setProperty("--layer-section-level-3", sectionLevel3);
      document.documentElement.style.setProperty("--layer-section-level-4", sectionLevel4);
      document.documentElement.style.setProperty("--layer-gradient", accentBase);
      document.documentElement.style.setProperty("--profile-table-surface", accentBase);
      document.documentElement.style.setProperty("--profile-table-alt-surface", accentBaseHover);

      // Update html/body background to accent layer so mobile browser overscroll
      // areas and safe-area insets show the accent colour instead of plain white/dark.
      document.documentElement.style.backgroundColor = shellBgColor;
      if (document.body) document.body.style.backgroundColor = shellBgColor;
      // Update theme-color meta so mobile browser chrome matches
      let themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement("meta");
        themeMeta.setAttribute("name", "theme-color");
        document.head.appendChild(themeMeta);
      }
      themeMeta.setAttribute("content", shellBgColor);

      document.documentElement.style.setProperty("--row-background", "var(--surface)");
      document.documentElement.style.setProperty("--section-gradient-outer", accentBaseHover);
      document.documentElement.style.setProperty("--section-gradient-inner", accentBase);
      document.documentElement.style.setProperty("--section-gradient-center", "var(--surface)");
      document.documentElement.style.setProperty("--scrollbar-thumb", accentStrong);
      document.documentElement.style.setProperty("--scrollbar-thumb-hover", primaryLight);
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
    const fetchPreference = async () => {
      if (!dbUserId) {
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
        try {
          const { data: fullData, error: fullError } = await supabaseClient
            .from("users")
            .select("dark_mode, accent_color")
            .eq("user_id", dbUserId)
            .maybeSingle();
          if (fullError) throw fullError;
          data = fullData;
        } catch (fullErr) {
          const { data: fallbackData, error: fallbackError } = await supabaseClient
            .from("users")
            .select("dark_mode")
            .eq("user_id", dbUserId)
            .maybeSingle();
          if (fallbackError) throw fallbackError;
          data = fallbackData;
          console.warn("Accent DB column unavailable, using local accent preference", fullErr?.message || fullErr);
        }

        if (!cancelled && data) {
          const preference = normalizeDbMode(data.dark_mode);
          const { resolved } = applyMode(preference);
          const nextAccent =
            typeof data.accent_color === "string" && data.accent_color.length > 0
              ? normalizeAccent(data.accent_color)
              : DEFAULT_ACCENT;
          applyAccent(nextAccent, resolved);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, preference);
            window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
          }
          writePreferenceCookie(THEME_COOKIE_KEY, preference);
          writePreferenceCookie(ACCENT_COOKIE_KEY, nextAccent);
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
  }, [dbUserId, applyAccent, applyMode, normalizedDefault]);

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

export default ThemeProvider;
