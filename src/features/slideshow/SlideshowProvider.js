import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { buildSlidesForRole } from "./slides";

const SlideshowContext = createContext(null);

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

export function SlideshowProvider({ children }) {
  const { user } = useUser();
  const router = useRouter();

  const userRoles = user?.roles || [];
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
  const currentSteps = currentSlide?.steps || [];
  const currentStep = currentSteps[stepIndex] || null;

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
    // Return the user to whatever page they were on when they opened the
    // slideshow. Falls back to browser-history back(), and finally to /dashboard
    // if neither is available (e.g. direct load of /slideshow).
    if (typeof window !== "undefined") {
      const returnTo = window.sessionStorage.getItem("slideshow:returnTo");
      window.sessionStorage.removeItem("slideshow:returnTo");
      if (returnTo && !returnTo.startsWith("/slideshow")) {
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

  return <SlideshowContext.Provider value={value}>{children}</SlideshowContext.Provider>;
}

export function useSlideshow() {
  const ctx = useContext(SlideshowContext);
  if (!ctx) throw new Error("useSlideshow must be used inside SlideshowProvider");
  return ctx;
}
