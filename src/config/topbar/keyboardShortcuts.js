// file location: src/config/topbar/keyboardShortcuts.js
//
// Consistent app-wide keyboard shortcuts (Phase 3.5) — PURE registry + matcher.
// One source of truth for every global shortcut, its display combo, and its
// discoverable hint. No React/window — deterministic and unit-testable.
//
// `mod` means "the platform command key": Cmd on macOS, Ctrl elsewhere. The
// matcher treats metaKey OR ctrlKey as `mod` so both work everywhere.
//
// HOW TO ADD A SHORTCUT: add an entry here (id + trigger + label + category).
// The global handler (src/hooks/useKeyboardShortcuts.js) dispatches by id; the
// hints overlay (src/components/topbar/ShortcutHintsOverlay.js) lists it. Nothing
// else changes.

export const SHORTCUTS = [
  {
    id: "command-palette",
    label: "Open command palette",
    category: "Global",
    mod: true,
    key: "k",
    allowInInput: true, // explicit chord — safe to fire while typing
  },
  {
    id: "search",
    label: "Search everything",
    category: "Global",
    key: "/",
    allowInInput: false,
  },
  {
    id: "workspace-panel",
    label: "Open workspace panel",
    category: "Global",
    mod: true,
    key: "j",
    allowInInput: true,
  },
  {
    id: "team-workspace",
    label: "Open team workspace",
    category: "Global",
    mod: true,
    key: "u",
    allowInInput: true,
  },
  {
    id: "operational-assistant",
    label: "Open operational assistant",
    category: "Global",
    mod: true,
    key: "i",
    allowInInput: true,
  },
  {
    id: "favourite-page",
    label: "Favourite the current page",
    category: "Page",
    mod: true,
    key: "d",
    allowInInput: true,
  },
  {
    id: "shortcut-hints",
    label: "Show keyboard shortcuts",
    category: "Help",
    key: "?", // Shift+/ on most layouts; matched by character
    allowInInput: false,
  },
];

const BY_ID = new Map(SHORTCUTS.map((s) => [s.id, s]));

export function getShortcut(id) {
  return BY_ID.get(id) || null;
}

// Human-readable combo for display, platform-aware. `isMac` toggles ⌘ vs Ctrl.
export function formatCombo(shortcut, isMac = false) {
  if (!shortcut) return "";
  const parts = [];
  if (shortcut.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");
  const key = shortcut.key === "/" ? "/" : shortcut.key === "?" ? "?" : shortcut.key.toUpperCase();
  parts.push(key);
  return parts.join(isMac ? "" : "+");
}

// Does a KeyboardEvent match this shortcut? `mod` = metaKey OR ctrlKey.
export function shortcutMatches(shortcut, event) {
  if (!shortcut || !event) return false;
  const mod = event.metaKey || event.ctrlKey;
  if (shortcut.mod) {
    if (!mod) return false;
  } else if (mod) {
    return false; // a bare-key shortcut must not fire while mod is held
  }
  if (shortcut.shift && !event.shiftKey) return false;
  if (shortcut.alt && !event.altKey) return false;

  // Match by character for symbols ("/", "?"), by lowercased key for letters.
  const eventKey = event.key === undefined ? "" : String(event.key);
  if (shortcut.key === "/" || shortcut.key === "?") {
    return eventKey === shortcut.key;
  }
  return eventKey.toLowerCase() === shortcut.key.toLowerCase();
}

// First shortcut matching the event, or null. Callers decide whether to honour
// `allowInInput` for the current focus target.
export function matchShortcut(event) {
  for (const shortcut of SHORTCUTS) {
    if (shortcutMatches(shortcut, event)) return shortcut;
  }
  return null;
}

// Group shortcuts by category for the hints overlay, preserving first-seen order.
export function shortcutsByCategory() {
  const groups = new Map();
  for (const s of SHORTCUTS) {
    if (!groups.has(s.category)) groups.set(s.category, []);
    groups.get(s.category).push(s);
  }
  return Array.from(groups.entries()).map(([category, items]) => ({ category, items }));
}
