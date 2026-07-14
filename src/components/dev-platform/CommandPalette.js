// file location: src/components/dev-platform/CommandPalette.js
//
// Phase 10 — the Developer Platform command palette + global quick actions.
// Ctrl/⌘-K opens a searchable palette of navigation + actions; ↑/↓ move, Enter
// runs, Esc closes. The command model + fuzzy ranking are the PURE
// commandPalette engine; this component is just the overlay + keyboard wiring.
//
// CLAUDE.md: the overlay panel is a <LayerSurface> (borderless, tokens); the
// backdrop is a scrim (not a card). 44px targets, focus ring via box-shadow,
// full keyboard operation + ARIA (role="dialog" / listbox).

import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";
import { buildDefaultCommands, searchCommands } from "@/lib/dev-platform/commandPalette";
import { toneTint } from "@/components/support/dev/supportDevUi";

const PaletteContext = createContext({ open: () => {}, close: () => {} });

export function useCommandPalette() {
  return useContext(PaletteContext);
}

// Extra platform quick actions beyond plain navigation. `close` is injected so
// an action can dismiss the palette; router is used for parametrised nav.
function buildQuickActions(router, close) {
  const go = (href) => {
    close();
    router.push(href);
  };
  return [
    { id: "action:new-report", title: "Report a problem (open reporter)", subtitle: "Opens the Help & Diagnostics reporter", group: "Actions", keywords: ["report", "bug", "new", "help"], run: () => { close(); router.push("/newsfeed?support=1"); } },
    { id: "action:refresh", title: "Refresh this page", subtitle: "Reload the current dashboard's data", group: "Actions", keywords: ["refresh", "reload"], run: () => { close(); router.reload(); } },
    { id: "action:knowledge-new", title: "New knowledge entry", subtitle: "Document a recurring incident", group: "Actions", keywords: ["knowledge", "doc", "write"], run: () => go("/dev/knowledge?new=1") },
    { id: "action:exit", title: "Exit to app", subtitle: "Leave the Developer Platform", group: "Actions", keywords: ["exit", "leave", "app"], run: () => go("/newsfeed") },
  ];
}

export function CommandPaletteProvider({ children }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);
  const openPalette = useCallback(() => setOpen(true), []);

  const commands = useMemo(() => {
    const navigate = (href) => {
      close();
      router.push(href);
    };
    return buildDefaultCommands({ navigate, actions: buildQuickActions(router, close) });
  }, [router, close]);

  const results = useMemo(() => searchCommands(commands, query, { limit: 12 }), [commands, query]);

  // Global Ctrl/⌘-K toggle.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const onInputKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[active];
      if (cmd?.run) cmd.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const ctx = useMemo(() => ({ open: openPalette, close }), [openPalette, close]);

  return (
    <PaletteContext.Provider value={ctx}>
      {children}
      {open && (
        <div
          role="presentation"
          onMouseDown={close}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: "var(--z-modal)",
            background: "color-mix(in srgb, #000 55%, transparent)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "10vh 16px 16px",
          }}
        >
          <LayerSurface
            role="dialog"
            aria-label="Command palette"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ width: "min(640px, 100%)", gap: "var(--space-sm)", maxHeight: "70vh" }}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Search commands… (arrow keys to move, Enter to run, Esc to close)"
              aria-label="Search commands"
              className="app-input"
              style={{
                width: "100%",
                minHeight: 44,
                padding: "10px 12px",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-body)",
                background: "var(--theme)",
                color: "var(--text-1)",
              }}
            />
            <ul
              role="listbox"
              aria-label="Commands"
              style={{ listStyle: "none", margin: 0, padding: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}
            >
              {results.length === 0 ? (
                <li style={{ padding: "12px", fontSize: "var(--text-body-sm)", color: "var(--text-1)", opacity: 0.7 }}>
                  No matching commands.
                </li>
              ) : (
                results.map((cmd, i) => (
                  <li
                    key={cmd.id}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => cmd.run && cmd.run()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minHeight: 44,
                      padding: "8px 12px",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      background: i === active ? toneTint("accentText", 14) : "transparent",
                    }}
                  >
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: "var(--text-body-sm)", fontWeight: 600, color: i === active ? "var(--accentText)" : "var(--text-1)" }}>{cmd.title}</span>
                      {cmd.subtitle ? (
                        <span style={{ fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cmd.subtitle}</span>
                      ) : null}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: "var(--text-body-xs)", color: "var(--text-1)", opacity: 0.4 }}>{cmd.group}</span>
                  </li>
                ))
              )}
            </ul>
          </LayerSurface>
        </div>
      )}
    </PaletteContext.Provider>
  );
}

export default CommandPaletteProvider;
