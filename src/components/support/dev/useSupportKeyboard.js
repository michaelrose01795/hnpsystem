// file location: src/components/support/dev/useSupportKeyboard.js
//
// Help & Diagnostics ("support") — Phase 6. Lightweight keyboard-shortcut hook
// for the Support Centre. Ignores keystrokes while the user is typing in an
// input/textarea/select/contenteditable so shortcuts never fight form entry.

import { useEffect } from "react";

const isTypingTarget = (el) => {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
};

/**
 * @param {Array<{ key: string, handler: (e: KeyboardEvent) => void, description?: string, when?: () => boolean }>} shortcuts
 * @param {boolean} [enabled]
 */
export function useSupportKeyboard(shortcuts = [], enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const onKey = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      for (const s of shortcuts) {
        if (s.key !== key) continue;
        if (typeof s.when === "function" && !s.when()) continue;
        e.preventDefault();
        s.handler(e);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts, enabled]);
}

export default useSupportKeyboard;
