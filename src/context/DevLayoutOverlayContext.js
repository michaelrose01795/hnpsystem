// file location: src/context/DevLayoutOverlayContext.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { canUseDevLayoutOverlay } from "@/lib/dev-layout/access";

const STORAGE_ENABLED_KEY = "hnp-dev-layout-overlay-enabled";
const STORAGE_MODE_KEY = "hnp-dev-layout-overlay-mode";

const MODES = ["labels", "details", "inspect"];

const DevLayoutOverlayContext = createContext({
  canAccess: false,
  enabled: false,
  mode: "labels",
  hydrated: false,
  setEnabled: () => {},
  toggleEnabled: () => {},
  setMode: () => {},
  cycleMode: () => {},
});

const isTextInputTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = (target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
};

export function DevLayoutOverlayProvider({ children }) {
  const { user } = useUser();
  const canAccess = canUseDevLayoutOverlay(user);
  const [enabled, setEnabled] = useState(false);
  const [mode, setModeState] = useState("labels");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!canAccess) {
      setEnabled(false);
      setModeState("labels");
      setHydrated(true);
      return;
    }

    const storedEnabled = window.localStorage.getItem(STORAGE_ENABLED_KEY) === "1";
    const storedMode = window.localStorage.getItem(STORAGE_MODE_KEY);

    setEnabled(storedEnabled);
    if (MODES.includes(storedMode)) {
      setModeState(storedMode);
    }
    setHydrated(true);
  }, [canAccess]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_ENABLED_KEY, enabled ? "1" : "0");
  }, [enabled, canAccess, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_MODE_KEY, mode);
  }, [mode, canAccess, hydrated]);

  const setMode = useCallback((nextMode) => {
    if (!MODES.includes(nextMode)) return;
    setModeState(nextMode);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => !current);
  }, []);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const currentIndex = Math.max(0, MODES.indexOf(current));
      return MODES[(currentIndex + 1) % MODES.length];
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess) return;

    const onKeyDown = (event) => {
      if (isTextInputTarget(event.target)) return;
      if (!(event.ctrlKey && event.shiftKey)) return;

      if (event.code === "KeyD") {
        event.preventDefault();
        toggleEnabled();
      }

      if (event.code === "KeyM") {
        event.preventDefault();
        cycleMode();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAccess, toggleEnabled, cycleMode]);

  const value = useMemo(
    () => ({
      canAccess,
      enabled: canAccess ? enabled : false,
      mode,
      hydrated,
      setEnabled,
      toggleEnabled,
      setMode,
      cycleMode,
    }),
    [canAccess, enabled, mode, hydrated, toggleEnabled, setMode, cycleMode]
  );

  return <DevLayoutOverlayContext.Provider value={value}>{children}</DevLayoutOverlayContext.Provider>;
}

export function useDevLayoutOverlay() {
  return useContext(DevLayoutOverlayContext);
}
