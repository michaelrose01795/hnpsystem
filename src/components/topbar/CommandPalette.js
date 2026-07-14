// file location: src/components/topbar/CommandPalette.js
//
// Universal command palette UI (Phase 3.1). A keyboard-first overlay that opens
// from anywhere (Cmd/Ctrl+K or "/") to quickly jump to a page, a record, a
// favourite/recent item, a contextual suggestion, or run an action.
//
// Presentational + self-contained interaction: it takes an already-built command
// list (see src/lib/topbar/commandPalette.js) and executes the chosen command by
// navigating (href) or invoking (run). It reuses the shared PopupModal so it
// inherits the app's borderless, token-driven overlay styling — no new chrome,
// no change to the top bar.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import PopupModal from "@/components/popups/popupStyleApi";
import { filterCommands, groupCommands } from "@/lib/topbar/commandPalette";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const KIND_LABEL = {
  page: "Page",
  action: "Action",
  record: "Record",
  favourite: "Favourite",
  recent: "Recent",
  suggestion: "Suggested",
};

export default function CommandPalette({
  isOpen = false,
  onClose,
  commands = [],
  // Optional { query, token } to pre-fill the input on open (recent-search
  // re-run). `token` changes even when the query repeats, so it always re-seeds.
  seed = null,
  // Called after a command is chosen (before navigation) so the parent can log
  // it to recent activity. Receives (command, query). Optional.
  onExecute,
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const seedToken = seed?.token || 0;

  // Reset transient state each time the palette opens, seeding from a requested
  // query (e.g. a recent search re-run) or clearing otherwise.
  useEffect(() => {
    if (isOpen) {
      setQuery(seed?.query || "");
      setActiveIndex(0);
      // Focus after the portal mounts.
      const id = window.requestAnimationFrame(() => inputRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    return undefined;
    // seedToken is intentionally a dep so re-opening with a new seed re-fills.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, seedToken]);

  const results = useMemo(
    () => filterCommands(commands, query, { limit: WORKSPACE_LIMITS.paletteResults }),
    [commands, query]
  );
  const groups = useMemo(() => groupCommands(results), [results]);

  // Keep activeIndex in range as the result set changes.
  useEffect(() => {
    setActiveIndex((i) => (results.length === 0 ? 0 : Math.min(i, results.length - 1)));
  }, [results.length]);

  const execute = (command) => {
    if (!command) return;
    onExecute?.(command, query);
    onClose?.();
    if (command.run) {
      command.run();
    } else if (command.href) {
      router.push(command.href);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(results[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
    }
  };

  // Scroll the active row into view when navigating with the keyboard.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isOpen) return null;

  // Flat index across groups, so keyboard highlight lines up with render order.
  let runningIndex = -1;

  return (
    <PopupModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Command palette"
      backdropStyle={{ alignItems: "flex-start", zIndex: 9999 }}
      cardStyle={{
        width: "min(100%, 640px)",
        marginTop: "12vh",
        maxHeight: "min(70vh, 560px)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search pages, records and actions…"
          aria-label="Search commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-list"
          style={{
            width: "100%",
            padding: "12px 14px",
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--text-1)",
            background: "var(--theme)",
            border: "none",
            borderRadius: "var(--radius-md)",
            outline: "none",
          }}
        />
      </div>

      <div
        id="command-palette-list"
        ref={listRef}
        role="listbox"
        aria-label="Command results"
        style={{ overflowY: "auto", padding: "0 8px 8px", minHeight: 0 }}
      >
        {results.length === 0 ? (
          <div
            style={{
              padding: "28px 16px",
              textAlign: "center",
              color: "var(--text-1)",
              opacity: 0.6,
              fontSize: "0.9rem",
            }}
          >
            No matches for “{query}”.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.section} style={{ marginBottom: "6px" }}>
              <div
                style={{
                  padding: "10px 12px 6px",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-1)",
                  opacity: 0.5,
                }}
              >
                {group.section}
              </div>
              {group.items.map((command) => {
                runningIndex += 1;
                const index = runningIndex;
                const active = index === activeIndex;
                return (
                  <button
                    key={command.id}
                    type="button"
                    data-cmd-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => execute(command)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderRadius: "var(--radius-md)",
                      background: active ? "var(--theme)" : "transparent",
                      color: "var(--text-1)",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: "1.4rem",
                        textAlign: "center",
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                    >
                      {command.icon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontWeight: 600,
                          fontSize: "0.92rem",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {command.title}
                      </span>
                      {command.subtitle && (
                        <span
                          style={{
                            display: "block",
                            fontSize: "0.72rem",
                            opacity: 0.6,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {command.subtitle}
                        </span>
                      )}
                    </span>
                    {command.shortcut ? (
                      <kbd
                        style={{
                          flexShrink: 0,
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "var(--control-radius-xs)",
                          background: active ? "var(--surface)" : "var(--theme)",
                          color: "var(--text-1)",
                          opacity: 0.8,
                        }}
                      >
                        {command.shortcut}
                      </kbd>
                    ) : (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: "0.62rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          opacity: 0.4,
                        }}
                      >
                        {KIND_LABEL[command.kind] || ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "16px",
          padding: "10px 16px",
          fontSize: "0.7rem",
          color: "var(--text-1)",
          opacity: 0.55,
          borderTop: "var(--separating-line)", // row rule between list + footer (allowed)
        }}
      >
        <span>↑↓ navigate</span>
        <span>↵ open</span>
        <span>esc close</span>
      </div>
    </PopupModal>
  );
}
