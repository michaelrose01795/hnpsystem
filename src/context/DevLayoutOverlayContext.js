// file location: src/context/DevLayoutOverlayContext.js
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { canUseDevLayoutOverlay } from "@/lib/dev-layout/access";
import { canShowDevPages } from "@/lib/dev-tools/config";
import {
  DEV_OVERLAY_CATEGORIES,
  DEV_OVERLAY_CATEGORY_IDS,
  DEV_OVERLAY_SURFACE_STAFF,
  DEV_OVERLAY_SURFACE_WEBSITE,
  getDefaultCategoryFilters,
  normalizeCategoryFilters,
} from "@/lib/dev-layout/categories";

const STORAGE_ENABLED_KEY = "hnp-dev-layout-overlay-enabled";
const STORAGE_WEBSITE_ENABLED_KEY = "hnp-dev-layout-overlay-website-enabled";
const STORAGE_MODE_KEY = "hnp-dev-layout-overlay-mode";
const STORAGE_FULL_SCREEN_KEY = "hnp-dev-layout-overlay-full-screen";
const STORAGE_LEGACY_MARKERS_KEY = "hnp-dev-layout-overlay-legacy-markers";
const STORAGE_CATEGORY_FILTERS_KEY = "hnp-dev-layout-overlay-category-filters";
const STORAGE_PANEL_OPEN_KEY = "hnp-dev-layout-overlay-panel-open";
const STORAGE_SELF_INSPECT_KEY = "hnp-dev-layout-overlay-self-inspect";

const MODES = ["labels", "details", "inspect", "trace"];

// /website has no sidebar, so it has no Overlay button. A dev user switches the
// overlay on there by TYPING the trigger anywhere on a /website page, or by
// visiting /website-dev (next.config.mjs redirects that to ?website-dev=1,
// consumed below). The website surface keeps its own on/off flag so turning
// the overlay on in the staff app never paints it over the customer site.
export const WEBSITE_DEV_TRIGGER = "/website-dev";
export const WEBSITE_DEV_QUERY_PARAM = "website-dev";
const WEBSITE_TRIGGER_IDLE_RESET_MS = 2500;

const isWebsiteRoutePath = (path) => path === "/website" || path.startsWith("/website/");

const defaultFilters = getDefaultCategoryFilters();

