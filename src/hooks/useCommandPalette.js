// file location: src/hooks/useCommandPalette.js
//
// Command palette open/close controller (Phase 3.1). Owns just the visibility
// state + the event bridge; the keyboard triggers live in the central shortcut
// handler (Phase 3.5, src/hooks/useKeyboardShortcuts.js), and the command data +
// rendering live elsewhere, so this stays tiny and reusable.
//
// Driven by a global `hnp:command-palette` CustomEvent — detail is either a
// string ("open"|"close"|"toggle") or `{ action, query }` to open pre-filled — so
// any control (a shortcut, a menu, a button) can drive it without prop-drilling.

import { useCallback, useEffect, useState } from "react";

export const COMMAND_PALETTE_EVENT = "hnp:command-palette";

// Fire-and-forget opener other modules import instead of knowing about state.
// Pass a `query` to open the palette pre-filled (e.g. re-running a recent search).
export function openCommandPalette(query) {
  if (typeof window === "undefined") return;
  const detail = query ? { action: "open", query } : "open";
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT, { detail }));
}

export function useCommandPalette({ enabled = true } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  // The query to seed the input with on the next open (recent-search re-run).
  // Bumped via `token` so opening with the same query still re-seeds.
  const [seed, setSeed] = useState({ query: "", token: 0 });

  const open = useCallback((query = "") => {
    setSeed((s) => ({ query: query || "", token: s.token + 1 }));
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    const onEvent = (event) => {
      const detail = event?.detail;
      const action = typeof detail === "object" && detail ? detail.action : detail;
      if (action === "open") {
        const query = typeof detail === "object" && detail ? detail.query : "";
        setSeed((s) => ({ query: query || "", token: s.token + 1 }));
        setIsOpen(true);
      } else if (action === "close") {
        setIsOpen(false);
      } else {
        setIsOpen((v) => !v);
      }
    };

    window.addEventListener(COMMAND_PALETTE_EVENT, onEvent);
    return () => {
      window.removeEventListener(COMMAND_PALETTE_EVENT, onEvent);
    };
  }, [enabled]);

  // Force-close whenever the feature gets disabled (e.g. entering the demo).
  useEffect(() => {
    if (!enabled) setIsOpen(false);
  }, [enabled]);

  return { isOpen, open, close, toggle, seed };
}

export default useCommandPalette;
