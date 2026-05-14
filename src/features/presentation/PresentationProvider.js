import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { ALL_SLIDES, buildSlidesForRole } from "./slides";
import {
  getPresentationRoleByKey,
  orderSlidesForRole,
} from "@/config/presentationRoleAccess";
import {
  setOverlayHidden as publishOverlayHidden,
  subscribeOverlayVisibility,
} from "./runtime/overlayVisibility";

const PresentationContext = createContext(null);
const RETURN_TO_STORAGE_KEY = "presentation:returnTo";
const ACTIVE_ROLE_STORAGE_KEY = "presentation:activeRoleKey";

function parseHash(hash) {
  const out = { slide: 0, step: 0 };
  if (!hash) return out;
  const clean = hash.replace(/^#/, "");
  const parts = clean.split("&");
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "slide") out.slide = Number(v) || 0;
    if (k === "step") out.step = Number(v) || 0;
  }
  return out;
}

function routeToSlug(route) {
  const [path, query = ""] = String(route || "").split("?");
  const base = path
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    || "home";
  const querySuffix = query
    ? `-${query.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
    : "";
  return `${base}${querySuffix}`;
}

function getQuerySlide(querySlide) {
  return Number.parseInt(
    Array.isArray(querySlide) ? querySlide[0] : querySlide,
    10
  );
}

export function PresentationProvider({ children }) {
  const { user, loading } = useUser();
  const router = useRouter();

  const queryRoleKey = typeof router.query.role === "string" ? router.query.role : null;
  const activeRole = useMemo(() => getPresentationRoleByKey(queryRoleKey), [queryRoleKey]);

  // Persist last-selected role so a refresh of /presentation?role=... survives,
  // and so the rest of the app shell can read the active role from sessionStorage
  // before router.query is hydrated.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (activeRole?.key) {
      window.sessionStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, activeRole.key);
    }
  }, [activeRole?.key]);

  // If we land on /presentation without a role, send the user to /loginPresentation.
  useEffect(() => {
    if (!router.isReady) return;
    if (queryRoleKey && !activeRole) {
      // Unknown role key — redirect to picker.
      router.replace("/loginPresentation");
      return;
    }
    if (!queryRoleKey) {
      router.replace("/loginPresentation");
    }
  }, [router, router.isReady, queryRoleKey, activeRole]);

  const userRoles = useMemo(() => {
    if (activeRole) return [activeRole.roleId];
    return user?.roles || [];
  }, [activeRole, user?.roles]);

  const isPublicViewer = !loading && !user && !activeRole;
  const canExit = Boolean(!loading && (user || activeRole));

  const slides = useMemo(() => {
    if (activeRole) {
      const ordered = orderSlidesForRole(activeRole, ALL_SLIDES);
      // Fallback: if the doc-driven ordering yielded no match (unlikely), fall
      // back to the role-filtered slide set so the runner still has content.
      if (ordered.length > 0) return ordered;
      return buildSlidesForRole([activeRole.roleId]);
    }
    return isPublicViewer ? ALL_SLIDES : buildSlidesForRole(userRoles);
  }, [activeRole, isPublicViewer, userRoles]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [devOverlayOn, setDevOverlayOn] = useState(false);
  // Whether the user has clicked "Hide" on the callout. When true, the overlay
  // (scrim, ring and callout) renders nothing; a "Show overlay" button appears
  // in the sidebar. We mirror the value to a module-scope pub/sub so the
  // sidebar (mounted above PresentationProvider in the tree) can read + flip
  // it without us hoisting the provider.
  const [overlayHidden, setOverlayHiddenState] = useState(false);
  const hideOverlay = useCallback(() => {
    setOverlayHiddenState(true);
    publishOverlayHidden(true);
  }, []);
  const showOverlay = useCallback(() => {
    setOverlayHiddenState(false);
    publishOverlayHidden(false);
  }, []);
  // Reset visibility when the active role changes (entering a new demo deck
  // should start with the overlay visible again).
  useEffect(() => {
    setOverlayHiddenState(false);
    publishOverlayHidden(false);
  }, [activeRole?.key]);
  // Subscribe to the pub/sub so external callers (e.g. the "Show overlay"
  // button in the Sidebar, which sits above this provider in the React tree
  // and can't reach into context) can flip the state and have the overlay
  // react. Without this, the sidebar button would update the pub/sub flag
  // but our local React state would stay stale.
  useEffect(() => {
    const unsubscribe = subscribeOverlayVisibility((next) => {
      setOverlayHiddenState(next);
    });
    return unsubscribe;
  }, []);

  // Sync from URL on mount. Two sources, in priority order:
  //   1. router.query.slide — the new path-based deep-link form
  //      (/presentation/<role>/<pageSlug>/<slide>) populates this.
  //   2. window.location.hash — the legacy ?role=...#slide=X&step=Y form.
  // The hash also survives in the new URL once the user navigates between
  // slides/steps because the runner writes its position back to the hash.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathSlide = getQuerySlide(router.query.slide);
    if (Number.isFinite(pathSlide) && pathSlide >= 0) {
      setSlideIndex(Math.min(pathSlide, Math.max(slides.length - 1, 0)));
      const { step } = parseHash(window.location.hash);
      setStepIndex(step || 0);
      return;
    }
    const { slide, step } = parseHash(window.location.hash);
    if (slide) setSlideIndex(Math.min(slide, Math.max(slides.length - 1, 0)));
    if (step) setStepIndex(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.slide]);

  // Reset to slide 0 when the active role changes — different role, different deck.
  useEffect(() => {
    const pathSlide = getQuerySlide(router.query.slide);
    if (Number.isFinite(pathSlide) && pathSlide >= 0) return;
    setSlideIndex(0);
    setStepIndex(0);
  }, [activeRole?.key, router.query.slide]);

  // Persist to hash so refresh keeps position.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = `#slide=${slideIndex}&step=${stepIndex}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
  }, [slideIndex, stepIndex]);

  const replaceSlidePath = useCallback((targetSlideIndex, targetStepIndex = 0) => {
    if (!router.isReady || !activeRole?.key) return;
    const pathSlide = getQuerySlide(router.query.slide);
    if (pathSlide === targetSlideIndex) return;

    const route = activeRole.routes?.[targetSlideIndex];
    if (!route) return;

    const hash = `#slide=${targetSlideIndex}&step=${targetStepIndex}`;
    router.replace(
      `/presentation/${activeRole.key}/${routeToSlug(route)}/${targetSlideIndex}${hash}`,
      undefined,
      { shallow: false }
    );
  }, [activeRole?.key, activeRole?.routes, router, router.isReady, router.query.slide]);

  const currentSlide = slides[slideIndex] || null;
  const currentSteps = useMemo(() => currentSlide?.steps || [], [currentSlide]);
  const currentStep = currentSteps[stepIndex] || null;

  useEffect(() => {
    if (slides.length === 0) return;
    setSlideIndex((index) => Math.min(Math.max(index, 0), slides.length - 1));
  }, [slides.length]);

  useEffect(() => {
    if (currentSteps.length === 0) {
      setStepIndex(0);
      return;
    }
    setStepIndex((index) => Math.min(Math.max(index, 0), currentSteps.length - 1));
  }, [currentSteps.length]);

  const next = useCallback(() => {
    const stepsLen = currentSteps.length;
    if (stepIndex < stepsLen - 1) {
      setStepIndex((i) => i + 1);
    } else if (slideIndex < slides.length - 1) {
      const target = slideIndex + 1;
      replaceSlidePath(target, 0);
      setSlideIndex(target);
      setStepIndex(0);
    }
  }, [stepIndex, currentSteps.length, slideIndex, slides.length, replaceSlidePath]);

  const prev = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else if (slideIndex > 0) {
      const newSlideIdx = slideIndex - 1;
      const prevSteps = slides[newSlideIdx]?.steps || [];
      const targetStep = Math.max(prevSteps.length - 1, 0);
      replaceSlidePath(newSlideIdx, targetStep);
      setSlideIndex(newSlideIdx);
      setStepIndex(targetStep);
    }
  }, [stepIndex, slideIndex, slides, replaceSlidePath]);

  const jumpSlide = useCallback((delta) => {
    if (slides.length === 0) return;
    const target = Math.min(Math.max(slideIndex + delta, 0), slides.length - 1);
    replaceSlidePath(target, 0);
    setSlideIndex(target);
    setStepIndex(0);
  }, [slideIndex, slides.length, replaceSlidePath]);

  const goToSlide = useCallback((id) => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx >= 0) {
      replaceSlidePath(idx, 0);
      setSlideIndex(idx);
      setStepIndex(0);
    }
  }, [slides, replaceSlidePath]);

  const exit = useCallback(() => {
    if (!canExit) return;
    // When a presentation role is active, exiting goes back to the picker.
    if (activeRole) {
      router.push("/loginPresentation");
      return;
    }
    // Return to the page that launched Presentation Mode, with sensible
    // fallbacks for direct loads and old bookmarks.
    if (typeof window !== "undefined") {
      const returnTo = window.sessionStorage.getItem(RETURN_TO_STORAGE_KEY);
      window.sessionStorage.removeItem(RETURN_TO_STORAGE_KEY);
      if (returnTo && !returnTo.startsWith("/presentation")) {
        router.push(returnTo);
        return;
      }
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }, [canExit, activeRole, router]);

  const toggleDevOverlay = useCallback(() => setDevOverlayOn(false), []);

  const value = useMemo(() => ({
    slides,
    slideIndex,
    stepIndex,
    currentSlide,
    currentStep,
    currentSteps,
    next,
    prev,
    jumpSlide,
    goToSlide,
    exit,
    isPublicViewer,
    canExit,
    authLoading: loading,
    devOverlayOn,
    toggleDevOverlay,
    userRoles,
    activeRole,
    overlayHidden,
    hideOverlay,
    showOverlay,
  }), [slides, slideIndex, stepIndex, currentSlide, currentStep, currentSteps, next, prev, jumpSlide, goToSlide, exit, isPublicViewer, canExit, loading, devOverlayOn, toggleDevOverlay, userRoles, activeRole, overlayHidden, hideOverlay, showOverlay]);

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation() {
  const ctx = useContext(PresentationContext);
  if (!ctx) throw new Error("usePresentation must be used inside PresentationProvider");
  return ctx;
}
