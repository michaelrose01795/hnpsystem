import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { themes } from "@/styles/theme";

const STORAGE_KEY = "hp-dms-theme";
const THEME_SEQUENCE = ["system", "light", "dark"];

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
  loading: true,
});

export function ThemeProvider({ children, defaultMode = "system" }) {
  const { dbUserId } = useUser() || {};
  const normalizedDefault = normalizeMode(defaultMode);
  const [mode, setMode] = useState(normalizedDefault);
  const [resolvedMode, setResolvedMode] = useState(() =>
    normalizedDefault === "system" ? getSystemPreferredMode() : normalizedDefault
  );
  const [loading, setLoading] = useState(true);

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
    const initial =
      stored === "light" || stored === "dark" || stored === "system" ? stored : normalizedDefault;
    applyMode(initial);
  }, [applyMode, normalizedDefault]);

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
    };

    media.addEventListener ? media.addEventListener("change", handleChange) : media.addListener(handleChange);
    return () => {
      media.removeEventListener
        ? media.removeEventListener("change", handleChange)
        : media.removeListener(handleChange);
    };
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    const fetchPreference = async () => {
      if (!dbUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabaseClient
          .from("profiles")
          .select("dark_mode")
          .eq("user_id", dbUserId)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled && data) {
          const preference =
            data.dark_mode === null || typeof data.dark_mode === "undefined"
              ? "system"
              : data.dark_mode
              ? "dark"
              : "light";
          applyMode(preference);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, preference);
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
  }, [dbUserId, applyMode]);

  const persistPreference = useCallback(
    async (nextMode) => {
      if (!dbUserId) return;
      try {
        const normalized = normalizeMode(nextMode);
        await supabaseClient
          .from("profiles")
          .upsert(
            { user_id: dbUserId, dark_mode: normalized === "system" ? null : normalized === "dark" },
            { onConflict: "user_id" }
          );
      } catch (err) {
        console.error("Failed to persist theme preference", err.message || err);
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

  const contextValue = useMemo(
    () => ({
      mode,
      resolvedMode,
      isDark: resolvedMode === "dark",
      currentTheme: themes[resolvedMode] || themes.light,
      toggleTheme,
      loading,
    }),
    [mode, resolvedMode, toggleTheme, loading]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
