// file location: src/components/topbar/ShortcutHintsOverlay.js
//
// Keyboard shortcuts help (Phase 3.5). A discoverable overlay — opened with "?"
// — listing every global shortcut grouped by category, with platform-aware
// combos. Reuses the shared PopupModal so it inherits the borderless, token-
// driven overlay styling; adds no chrome to the top bar.

import React, { useMemo } from "react";
import PopupModal from "@/components/popups/popupStyleApi";
import { shortcutsByCategory, formatCombo } from "@/config/topbar/keyboardShortcuts";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export default function ShortcutHintsOverlay({ isOpen = false, onClose }) {
  useEscapeKey(onClose, isOpen);
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || "");
  }, []);
  const groups = useMemo(() => shortcutsByCategory(), []);

  if (!isOpen) return null;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Keyboard shortcuts"
      cardStyle={{
        width: "min(100%, 460px)",
        padding: "20px 22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "16px" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="app-btn app-btn--ghost"
          aria-label="Close keyboard shortcuts"
        >
          Close
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {groups.map((group) => (
          <div key={group.category}>
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-1)",
                opacity: 0.5,
                marginBottom: "6px",
              }}
            >
              {group.category}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {group.items.map((shortcut) => (
                <div
                  key={shortcut.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    padding: "8px 2px",
                    borderBottom: "var(--separating-line)", // list row rule (allowed)
                  }}
                >
                  <span style={{ fontSize: "0.88rem", color: "var(--text-1)" }}>
                    {shortcut.label}
                  </span>
                  <kbd
                    style={{
                      flexShrink: 0,
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "var(--control-radius-xs)",
                      background: "var(--theme)",
                      color: "var(--text-1)",
                    }}
                  >
                    {formatCombo(shortcut, isMac)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PopupModal>
  );
}
