import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { ALL_SLIDES, buildSlidesForRole } from "./slides";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";
import {
  isOverlayHidden,
  setOverlayHidden as publishOverlayHidden,
  clearOverlayHidden,
  subscribeOverlayVisibility,
} from "./runtime/overlayVisibility";
import { consumePresentationNext } from "./runtime/presentationNextHook";

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

function routeToLabel(route) {
  const [path, query = ""] = String(route || "").split("?");
  const label = (path.replace(/^\//, "") || "home")
    .split("/")
    .map((part) =>
      part
        .replace(/\[|\]/g, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase())
    )
    .join(" / ");
  return query ? `${label} (${query.replace(/=/g, ": ").replace(/&/g, ", ")})` : label;
}

function routeMatches(template, candidate) {
  const [templatePath, templateQuery = ""] = String(template || "").split("#")[0].split("?");
  const [candidatePath, candidateQuery = ""] = String(candidate || "").split("#")[0].split("?");
  if (templateQuery !== candidateQuery) return false;
  if (!templatePath.includes("[")) return templatePath === candidatePath;
  const pattern = new RegExp(
    "^" + templatePath.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
  );
  return pattern.test(candidatePath);
}

function buildSlidesFromPresentationRole(role, allSlides) {
  return (role?.routes || []).map((route, index) => {
    const slide = allSlides.find((candidate) => routeMatches(route, candidate.route));
    if (slide) return slide;
    return {
      id: `presentation-${role.key}-${index}`,
      route,
      title: routeToLabel(route),
      roles: null,
      workflowIndex: index,
      steps: [
        {
          kind: "main",
          position: "center",
          title: routeToLabel(route),
          body: "This presentation page uses the real app screen with demo data.",
        },
      ],
    };
  });
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
      return buildSlidesFromPresentationRole(activeRole, ALL_SLIDES);
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
  // Starts false to match SSR; the mount effect below syncs it from the
  // persisted flag so a mid-presentation reload keeps the overlay hidden and
  // "Show overlay" resumes the deck from exactly where the presenter left off.
  const [overlayHidden, setOverlayHiddenState] = useState(false);
  const hideOverlay = useCallback(() => {
    setOverlayHiddenState(true);
    publishOverlayHidden(true);
  }, []);
  const showOverlay = useCallback(() => {
    setOverlayHiddenState(false);
    publishOverlayHidden(false);
  }, []);
  // Reset visibility only on a genuine deck switch (one role → a different
  // role). The first time the role resolves on mount we keep the persisted
  // hidden state, otherwise a reload would always force the overlay back on.
  const prevRoleKeyRef = useRef(activeRole?.key ?? null);
  useEffect(() => {
    const currentKey = activeRole?.key ?? null;
    if (prevRoleKeyRef.current === currentKey) return;
    const hadPreviousRole = Boolean(prevRoleKeyRef.current);
    prevRoleKeyRef.current = currentKey;
    if (!hadPreviousRole) return;
    setOverlayHiddenState(false);
    publishOverlayHidden(false);
  }, [activeRole?.key]);
  // Subscribe to the pub/sub so external callers (e.g. the "Show overlay"
  // button in the Sidebar, which sits above this provider in the React tree
  // and can't reach into context) can flip the state and have the overlay
  // react. Without this, the sidebar button would update the pub/sub flag
  // but our local React state would stay stale.
  useEffect(() => {
    // Sync the persisted flag on mount (covers a reload or a remount that
    // happened while the overlay was hidden), then track future toggles.
    setOverlayHiddenState(isOverlayHidden());
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
  }, [activeRole?.key, activeRole?.routes, router]);

  const currentSlide = slides[slideIndex] || null;
  // Every slide ends with a synthetic "break" step: the Overview popup with no
  // highlighted section, docked clear of the page content, so the presenter can
  // show the whole screen before advancing to the next page.
  const currentSteps = useMemo(() => {
    const baseSteps = currentSlide?.steps || [];
    if (baseSteps.length === 0) return baseSteps;
    const breakStep = {
      kind: "main",
      isBreak: true,
      anchor: null,
      title: currentSlide?.title || "Full page",
      body:
        "Full page view — no section is highlighted. Take a moment to review the whole screen, then press Next to continue.",
      // Default resting spot for the break popup; a slide may override it.
      defaultPosition: currentSlide?.breakPosition || "bottom-left",
    };
    return [...baseSteps, breakStep];
  }, [currentSlide]);
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
    // A page may register a blocking step (e.g. the personal dashboard unlock
    // popup). If it consumes this Next press, the deck stays put for this click.
    if (consumePresentationNext()) return;
    const stepsLen = currentSteps.length;
    if (stepIndex < stepsLen - 1) {
      setStepIndex((i) => i + 1);
    } else if (slideIndex < slides.length - 1) {
      const target = slideIndex + 1;
      replaceSlidePath(target, 0);
      setSlideIndex(target);
      setStepIndex(0);
    } else if (activeRole) {
      router.push("/loginPresentation");
    }
  }, [stepIndex, currentSteps.length, slideIndex, slides.length, replaceSlidePath, activeRole, router]);

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
    // Leaving the presentation — drop the persisted overlay-hidden flag so the
    // next session starts with the overlay visible.
    clearOverlayHidden();
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
    router.push("/newsfeed");
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
