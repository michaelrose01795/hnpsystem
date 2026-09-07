// file location: src/components/ui/GlobalContextMenu.js
// Global right-click (context) menu controller.
//
// Replaces the BROWSER's native right-click menu with a single in-app styled
// menu, so a right-click anywhere in the staff app looks like the rest of the
// app instead of like Chrome/Edge/Safari chrome. The menu carries the same
// content the native menu would offer for whatever was clicked (navigation,
// link actions, image actions, clipboard/editing actions, selection actions)
// and performs the same things.
//
// Styling lives entirely in src/styles/families/context-menu.css. The panel is
// a <LayerSurface> (§3.0 — surfaces are layer primitives) and every row is a
// real Secondary button (app-btn app-btn--secondary), so the menu follows
// staffglobal/theme automatically, everywhere.
//
// Opting OUT (keeps the real browser menu): put `data-native-contextmenu` on an
// element — the whole subtree under it is skipped. Shift+right-click does the
// same thing anywhere, which is the convention every editor uses.
//
// Mounted once from _app.js (alongside GlobalTooltip / CookieBanner).

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/router";
import LayerSurface from "@/components/ui/LayerSurface";

const VIEWPORT_PAD = 8; // px — keep the menu this far from the viewport edge
const NATIVE_OPT_OUT = "[data-native-contextmenu]";
const PANEL_ID = "app-context-menu-panel";
const SEPARATOR = { type: "separator" };

// Cmd on macOS, Ctrl everywhere else — the shortcut hints have to match what
// the user's own keyboard actually does, as the native menu's do.
function modKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Cmd" : "Ctrl";
}

function isTextEntry(el) {
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  const type = (el.type || "text").toLowerCase();
  return !["checkbox", "radio", "button", "submit", "reset", "file", "image", "range", "color"].includes(type);
}

