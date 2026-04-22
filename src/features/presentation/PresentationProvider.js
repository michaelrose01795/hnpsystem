import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { buildSlidesForRole } from "./slides";

const PresentationContext = createContext(null);
const RETURN_TO_STORAGE_KEY = "presentation:returnTo";

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

export function PresentationProvider({ children }) {
  const { user } = useUser();
  const router = useRouter();

  const userRoles = useMemo(() => user?.roles || [], [user?.roles]);
  const slides = useMemo(() => buildSlidesForRole(userRoles), [userRoles]);

  const [slideIndex, setSlideIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [devOverlayOn, setDevOverlayOn] = useState(false);

  // Sync from hash on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const { slide, step } = parseHash(window.location.hash);
    if (slide) setSlideIndex(Math.min(slide, Math.max(slides.length - 1, 0)));
    if (step) setStepIndex(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist to hash so refresh keeps position.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = `#slide=${slideIndex}&step=${stepIndex}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", window.location.pathname + hash);
    }
  }, [slideIndex, stepIndex]);

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
      setSlideIndex((i) => i + 1);
      setStepIndex(0);
    }
  }, [stepIndex, currentSteps.length, slideIndex, slides.length]);

  const prev = useCallback(() => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    } else if (slideIndex > 0) {
      const newSlideIdx = slideIndex - 1;
      setSlideIndex(newSlideIdx);
      const prevSteps = slides[newSlideIdx]?.steps || [];
      setStepIndex(Math.max(prevSteps.length - 1, 0));
    }
  }, [stepIndex, slideIndex, slides]);

  const jumpSlide = useCallback((delta) => {
    if (slides.length === 0) return;
    const target = Math.min(Math.max(slideIndex + delta, 0), slides.length - 1);
    setSlideIndex(target);
    setStepIndex(0);
  }, [slideIndex, slides.length]);

  const goToSlide = useCallback((id) => {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx >= 0) {
      setSlideIndex(idx);
      setStepIndex(0);
    }
  }, [slides]);

  const exit = useCallback(() => {
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
  }, [router]);

  const toggleDevOverlay = useCallback(() => setDevOverlayOn((v) => !v), []);

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
    devOverlayOn,
    toggleDevOverlay,
    userRoles,
  }), [slides, slideIndex, stepIndex, currentSlide, currentStep, currentSteps, next, prev, jumpSlide, goToSlide, exit, devOverlayOn, toggleDevOverlay, userRoles]);

  return <PresentationContext.Provider value={value}>{children}</PresentationContext.Provider>;
}

export function usePresentation() {
  const ctx = useContext(PresentationContext);
  if (!ctx) throw new Error("usePresentation must be used inside PresentationProvider");
  return ctx;
}
