import { useEffect } from "react";
import { useSlideshow } from "./SlideshowProvider";

export default function useKeyboardNav({ onExport } = {}) {
  const { next, prev, jumpSlide, exit, toggleDevOverlay } = useSlideshow();

  useEffect(() => {
    function handler(e) {
      // Don't hijack typing inside real inputs on the mounted page.
      const target = e.target;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.shiftKey ? jumpSlide(1) : next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.shiftKey ? jumpSlide(-1) : prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        exit();
      } else if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        toggleDevOverlay();
      } else if (e.key === "e" || e.key === "E") {
        if (onExport) {
          e.preventDefault();
          onExport();
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, jumpSlide, exit, toggleDevOverlay, onExport]);
}
