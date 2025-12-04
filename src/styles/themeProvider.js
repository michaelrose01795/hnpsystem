import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { useUser } from "@/context/UserContext";
import { themes } from "@/styles/theme";

const STORAGE_KEY = "hp-dms-theme";

const ThemeContext = createContext({
  mode: "light",
  isDark: false,
  currentTheme: themes.light,
  toggleTheme: () => {},
  loading: true,
});

export function ThemeProvider({ children, defaultMode = "light" }) {
  const { dbUserId } = useUser() || {};
  const [mode, setMode] = useState(defaultMode);
  const [loading, setLoading] = useState(true);

  const applyMode = useCallback((nextMode) => {
    const resolved = nextMode === "dark" ? "dark" : "light";
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    setMode(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "light" || stored === "dark") {
      applyMode(stored);
    } else {
      applyMode(defaultMode);
    }
  }, [applyMode, defaultMode]);

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
          const preference = data.dark_mode ? "dark" : "light";
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
        await supabaseClient
          .from("profiles")
          .upsert({ user_id: dbUserId, dark_mode: nextMode === "dark" }, { onConflict: "user_id" });
      } catch (err) {
        console.error("Failed to persist theme preference", err.message || err);
      }
    },
    [dbUserId]
  );

  const toggleTheme = useCallback(() => {
    const nextMode = mode === "dark" ? "light" : "dark";
    const resolved = applyMode(nextMode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
    persistPreference(resolved);
  }, [applyMode, mode, persistPreference]);

  const contextValue = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      currentTheme: themes[mode] || themes.light,
      toggleTheme,
      loading,
    }),
    [mode, toggleTheme, loading]
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

export default ThemeProvider;
