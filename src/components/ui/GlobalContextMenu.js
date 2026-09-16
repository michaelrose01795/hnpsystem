// file location: src/components/ui/GlobalContextMenu.js
// Global right-click (context) menu controller.
//
// Replaces the BROWSER's native right-click menu with a single in-app styled
// menu, so a right-click anywhere in the app looks like the rest of the app
// instead of like Chrome/Edge/Safari chrome. The menu carries the same content
// the native menu would offer for whatever was clicked (navigation, link
// actions, image actions, clipboard/editing actions, selection actions) and
// performs the same things.
//
// Two skins, one controller:
//   staff    — styled entirely by src/styles/families/context-menu.css. The
//              panel is a <LayerSurface> (§3.0) and every row is a real
//              Secondary button (app-btn app-btn--secondary).
//   /website — styled by `@family context-menu` in src/styles/custglobal.css.
//              The staff family is gated on html.staff-scope and `.app-btn` is
//              the PRIMARY action under the customer scope, so the website skin
//              renders its own classes: a floating panel and raw <button> rows
//              (the customer secondary control). It also adds a "Jump to" row
//              whose hover submenu lists the sections of the current page.
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
const SUBMENU_GAP = 6; // px — space between a row and the submenu it opens
const SUBMENU_CLOSE_DELAY = 180; // ms — grace period to travel from a row into its submenu
const NATIVE_OPT_OUT = "[data-native-contextmenu]";
const PANEL_ID = "app-context-menu-panel";
const SUBMENU_ID = "app-context-menu-submenu";
const SEPARATOR = { type: "separator" };
// Jump-to targets: every anchored section on the page, plus anything that opts
// in explicitly. Structural on purpose, so new website pages need no wiring.
const JUMP_TARGETS = "section[id], [data-website-jump]";

// Cmd on macOS, Ctrl everywhere else — the shortcut hints have to match what
// the user's own keyboard actually does, as the native menu's do.
function modKey() {
  if (typeof navigator === "undefined") return "Ctrl";
  const platform = `${navigator.platform || ""} ${navigator.userAgent || ""}`;
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? "Cmd" : "Ctrl";
}

function isWebsiteScope() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("website-scope");
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
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

