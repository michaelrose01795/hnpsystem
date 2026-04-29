// file location: src/context/DevLayoutOverlayContext.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { canUseDevLayoutOverlay } from "@/lib/dev-layout/access";
import {
  DEV_OVERLAY_CATEGORIES,
  DEV_OVERLAY_CATEGORY_IDS,
  getDefaultCategoryFilters,
  normalizeCategoryFilters,
} from "@/lib/dev-layout/categories";

const STORAGE_ENABLED_KEY = "hnp-dev-layout-overlay-enabled";
const STORAGE_MODE_KEY = "hnp-dev-layout-overlay-mode";
const STORAGE_FULL_SCREEN_KEY = "hnp-dev-layout-overlay-full-screen";
const STORAGE_LEGACY_MARKERS_KEY = "hnp-dev-layout-overlay-legacy-markers";
const STORAGE_CATEGORY_FILTERS_KEY = "hnp-dev-layout-overlay-category-filters";
const STORAGE_PANEL_OPEN_KEY = "hnp-dev-layout-overlay-panel-open";

const MODES = ["labels", "details", "inspect", "trace"];

const defaultFilters = getDefaultCategoryFilters();

const DevLayoutOverlayContext = createContext({
  canAccess: false,
  enabled: false,
  mode: "labels",
  fullScreen: false,
  legacyMarkers: true,
  hydrated: false,
  categoryFilters: defaultFilters,
  categories: DEV_OVERLAY_CATEGORIES,
  panelOpen: false,
  setEnabled: () => {},
  toggleEnabled: () => {},
  setMode: () => {},
  cycleMode: () => {},
  setFullScreen: () => {},
  toggleFullScreen: () => {},
  setLegacyMarkers: () => {},
  toggleLegacyMarkers: () => {},
  setCategoryFilter: () => {},
  toggleCategoryFilter: () => {},
  setAllCategoryFilters: () => {},
  resetCategoryFilters: () => {},
  soloCategory: () => {},
  isCategoryActive: () => true,
  setPanelOpen: () => {},
  togglePanelOpen: () => {},
});

const isTextInputTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = (target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
};

const readJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export function DevLayoutOverlayProvider({ children }) {
  const { user } = useUser();
  const router = useRouter();
  const routePath = (router?.asPath || router?.pathname || "").split("?")[0];
  const isPresentationRoute = routePath === "/presentation" || routePath.startsWith("/presentation/");
  const canAccess = !isPresentationRoute && canUseDevLayoutOverlay(user);
  const [enabled, setEnabledState] = useState(false);
  const [mode, setModeState] = useState("labels");
  const [fullScreen, setFullScreen] = useState(false);
  const [legacyMarkers, setLegacyMarkers] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState(defaultFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!canAccess) {
      setEnabledState(false);
      setModeState("labels");
      setFullScreen(false);
      setLegacyMarkers(true);
      setCategoryFilters(defaultFilters);
      setPanelOpen(false);
      setHydrated(true);
      return;
    }

    const storedEnabled = window.localStorage.getItem(STORAGE_ENABLED_KEY) === "1";
    const storedMode = window.localStorage.getItem(STORAGE_MODE_KEY);
    const storedFullScreen = window.localStorage.getItem(STORAGE_FULL_SCREEN_KEY) === "1";
    const storedLegacyMarkers = window.localStorage.getItem(STORAGE_LEGACY_MARKERS_KEY);
    const storedFilters = readJson(window.localStorage.getItem(STORAGE_CATEGORY_FILTERS_KEY));
    const storedPanelOpen = window.localStorage.getItem(STORAGE_PANEL_OPEN_KEY) === "1";

    setEnabledState(storedEnabled);
    if (MODES.includes(storedMode)) setModeState(storedMode);
    setFullScreen(storedFullScreen);
    setLegacyMarkers(storedLegacyMarkers !== "0");
    setCategoryFilters(normalizeCategoryFilters(storedFilters));
    setPanelOpen(storedPanelOpen);
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

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_FULL_SCREEN_KEY, fullScreen ? "1" : "0");
  }, [fullScreen, canAccess, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_LEGACY_MARKERS_KEY, legacyMarkers ? "1" : "0");
  }, [legacyMarkers, canAccess, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_CATEGORY_FILTERS_KEY, JSON.stringify(categoryFilters));
  }, [categoryFilters, canAccess, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_PANEL_OPEN_KEY, panelOpen ? "1" : "0");
  }, [panelOpen, canAccess, hydrated]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (!canAccess || !enabled) {
      root.removeAttribute("data-dev-overlay-enabled");
      root.removeAttribute("data-dev-overlay-mode");
      root.removeAttribute("data-dev-overlay-scope");
      root.removeAttribute("data-dev-overlay-legacy-markers");
      DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
        root.removeAttribute(`data-dev-overlay-hide-${id}`);
      });
      return;
    }

    root.setAttribute("data-dev-overlay-enabled", "true");
    root.setAttribute("data-dev-overlay-mode", mode);
    root.setAttribute("data-dev-overlay-scope", fullScreen ? "full-screen" : "page-shell");
    root.setAttribute("data-dev-overlay-legacy-markers", legacyMarkers ? "true" : "false");

    DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
      if (categoryFilters[id]) {
        root.removeAttribute(`data-dev-overlay-hide-${id}`);
      } else {
        root.setAttribute(`data-dev-overlay-hide-${id}`, "1");
      }
    });

    return () => {
      root.removeAttribute("data-dev-overlay-enabled");
      root.removeAttribute("data-dev-overlay-mode");
      root.removeAttribute("data-dev-overlay-scope");
      root.removeAttribute("data-dev-overlay-legacy-markers");
      DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
        root.removeAttribute(`data-dev-overlay-hide-${id}`);
      });
    };
  }, [canAccess, enabled, mode, fullScreen, legacyMarkers, categoryFilters]);

  const setEnabled = useCallback((value) => {
    setEnabledState((current) => {
      const nextEnabled = typeof value === "function" ? Boolean(value(current)) : Boolean(value);
      if (!nextEnabled) {
        setPanelOpen(false);
      }
      return nextEnabled;
    });
  }, []);

  const setMode = useCallback((nextMode) => {
    if (!MODES.includes(nextMode)) return;
    setModeState(nextMode);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => !current);
  }, [setEnabled]);

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const currentIndex = Math.max(0, MODES.indexOf(current));
      return MODES[(currentIndex + 1) % MODES.length];
    });
  }, []);

  const toggleFullScreen = useCallback(() => {
    setFullScreen((current) => !current);
  }, []);

  const toggleLegacyMarkers = useCallback(() => {
    setLegacyMarkers((current) => !current);
  }, []);

  const setCategoryFilter = useCallback((id, value) => {
    if (!id) return;
    setCategoryFilters((current) => {
      if (current[id] === Boolean(value)) return current;
      return { ...current, [id]: Boolean(value) };
    });
  }, []);

  const toggleCategoryFilter = useCallback((id) => {
    if (!id) return;
    setCategoryFilters((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const setAllCategoryFilters = useCallback((value) => {
    const next = {};
    DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
      next[id] = Boolean(value);
    });
    setCategoryFilters(next);
  }, []);

  const resetCategoryFilters = useCallback(() => {
    setCategoryFilters(getDefaultCategoryFilters());
  }, []);

  // Isolate a single category — everything else is suppressed. Used by the
  // "solo" buttons in the control panel for the classification flow.
  const soloCategory = useCallback((id) => {
    if (!id) return;
    const next = {};
    DEV_OVERLAY_CATEGORY_IDS.forEach((cat) => {
      next[cat] = cat === id;
    });
    setCategoryFilters(next);
  }, []);

  const togglePanelOpen = useCallback(() => {
    setPanelOpen((current) => !current);
  }, []);

  const isCategoryActive = useCallback(
    (id) => {
      if (!id) return false;
      if (!(id in categoryFilters)) return true;
      return Boolean(categoryFilters[id]);
    },
    [categoryFilters]
  );

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

      if (event.code === "KeyP") {
        event.preventDefault();
        togglePanelOpen();
      }

      if (event.code === "KeyT") {
        event.preventDefault();
        // Ctrl+Shift+T — turn the overlay on (if off) and jump into trace mode.
        setEnabled(true);
        setModeState("trace");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canAccess, toggleEnabled, cycleMode, togglePanelOpen]);

  const value = useMemo(
    () => ({
      canAccess,
      enabled: canAccess ? enabled : false,
      mode,
      fullScreen: canAccess ? fullScreen : false,
      legacyMarkers: canAccess ? legacyMarkers : true,
      hydrated,
      categoryFilters: canAccess ? categoryFilters : defaultFilters,
      categories: DEV_OVERLAY_CATEGORIES,
      panelOpen: canAccess ? panelOpen : false,
      setEnabled,
      toggleEnabled,
      setMode,
      cycleMode,
      setFullScreen,
      toggleFullScreen,
      setLegacyMarkers,
      toggleLegacyMarkers,
      setCategoryFilter,
      toggleCategoryFilter,
      setAllCategoryFilters,
      resetCategoryFilters,
      soloCategory,
      isCategoryActive,
      setPanelOpen,
      togglePanelOpen,
    }),
    [
      canAccess,
      enabled,
      mode,
      fullScreen,
      legacyMarkers,
      categoryFilters,
      panelOpen,
      hydrated,
      toggleEnabled,
      setMode,
      cycleMode,
      toggleFullScreen,
      toggleLegacyMarkers,
      setCategoryFilter,
      toggleCategoryFilter,
      setAllCategoryFilters,
      resetCategoryFilters,
      soloCategory,
      isCategoryActive,
      togglePanelOpen,
    ]
  );

  return <DevLayoutOverlayContext.Provider value={value}>{children}</DevLayoutOverlayContext.Provider>;
}

export function useDevLayoutOverlay() {
  return useContext(DevLayoutOverlayContext);
}