function truncate(text, max = 24) {
  const clean = String(text).replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Reads the selection the way the native menu does: the field's own selection
// when a text control was clicked, otherwise the document selection.
function readSelection(target) {
  if (isTextEntry(target) && "selectionStart" in target) {
    const { selectionStart, selectionEnd, value } = target;
    if (selectionStart != null && selectionEnd != null && selectionEnd > selectionStart) {
      return String(value).slice(selectionStart, selectionEnd);
    }
    return "";
  }
  if (typeof window === "undefined") return "";
  return String(window.getSelection ? window.getSelection() : "");
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// execCommand is deprecated but remains the ONLY API that mutates a focused
// field's value while keeping the browser's native undo stack intact — which is
// exactly what the native Cut/Paste/Undo entries do. The modern clipboard API
// is tried first where it works; this is the fallback that preserves behaviour.
function exec(command, value) {
  try {
    return document.execCommand(command, false, value);
  } catch {
    return false;
  }
}

export default function GlobalContextMenu() {
  const router = useRouter();
  const [menu, setMenu] = useState(null); // { x, y, items }
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const targetRef = useRef(null); // element that was right-clicked (focus restore)

  const close = useCallback(() => {
    setMenu(null);
    setVisible(false);
    setActiveIndex(-1);
  }, []);

  // ------------------------------------------------------------------ items
  // Mirrors what the browser would have offered for this target, in the same
  // grouping order: context-specific actions first, then editing, then page.
  const buildItems = useCallback(
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const mod = modKey();
      const link = target && target.closest ? target.closest("a[href]") : null;
      const image = target && target.closest ? target.closest("img[src]") : null;
      const editable = isTextEntry(target)
        ? target
        : (target && target.closest ? target.closest('[contenteditable="true"]') : null);
      const selection = readSelection(target);
      const items = [];

      if (link) {
        const href = link.href;
        items.push(
          {
            label: "Open link in new tab",
            icon: "↗",
            onSelect: () => window.open(href, "_blank", "noopener,noreferrer"),
          },
          {
            label: "Open link in new window",
            icon: "⧉",
            onSelect: () => window.open(href, "_blank", "noopener,noreferrer,popup=yes"),
          },
          { label: "Copy link address", icon: "⚭", onSelect: () => writeClipboard(href) },
          SEPARATOR
        );
      }

      if (image) {
        const src = image.currentSrc || image.src;
        items.push(
          {
            label: "Open image in new tab",
            icon: "↗",
            onSelect: () => window.open(src, "_blank", "noopener,noreferrer"),
          },
          { label: "Copy image address", icon: "⚭", onSelect: () => writeClipboard(src) },
          {
            label: "Save image as…",
            icon: "⤓",
            onSelect: () => {
              const anchor = document.createElement("a");
              anchor.href = src;
              anchor.download = (src.split("/").pop() || "image").split("?")[0];
              anchor.rel = "noopener";
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
            },
          },
          SEPARATOR
        );
      }

      if (editable) {
        const readOnly = Boolean(editable.readOnly || editable.disabled);
        items.push(
          {
            label: "Undo",
            icon: "↶",
            shortcut: `${mod}+Z`,
            disabled: readOnly,
            onSelect: () => {
              editable.focus();
              exec("undo");
            },
          },
          {
            label: "Redo",
            icon: "↷",
            shortcut: `${mod}+Shift+Z`,
            disabled: readOnly,
            onSelect: () => {
              editable.focus();
              exec("redo");
            },
          },
          SEPARATOR,
          {
            label: "Cut",
            icon: "✂",
            shortcut: `${mod}+X`,
            disabled: readOnly || !selection,
            onSelect: async () => {
              editable.focus();
              if (!exec("cut")) {
                await writeClipboard(selection);
                exec("insertText", "");
              }
            },
          },
          {
            label: "Copy",
            icon: "⧉",
            shortcut: `${mod}+C`,
            disabled: !selection,
            onSelect: async () => {
              editable.focus();
              if (!(await writeClipboard(selection))) exec("copy");
            },
          },
          {
            label: "Paste",
            icon: "⤓",
            shortcut: `${mod}+V`,
            disabled: readOnly,
            onSelect: async () => {
              editable.focus();
              try {
                const text = await navigator.clipboard.readText();
                // insertText keeps the browser's own undo stack; setRangeText is
                // the fallback for browsers that reject the command.
                if (!exec("insertText", text) && "setRangeText" in editable) {
                  const start = editable.selectionStart != null ? editable.selectionStart : editable.value.length;
                  const end = editable.selectionEnd != null ? editable.selectionEnd : start;
                  editable.setRangeText(text, start, end, "end");
                  editable.dispatchEvent(new Event("input", { bubbles: true }));
                }
              } catch {
                // Clipboard read blocked by browser permission — fall back to
                // the paste command, which some browsers still honour.
                exec("paste");
              }
            },
          },
          SEPARATOR,
          {
            label: "Select all",
            icon: "▤",
            shortcut: `${mod}+A`,
            onSelect: () => {
              editable.focus();
              if (typeof editable.select === "function") editable.select();
              else exec("selectAll");
            },
          },
          SEPARATOR
        );
      } else if (selection) {
        items.push(
          { label: "Copy", icon: "⧉", shortcut: `${mod}+C`, onSelect: () => writeClipboard(selection) },
          {
            label: `Search the web for “${truncate(selection)}”`,
            icon: "⌕",
            onSelect: () =>
              window.open(
                `https://www.google.com/search?q=${encodeURIComponent(selection)}`,
                "_blank",
                "noopener,noreferrer"
              ),
          },
          SEPARATOR
        );
      }

      // Page-level group — always present, exactly as in the native menu.
      items.push(
        { label: "Back", icon: "←", shortcut: "Alt+←", onSelect: () => router.back() },
        { label: "Forward", icon: "→", shortcut: "Alt+→", onSelect: () => window.history.forward() },
        { label: "Reload", icon: "⟳", shortcut: `${mod}+R`, onSelect: () => router.reload() },
        SEPARATOR
      );

      if (!editable) {
        items.push({ label: "Select all", icon: "▤", shortcut: `${mod}+A`, onSelect: () => exec("selectAll") });
      }
      items.push({ label: "Print…", icon: "⎙", shortcut: `${mod}+P`, onSelect: () => window.print() });

      // Drop separators that ended up leading, trailing, or doubled.
      return items.filter((item, index, all) => {
        if (item.type !== "separator") return true;
        if (index === 0 || index === all.length - 1) return false;
        return all[index - 1] && all[index - 1].type !== "separator";
      });
    },
    [router]
  );

  // --------------------------------------------------------------- listeners
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onContextMenu = (event) => {
      // Shift+right-click is the universal "give me the real browser menu"
      // escape hatch that dev tooling relies on. Honour it.
      if (event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      // Right-clicking the menu itself just swallows the event — the open menu
      // stays put rather than re-opening on top of itself.
      if (target && target.closest && target.closest(`#${PANEL_ID}`)) {
        event.preventDefault();
        return;
      }
      if (target && target.closest && target.closest(NATIVE_OPT_OUT)) return;
      event.preventDefault();
      targetRef.current = target;
      setMenu({ x: event.clientX, y: event.clientY, items: buildItems(event) });
      setActiveIndex(-1);
      setVisible(false);
    };

    const onPointerDown = (event) => {
      const panel = document.getElementById(PANEL_ID);
      if (panel && panel.contains(event.target)) return;
      close();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [buildItems, close]);

  // Close on route change so the menu never survives a navigation.
  useEffect(() => {
    if (!router.events) return undefined;
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events, close]);

  // Position AFTER mount so the real measured size can be clamped into the
  // viewport — a menu opened near the bottom edge flips up, as a native one does.
  useEffect(() => {
    if (!menu) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const { width, height } = panel.getBoundingClientRect();
    const maxX = window.innerWidth - width - VIEWPORT_PAD;
    const maxY = window.innerHeight - height - VIEWPORT_PAD;
    panel.style.left = `${Math.max(VIEWPORT_PAD, Math.min(menu.x, maxX))}px`;
    panel.style.top = `${Math.max(VIEWPORT_PAD, Math.min(menu.y, maxY))}px`;
    setVisible(true);
    panel.focus();
  }, [menu]);

  const run = useCallback(
    (item) => {
      close();
      // Let the menu unmount first so focus/selection is back on the page before
      // the action reads it — Cut/Copy/Paste all depend on that.
      setTimeout(() => {
        try {
          item.onSelect();
        } catch {
          /* an action failing must never take the app down */
        }
      }, 0);
    },
    [close]
  );

  const onKeyDown = (event) => {
    if (!menu) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      if (targetRef.current && targetRef.current.focus) targetRef.current.focus();
      return;
    }
    const selectable = menu.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type !== "separator" && !item.disabled);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!selectable.length) return;
      const current = selectable.findIndex(({ index }) => index === activeIndex);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = (current + step + selectable.length) % selectable.length;
      setActiveIndex(selectable[next].index);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      const chosen = menu.items[activeIndex];
      if (chosen && chosen.type !== "separator" && !chosen.disabled) {
        event.preventDefault();
        run(chosen);
      }
    }
  };

  if (!menu || typeof document === "undefined") return null;

  return createPortal(
    <LayerSurface
      id={PANEL_ID}
      role="menu"
      tabIndex={-1}
      aria-label="Context menu"
      className={`app-context-menu${visible ? " is-visible" : ""}`}
      radius="var(--control-menu-radius)"
      padding="8px"
      // 8px between rows — the rows are full Secondary buttons now, so they
      // need real breathing space rather than sitting flush like list items.
      gap="8px"
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      {menu.items.map((item, index) =>
        item.type === "separator" ? (
          <div key={`sep-${index}`} className="app-context-menu__separator" role="separator" />
        ) : (
          <button
            key={`${item.label}-${index}`}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            className={`app-btn app-btn--secondary app-context-menu__item${
              index === activeIndex ? " is-highlighted" : ""
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => run(item)}
          >
            <span className="app-context-menu__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="app-context-menu__label">{item.label}</span>
            {item.shortcut ? <span className="app-context-menu__shortcut">{item.shortcut}</span> : null}
          </button>
        )
      )}
    </LayerSurface>,
    document.body
  );
}