// "parts-catalog" → "Parts catalog" — last-resort label for an unlabelled section.
function humaniseId(id) {
  const words = String(id || "").replace(/[-_]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "";
}

// Best human label for a section, in order: explicit opt-in label, aria-label,
// the element aria-labelledby points at, the section's first heading, its id.
function jumpLabel(el) {
  const explicit = el.getAttribute("data-website-jump");
  if (explicit && explicit !== "true") return truncate(explicit, 40);
  const aria = el.getAttribute("aria-label");
  if (aria) return truncate(aria, 40);
  const labelledBy = el.getAttribute("aria-labelledby");
  const labelEl = labelledBy ? document.getElementById(labelledBy.split(/\s+/)[0]) : null;
  if (labelEl && labelEl.textContent.trim()) return truncate(labelEl.textContent, 40);
  const heading = el.querySelector("h1, h2, h3");
  if (heading && heading.textContent.trim()) return truncate(heading.textContent, 40);
  return humaniseId(el.id);
}

// Top-level sections of the current page, in document order. A section inside
// one that is already listed is skipped, so the list stays a page outline
// rather than every card. Hidden sections (display:none, collapsed) are skipped.
function collectJumpTargets() {
  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  const listed = [];
  const items = [];
  document.querySelectorAll(JUMP_TARGETS).forEach((el) => {
    if (el.closest(`#${PANEL_ID}, #${SUBMENU_ID}, [data-dev-overlay-internal]`)) return;
    if (listed.some((parent) => parent.contains(el))) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    const label = jumpLabel(el);
    if (!label) return;
    listed.push(el);
    items.push({ label, onSelect: () => el.scrollIntoView({ behavior, block: "start" }) });
  });
  return [
    { label: "Top of page", onSelect: () => window.scrollTo({ top: 0, behavior }) },
    ...items,
  ];
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

// Clamp a panel's top-left into the viewport and apply it.
function placePanel(panel, x, y) {
  const { width, height } = panel.getBoundingClientRect();
  const maxX = window.innerWidth - width - VIEWPORT_PAD;
  const maxY = window.innerHeight - height - VIEWPORT_PAD;
  panel.style.left = `${Math.max(VIEWPORT_PAD, Math.min(x, maxX))}px`;
  panel.style.top = `${Math.max(VIEWPORT_PAD, Math.min(y, maxY))}px`;
}

export default function GlobalContextMenu() {
  const router = useRouter();
  const [menu, setMenu] = useState(null); // { x, y, items, website }
  const [visible, setVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Open submenu: { index, items, anchor: DOMRect of the row that opened it }
  const [submenu, setSubmenu] = useState(null);
  const [subActiveIndex, setSubActiveIndex] = useState(-1);
  const targetRef = useRef(null); // element that was right-clicked (focus restore)
  const closeTimerRef = useRef(null);

  const cancelSubmenuClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeSubmenu = useCallback(() => {
    cancelSubmenuClose();
    setSubmenu(null);
    setSubActiveIndex(-1);
  }, [cancelSubmenuClose]);

  const close = useCallback(() => {
    closeSubmenu();
    setMenu(null);
    setVisible(false);
    setActiveIndex(-1);
  }, [closeSubmenu]);

  // ------------------------------------------------------------------ items
  // Mirrors what the browser would have offered for this target, in the same
  // grouping order: context-specific actions first, then editing, then page.
  const buildItems = useCallback(
    (event, website) => {
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

      // /website only: jump to a section of the current page. The list is read
      // now, when the menu opens, so it always matches what is on screen.
      if (website) {
        items.push({ label: "Jump to", icon: "⤵", submenu: collectJumpTargets() }, SEPARATOR);
      }

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

    const insideMenu = (node) =>
      node instanceof Node &&
      [PANEL_ID, SUBMENU_ID].some((id) => {
        const panel = document.getElementById(id);
        return panel && panel.contains(node);
      });

    const onContextMenu = (event) => {
      // Shift+right-click is the universal "give me the real browser menu"
      // escape hatch that dev tooling relies on. Honour it.
      if (event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      // Right-clicking the menu itself just swallows the event — the open menu
      // stays put rather than re-opening on top of itself.
      if (insideMenu(target)) {
        event.preventDefault();
        return;
      }
      if (target && target.closest && target.closest(NATIVE_OPT_OUT)) return;
      event.preventDefault();
      const website = isWebsiteScope();
      targetRef.current = target;
      setSubmenu(null);
      setSubActiveIndex(-1);
      setMenu({ x: event.clientX, y: event.clientY, items: buildItems(event, website), website });
      setActiveIndex(-1);
      setVisible(false);
    };

    const onPointerDown = (event) => {
      if (insideMenu(event.target)) return;
      close();
    };

    // A long menu or submenu scrolls inside itself — only a PAGE scroll closes it.
    const onScroll = (event) => {
      if (insideMenu(event.target)) return;
      close();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [buildItems, close]);

  // Close on route change so the menu never survives a navigation.
  useEffect(() => {
    if (!router.events) return undefined;
    router.events.on("routeChangeStart", close);
    return () => router.events.off("routeChangeStart", close);
  }, [router.events, close]);

  useEffect(() => cancelSubmenuClose, [cancelSubmenuClose]);

  // Position AFTER mount so the real measured size can be clamped into the
  // viewport — a menu opened near the bottom edge flips up, as a native one does.
  useEffect(() => {
    if (!menu) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    placePanel(panel, menu.x, menu.y);
    setVisible(true);
    // preventScroll: the panel is fixed, but until its stylesheet applies it can
    // sit at the end of <body>, and a plain focus() would scroll the page there.
    panel.focus({ preventScroll: true });
  }, [menu]);

  // The submenu opens beside the row that owns it — to the right, or flipped to
  // the left of the whole menu when there is no room, as native submenus do.
  useEffect(() => {
    if (!submenu) return;
    const panel = document.getElementById(SUBMENU_ID);
    const main = document.getElementById(PANEL_ID);
    if (!panel || !main) return;
    const { width } = panel.getBoundingClientRect();
    const mainRect = main.getBoundingClientRect();
    let x = mainRect.right + SUBMENU_GAP;
    if (x + width > window.innerWidth - VIEWPORT_PAD) x = mainRect.left - SUBMENU_GAP - width;
    placePanel(panel, x, submenu.anchor.top - VIEWPORT_PAD);
    if (submenu.focus) panel.focus({ preventScroll: true });
  }, [submenu]);

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

  const openSubmenu = useCallback(
    (index, rowEl, { focus = false } = {}) => {
      cancelSubmenuClose();
      const item = menu && menu.items[index];
      if (!item || !item.submenu || !rowEl) return;
      setSubmenu((current) =>
        current && current.index === index && !focus
          ? current
          : { index, items: item.submenu, anchor: rowEl.getBoundingClientRect(), focus }
      );
      setSubActiveIndex(focus ? item.submenu.findIndex((entry) => !entry.disabled) : -1);
    },
    [menu, cancelSubmenuClose]
  );

  const scheduleSubmenuClose = useCallback(() => {
    cancelSubmenuClose();
    closeTimerRef.current = setTimeout(closeSubmenu, SUBMENU_CLOSE_DELAY);
  }, [cancelSubmenuClose, closeSubmenu]);

  const rowElement = (panelId, index) => {
    const panel = document.getElementById(panelId);
    return panel ? panel.querySelector(`[data-menu-index="${index}"]`) : null;
  };

  // Arrow-key stepping over the rows that can actually be chosen.
  const step = (items, current, direction) => {
    const selectable = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.type !== "separator" && !item.disabled);
    if (!selectable.length) return current;
    const at = selectable.findIndex(({ index }) => index === current);
    return selectable[(at + direction + selectable.length) % selectable.length].index;
  };

  const onKeyDown = (event) => {
    if (!menu) return;
    const inSubmenu = Boolean(submenu) && subActiveIndex !== -1 && event.currentTarget.id === SUBMENU_ID;

    if (event.key === "Escape") {
      event.preventDefault();
      if (inSubmenu) {
        closeSubmenu();
        document.getElementById(PANEL_ID)?.focus({ preventScroll: true });
        return;
      }
      close();
      if (targetRef.current && targetRef.current.focus) targetRef.current.focus({ preventScroll: true });
      return;
    }

    if (inSubmenu) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        setSubActiveIndex(step(submenu.items, subActiveIndex, event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        closeSubmenu();
        document.getElementById(PANEL_ID)?.focus({ preventScroll: true });
      } else if (event.key === "Enter" || event.key === " ") {
        const chosen = submenu.items[subActiveIndex];
        if (chosen && !chosen.disabled) {
          event.preventDefault();
          run(chosen);
        }
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      closeSubmenu();
      setActiveIndex(step(menu.items, activeIndex, event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    const chosen = menu.items[activeIndex];
    if (!chosen || chosen.type === "separator" || chosen.disabled) return;
    if (chosen.submenu && (event.key === "ArrowRight" || event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openSubmenu(activeIndex, rowElement(PANEL_ID, activeIndex), { focus: true });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      run(chosen);
    }
  };

  if (!menu || typeof document === "undefined") return null;

  // ------------------------------------------------------------ staff skin
  if (!menu.website) {
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

  // ---------------------------------------------------------- website skin
  const renderRow = (item, index, highlighted, handlers) => (
    <button
      key={`${item.label}-${index}`}
      type="button"
      role="menuitem"
      data-menu-index={index}
      disabled={item.disabled}
      aria-haspopup={item.submenu ? "menu" : undefined}
      aria-expanded={item.submenu ? Boolean(submenu && submenu.index === index) : undefined}
      className={`website-context-menu__item${highlighted ? " is-highlighted" : ""}`}
      {...handlers}
    >
      {/* Jump-to rows carry no icon — only the page-action rows do. */}
      {item.icon ? (
        <span className="website-context-menu__icon" aria-hidden="true">
          {item.icon}
        </span>
      ) : null}
      <span className="website-context-menu__label">{item.label}</span>
      {item.shortcut ? <span className="website-context-menu__shortcut">{item.shortcut}</span> : null}
      {item.submenu ? (
        <span className="website-context-menu__chevron" aria-hidden="true">
          ›
        </span>
      ) : null}
    </button>
  );

  return createPortal(
    <>
      <div
        id={PANEL_ID}
        role="menu"
        tabIndex={-1}
        aria-label="Context menu"
        className={`website-context-menu${visible ? " is-visible" : ""}`}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        {menu.items.map((item, index) =>
          item.type === "separator" ? (
            <div key={`sep-${index}`} className="website-context-menu__separator" role="separator" />
          ) : (
            renderRow(item, index, index === activeIndex, {
              onMouseEnter: (event) => {
                setActiveIndex(index);
                if (item.submenu) openSubmenu(index, event.currentTarget);
                else if (submenu) scheduleSubmenuClose();
              },
              onMouseLeave: () => {
                if (item.submenu) scheduleSubmenuClose();
              },
              // Touch has no hover — a tap on "Jump to" opens (or closes) the list.
              onClick: (event) => {
                if (!item.submenu) {
                  run(item);
                } else if (submenu && submenu.index === index) {
                  closeSubmenu();
                } else {
                  openSubmenu(index, event.currentTarget);
                }
              },
            })
          )
        )}
      </div>
      {submenu ? (
        <div
          id={SUBMENU_ID}
          role="menu"
          tabIndex={-1}
          aria-label="Jump to"
          className={`website-context-menu website-context-menu--submenu${visible ? " is-visible" : ""}`}
          onKeyDown={onKeyDown}
          onMouseEnter={cancelSubmenuClose}
          onMouseLeave={scheduleSubmenuClose}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="website-context-menu__heading">On this page</span>
          {submenu.items.length > 1 ? (
            submenu.items.map((item, index) =>
              renderRow(item, index, index === subActiveIndex, {
                onMouseEnter: () => setSubActiveIndex(index),
                onClick: () => run(item),
              })
            )
          ) : (
            <>
              {renderRow(submenu.items[0], 0, subActiveIndex === 0, {
                onMouseEnter: () => setSubActiveIndex(0),
                onClick: () => run(submenu.items[0]),
              })}
              <span className="website-context-menu__empty">No sections on this page</span>
            </>
          )}
        </div>
      ) : null}
    </>,
    document.body
  );
}