const DevLayoutOverlayContext = createContext({
  canAccess: false,
  surface: DEV_OVERLAY_SURFACE_STAFF,
  isWebsiteSurface: false,
  websiteTrigger: WEBSITE_DEV_TRIGGER,
  enabled: false,
  mode: "labels",
  fullScreen: false,
  legacyMarkers: true,
  hydrated: false,
  categoryFilters: defaultFilters,
  categories: DEV_OVERLAY_CATEGORIES,
  panelOpen: false,
  selfInspect: false,
  setSelfInspect: () => {},
  toggleSelfInspect: () => {},
  setEnabled: () => {},
  toggleEnabled: () => {},
  toggleWebsiteOverlay: () => {},
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
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const routePath = ((router?.asPath || router?.pathname || "").split("?")[0] || "").split("#")[0];
  const isPresentationRoute = routePath === "/presentation" || routePath.startsWith("/presentation/");
  const surface = isWebsiteRoutePath(routePath) ? DEV_OVERLAY_SURFACE_WEBSITE : DEV_OVERLAY_SURFACE_STAFF;
  const isWebsiteSurface = surface === DEV_OVERLAY_SURFACE_WEBSITE;
  // The website-manager Preview/Design tabs embed /website in an iframe. Those
  // frames are panel content inside a staff page, so the overlay stays out.
  const [isEmbeddedFrame, setIsEmbeddedFrame] = useState(false);
  useEffect(() => {
    try {
      setIsEmbeddedFrame(window.self !== window.top);
    } catch {
      setIsEmbeddedFrame(true);
    }
  }, []);
  // Staff routes: dev environment + signed-in staff user. /website: dev
  // environment only (dev branch, Vercel preview, local) — the site's own
  // Dev / Overlay nav buttons appear there without a staff sign-in, and the
  // live production site never shows them.
  const canAccess =
    !isPresentationRoute &&
    (isWebsiteSurface ? canShowDevPages() && !isEmbeddedFrame : canUseDevLayoutOverlay(user));
  const [staffEnabled, setStaffEnabledState] = useState(false);
  const [websiteEnabled, setWebsiteEnabledState] = useState(false);
  const [mode, setModeState] = useState("labels");
  const [fullScreen, setFullScreen] = useState(false);
  const [legacyMarkers, setLegacyMarkers] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState(defaultFilters);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selfInspect, setSelfInspectState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const enabled = isWebsiteSurface ? websiteEnabled : staffEnabled;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!canAccess) {
      setStaffEnabledState(false);
      setWebsiteEnabledState(false);
      setModeState("labels");
      setFullScreen(false);
      setLegacyMarkers(true);
      setCategoryFilters(defaultFilters);
      setPanelOpen(false);
      setSelfInspectState(false);
      setHydrated(true);
      return;
    }

    const storedEnabled = window.localStorage.getItem(STORAGE_ENABLED_KEY) === "1";
    const storedWebsiteEnabled = window.localStorage.getItem(STORAGE_WEBSITE_ENABLED_KEY) === "1";
    const storedMode = window.localStorage.getItem(STORAGE_MODE_KEY);
    const storedFullScreen = window.localStorage.getItem(STORAGE_FULL_SCREEN_KEY) === "1";
    const storedLegacyMarkers = window.localStorage.getItem(STORAGE_LEGACY_MARKERS_KEY);
    const storedFilters = readJson(window.localStorage.getItem(STORAGE_CATEGORY_FILTERS_KEY));
    const storedPanelOpen = window.localStorage.getItem(STORAGE_PANEL_OPEN_KEY) === "1";
    const storedSelfInspect = window.localStorage.getItem(STORAGE_SELF_INSPECT_KEY) === "1";

    setStaffEnabledState(storedEnabled);
    setWebsiteEnabledState(storedWebsiteEnabled);
    if (MODES.includes(storedMode)) setModeState(storedMode);
    setFullScreen(storedFullScreen);
    setLegacyMarkers(storedLegacyMarkers !== "0");
    setCategoryFilters(normalizeCategoryFilters(storedFilters));
    setPanelOpen(storedPanelOpen);
    setSelfInspectState(storedSelfInspect);
    setHydrated(true);
  }, [canAccess]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_ENABLED_KEY, staffEnabled ? "1" : "0");
  }, [staffEnabled, canAccess, hydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_WEBSITE_ENABLED_KEY, websiteEnabled ? "1" : "0");
  }, [websiteEnabled, canAccess, hydrated]);

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
    if (typeof window === "undefined" || !canAccess || !hydrated) return;
    window.localStorage.setItem(STORAGE_SELF_INSPECT_KEY, selfInspect ? "1" : "0");
  }, [selfInspect, canAccess, hydrated]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const clearRootAttributes = () => {
      root.removeAttribute("data-dev-overlay-enabled");
      root.removeAttribute("data-dev-overlay-mode");
      root.removeAttribute("data-dev-overlay-scope");
      root.removeAttribute("data-dev-overlay-legacy-markers");
      root.removeAttribute("data-dev-overlay-surface");
      DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
        root.removeAttribute(`data-dev-overlay-hide-${id}`);
      });
    };

    if (!canAccess || !enabled) {
      clearRootAttributes();
      return;
    }

    root.setAttribute("data-dev-overlay-enabled", "true");
    root.setAttribute("data-dev-overlay-mode", mode);
    root.setAttribute("data-dev-overlay-scope", fullScreen ? "full-screen" : "page-shell");
    root.setAttribute("data-dev-overlay-legacy-markers", legacyMarkers ? "true" : "false");
    root.setAttribute("data-dev-overlay-surface", surface);

    DEV_OVERLAY_CATEGORY_IDS.forEach((id) => {
      if (categoryFilters[id]) {
        root.removeAttribute(`data-dev-overlay-hide-${id}`);
      } else {
        root.setAttribute(`data-dev-overlay-hide-${id}`, "1");
      }
    });

    return clearRootAttributes;
  }, [canAccess, enabled, mode, fullScreen, legacyMarkers, categoryFilters, surface]);

  // Master on/off for whichever surface the current route belongs to.
  const setEnabled = useCallback((value) => {
    const setSurfaceEnabled = isWebsiteSurface ? setWebsiteEnabledState : setStaffEnabledState;
    setSurfaceEnabled((current) => {
      const nextEnabled = typeof value === "function" ? Boolean(value(current)) : Boolean(value);
      if (!nextEnabled) {
        setPanelOpen(false);
      }
      return nextEnabled;
    });
  }, [isWebsiteSurface]);

  const setMode = useCallback((nextMode) => {
    if (!MODES.includes(nextMode)) return;
    setModeState(nextMode);
  }, []);

  const toggleEnabled = useCallback(() => {
    setEnabled((current) => !current);
  }, [setEnabled]);

  // Website trigger — there is no launcher button on /website, so switching the
  // overlay on also opens its control panel (Minimise / Ctrl+Shift+P hide it).
  const toggleWebsiteOverlay = useCallback((forceValue) => {
    setWebsiteEnabledState((current) => {
      const nextEnabled = typeof forceValue === "boolean" ? forceValue : !current;
      setPanelOpen(nextEnabled);
      return nextEnabled;
    });
  }, []);

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

  // Self-inspect — draws the overlay's own boxes/labels over the inspector
  // panel's internal cards so the panel UI can be audited the same way pages
  // are. Opens the panel automatically when turned on so the target is visible.
  const setSelfInspect = useCallback((value) => {
    setSelfInspectState((current) => {
      const next = typeof value === "function" ? Boolean(value(current)) : Boolean(value);
      if (next) setPanelOpen(true);
      return next;
    });
  }, []);

  const toggleSelfInspect = useCallback(() => {
    setSelfInspect((current) => !current);
  }, [setSelfInspect]);

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
  }, [canAccess, toggleEnabled, cycleMode, togglePanelOpen, setEnabled]);

  // Typed trigger on /website. Keystrokes are buffered (not consumed), so the
  // sequence works wherever focus is — including the site's search fields —
  // and a pause resets the buffer so ordinary typing never builds up a match.
  useEffect(() => {
    if (typeof window === "undefined" || !canAccess || !hydrated || !isWebsiteSurface) return undefined;

    let buffer = "";
    let lastKeyAt = 0;

    const onKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const now = Date.now();
      if (now - lastKeyAt > WEBSITE_TRIGGER_IDLE_RESET_MS) buffer = "";
      lastKeyAt = now;

      if (event.key === "Backspace") {
        buffer = buffer.slice(0, -1);
        return;
      }
      if (typeof event.key !== "string" || event.key.length !== 1) return;

      buffer = `${buffer}${event.key.toLowerCase()}`.slice(-WEBSITE_DEV_TRIGGER.length);
      if (buffer === WEBSITE_DEV_TRIGGER) {
        buffer = "";
        toggleWebsiteOverlay();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [canAccess, hydrated, isWebsiteSurface, toggleWebsiteOverlay]);

  // URL trigger on /website (?website-dev=1, or ?website-dev=0 to switch off).
  // Waits for the signed-in user and the stored state so neither can overwrite
  // the request, then strips the parameter so it never lingers in the address
  // bar — including for visitors who cannot use the overlay.
  const websiteDevQueryValue = router?.query?.[WEBSITE_DEV_QUERY_PARAM];
  useEffect(() => {
    if (!router?.isReady || !isWebsiteSurface || websiteDevQueryValue === undefined) return;
    if (userLoading) return;
    if (canAccess && !hydrated) return;

    if (canAccess) {
      const raw = String(Array.isArray(websiteDevQueryValue) ? websiteDevQueryValue[0] : websiteDevQueryValue);
      toggleWebsiteOverlay(!["0", "off", "false"].includes(raw.toLowerCase()));
    }

    const nextQuery = { ...router.query };
    delete nextQuery[WEBSITE_DEV_QUERY_PARAM];
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true, scroll: false });
  }, [router, isWebsiteSurface, websiteDevQueryValue, userLoading, canAccess, hydrated, toggleWebsiteOverlay]);

  const value = useMemo(
    () => ({
      canAccess,
      surface,
      isWebsiteSurface,
      websiteTrigger: WEBSITE_DEV_TRIGGER,
      enabled: canAccess ? enabled : false,
      mode,
      fullScreen: canAccess ? fullScreen : false,
      legacyMarkers: canAccess ? legacyMarkers : true,
      hydrated,
      categoryFilters: canAccess ? categoryFilters : defaultFilters,
      categories: DEV_OVERLAY_CATEGORIES,
      panelOpen: canAccess ? panelOpen : false,
      selfInspect: canAccess ? selfInspect : false,
      setSelfInspect,
      toggleSelfInspect,
      setEnabled,
      toggleEnabled,
      toggleWebsiteOverlay,
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
      surface,
      isWebsiteSurface,
      enabled,
      mode,
      fullScreen,
      legacyMarkers,
      categoryFilters,
      panelOpen,
      selfInspect,
      setSelfInspect,
      toggleSelfInspect,
      hydrated,
      setEnabled,
      toggleEnabled,
      toggleWebsiteOverlay,
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
