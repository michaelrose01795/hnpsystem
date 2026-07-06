// file location: src/hooks/useKeyboardShortcuts.js
//
// Consistent app-wide keyboard shortcuts (Phase 3.5). A single global keydown
// handler that matches events against the central registry and dispatches to the
// handler map it's given, so shortcuts behave identically everywhere and there's
// exactly one listener (no per-feature key handling to drift).
//
// Respects focus: bare-key shortcuts (/, ?) never fire while typing in a field;
// modifier chords (Cmd/Ctrl+K etc.) may, when the shortcut opts in.

import { useEffect, useRef } from "react";
import { matchShortcut } from "@/config/topbar/keyboardShortcuts";

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

// handlers: { [shortcutId]: () => void }
export function useKeyboardShortcuts(handlers, { enabled = true } = {}) {
  // Keep the latest handlers without re-subscribing the listener each render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      const handler = handlersRef.current?.[shortcut.id];
      if (typeof handler !== "function") return;
      if (!shortcut.allowInInput && isTypingTarget(event.target)) return;
      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

export default useKeyboardShortcuts;
