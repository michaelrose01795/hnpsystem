import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { themes } from "@/styles/theme";

const STORAGE_KEY = "hp-dms-theme";
const ACCENT_STORAGE_KEY = "hp-dms-accent";
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
const rgbToCss = (rgb) => `${clampChannel(rgb.r)}, ${clampChannel(rgb.g)}, ${clampChannel(rgb.b)}`;
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

const getSystemPreferredMode = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const ThemeContext = createContext({
  mode: "system",
  resolvedMode: "light",
  isDark: false,
  currentTheme: themes.light,
  toggleTheme: () => {},
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
  loading: true,
});

export function ThemeProvider({ children, defaultMode = "system" }) {
  const { dbUserId } = useUser() || {};
  const normalizedDefault = normalizeMode(defaultMode);
  const [mode, setMode] = useState(normalizedDefault);
  const [resolvedMode, setResolvedMode] = useState(() =>
    normalizedDefault === "system" ? getSystemPreferredMode() : normalizedDefault
  );
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [loading, setLoading] = useState(true);

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
    const accentLayer1 = resolved === "dark" ? blend(baseAccentRgb, black, 0.86) : blend(baseAccentRgb, white, 0.76);
    const accentLayer2 = resolved === "dark" ? blend(baseAccentRgb, black, 0.81) : blend(baseAccentRgb, white, 0.84);
    const accentLayer3 = resolved === "dark" ? blend(baseAccentRgb, black, 0.75) : blend(baseAccentRgb, white, 0.9);
    const accentLayer4 = resolved === "dark" ? blend(baseAccentRgb, black, 0.69) : blend(baseAccentRgb, white, 0.94);
    const borderTone = resolved === "dark" ? blend(baseAccentRgb, white, 0.45) : blend(baseAccentRgb, black, 0.22);
    const accentReadable = resolved === "dark" ? blend(baseAccentRgb, white, 0.24) : blend(baseAccentRgb, black, 0.12);
    const accentPanelTone = resolved === "dark" ? blend(baseAccentRgb, black, 0.72) : blend(baseAccentRgb, white, 0.9);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--primary", resolvedAccent);
      document.documentElement.style.setProperty("--primary-light", resolvedAccent);
      document.documentElement.style.setProperty("--primary-dark", resolvedAccent);
      document.documentElement.style.setProperty("--primary-rgb", resolvedAccentRgb);
      document.documentElement.style.setProperty("--border", rgbToHex(borderTone));
      document.documentElement.style.setProperty("--info-dark", rgbToHex(accentReadable));
      document.documentElement.style.setProperty("--search-text", resolvedAccent);
      document.documentElement.style.setProperty("--accent-blue", resolvedAccent);
      document.documentElement.style.setProperty("--accent-orange", resolvedAccent);
      document.documentElement.style.setProperty(
        "--accent-blue-surface",
        resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.2)` : `rgba(${resolvedAccentRgb}, 0.12)`
      );
      document.documentElement.style.setProperty(
        "--accent-orange-surface",
        resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.2)` : `rgba(${resolvedAccentRgb}, 0.12)`
      );
      document.documentElement.style.setProperty("--accent-purple", resolvedAccent);
      document.documentElement.style.setProperty("--accent-purple-rgb", resolvedAccentRgb);
      document.documentElement.style.setProperty(
        "--accent-purple-surface",
        resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.22)` : `rgba(${resolvedAccentRgb}, 0.14)`
      );
      document.documentElement.style.setProperty(
        "--overlay",
        resolved === "dark" ? `rgba(${resolvedAccentRgb}, 0.5)` : `rgba(${resolvedAccentRgb}, 0.35)`
      );
      document.documentElement.style.setProperty("--accent-layer-1", rgbToHex(accentLayer1));
      document.documentElement.style.setProperty("--accent-layer-2", rgbToHex(accentLayer2));
      document.documentElement.style.setProperty("--accent-layer-3", rgbToHex(accentLayer3));
      document.documentElement.style.setProperty("--accent-layer-4", rgbToHex(accentLayer4));
      document.documentElement.style.setProperty("--accent-layer-1-rgb", rgbToCss(accentLayer1));
      document.documentElement.style.setProperty("--accent-layer-2-rgb", rgbToCss(accentLayer2));
      document.documentElement.style.setProperty("--accent-layer-3-rgb", rgbToCss(accentLayer3));
      document.documentElement.style.setProperty("--accent-layer-4-rgb", rgbToCss(accentLayer4));
      document.documentElement.style.setProperty("--layer-section-level-1", "var(--accent-layer-1)");
      document.documentElement.style.setProperty("--layer-section-level-2", "var(--accent-layer-2)");
      document.documentElement.style.setProperty("--layer-section-level-3", "var(--accent-layer-3)");
      document.documentElement.style.setProperty("--layer-section-level-4", "var(--accent-layer-4)");
      document.documentElement.style.setProperty("--layer-gradient", "var(--accent-layer-3)");
      document.documentElement.style.setProperty("--row-background", rgbToHex(accentPanelTone));
      document.documentElement.style.setProperty("--section-gradient-outer", "var(--accent-layer-2)");
      document.documentElement.style.setProperty("--section-gradient-inner", "var(--accent-layer-3)");
      document.documentElement.style.setProperty("--section-gradient-center", "var(--accent-layer-4)");
      document.documentElement.style.setProperty("--scrollbar-thumb", resolvedAccent);
      document.documentElement.style.setProperty(
        "--scrollbar-thumb-hover",
        resolved === "dark" ? rgbToHex(blend(baseAccentRgb, white, 0.2)) : rgbToHex(blend(baseAccentRgb, black, 0.18))
      );
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
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const storedAccent =
      dbUserId && typeof window !== "undefined" ? window.localStorage.getItem(ACCENT_STORAGE_KEY) : null;
    const initial =
      stored === "light" || stored === "dark" || stored === "system" ? stored : normalizedDefault;
    applyMode(initial);
    applyAccent(storedAccent || DEFAULT_ACCENT);
  }, [applyAccent, applyMode, dbUserId, normalizedDefault]);

  useEffect(() => {
    applyAccent(accent, resolvedMode);
  }, [accent, applyAccent, resolvedMode]);

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

    media.addEventListener ? media.addEventListener("change", handleChange) : media.addListener(handleChange);
    return () => {
      media.removeEventListener
        ? media.removeEventListener("change", handleChange)
        : media.removeListener(handleChange);
    };
  }, [accent, applyAccent, mode]);

  useEffect(() => {
    let cancelled = false;
    const fetchPreference = async () => {
      if (!dbUserId) {
        applyAccent(DEFAULT_ACCENT);
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
          const preference =
            data.dark_mode === null || typeof data.dark_mode === "undefined"
              ? "system"
              : data.dark_mode
              ? "dark"
              : "light";
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
  }, [dbUserId, applyAccent, applyMode]);

  const persistPreference = useCallback(
    async (nextMode) => {
      if (!dbUserId) return;
      try {
        const normalized = normalizeMode(nextMode);
        await supabaseClient
          .from("users")
          .update({ dark_mode: normalized === "system" ? null : normalized === "dark" })
          .eq("user_id", dbUserId);
      } catch (err) {
        console.error("Failed to persist theme preference", err.message || err);
      }
    },
    [dbUserId]
  );

  const persistAccentPreference = useCallback(
    async (nextAccent) => {
      if (!dbUserId) return;
      try {
        await supabaseClient
          .from("users")
          .update({ accent_color: normalizeAccent(nextAccent) })
          .eq("user_id", dbUserId);
      } catch (err) {
        console.warn("Failed to persist accent preference", err.message || err);
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
    persistPreference(requested);
  }, [applyMode, mode, persistPreference]);

  const setAccentPreference = useCallback((nextAccent) => {
    const normalizedAccent = applyAccent(nextAccent);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, normalizedAccent);
    }
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
      loading,
    }),
    [mode, resolvedMode, toggleTheme, accent, setAccentPreference, loading]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
