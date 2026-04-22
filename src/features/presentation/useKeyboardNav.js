import { useEffect } from "react";
import { usePresentation } from "./PresentationProvider";

function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (typeof target.closest === "function") {
    return Boolean(target.closest("[contenteditable='true'], [role='combobox']"));
  }
  return false;
}

export default function useKeyboardNav() {
  const { next, prev, exit, toggleDevOverlay } = usePresentation();

  useEffect(() => {
    function handler(event) {
      if (isTypingTarget(event.target)) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      } else if (event.key === "Escape") {
        event.preventDefault();
        exit();
      } else if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        toggleDevOverlay();
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, exit, toggleDevOverlay]);
}
