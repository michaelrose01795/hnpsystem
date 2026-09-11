// file location: src/components/ui/GlobalTooltip.js
// Global hover / focus tooltip controller.
//
// Replaces the browser's native `title` tooltip (and the legacy, clip-prone
// `.app-hover-tooltip[data-tooltip]::after` pseudo-element) with a single
// in-app styled tooltip rendered into a `position: fixed` node on <body>.
// Because that node lives at the top of the stacking order and is fixed to the
// viewport, it is NEVER clipped by a card/table/panel that uses
// `overflow: hidden` — the tooltip always floats above the surrounding content,
// on every staff page.
//
// Triggers: any element carrying a non-empty `data-tooltip` (the in-app marker)
// or a native `title`. The native `title` is stripped while hovered so the
// browser's own tooltip never appears, then restored on leave so semantics /
// accessibility tooling still see it.
//
// Mounted once from _app.js (alongside CookieBanner / DevLayoutOverlayRoot).

import { useEffect } from "react";

const SHOW_DELAY = 280; // ms — settle delay so the tooltip doesn't flash on quick pass-overs
const EDGE_GAP = 8;     // px — distance between the trigger and the tooltip
const VIEWPORT_PAD = 8; // px — keep the tooltip at least this far from the viewport edge
const TRIGGER_SELECTOR = "[title],[data-tooltip]";

export default function GlobalTooltip() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    let tip = null;          // the floating tooltip element (created lazily, reused)
    let activeEl = null;     // element currently being described
    let restoreTitle = null; // original `title` we stripped (so native tooltip stays suppressed)
    let showTimer = null;
    let pointerX = 0;        // last known cursor position — the tooltip follows it
    let pointerY = 0;
    // Cached bubble size, measured once per show. Re-measuring inside every
    // pointermove forced a synchronous layout of the whole document on each
    // mouse event — which is what made moving the cursor during a layout
    // animation (e.g. collapsing the sidebar) stutter. The size only changes
    // when the text does, so measure it there instead.
    let tipW = 0;
    let tipH = 0;
    let moveFrame = 0;       // rAF handle: at most one reposition per frame
    // Reading offsetWidth flushes pending layout, so a show that lands during a
    // layout animation (collapsing the sidebar moves elements under a resting
    // cursor, which shows a tooltip) pays for the whole page. The bubble's size
    // is a pure function of its text, so remember it.
    const sizeCache = new Map();

    const getTip = () => {
      if (tip) return tip;
      tip = document.createElement("div");
      tip.className = "app-global-tooltip";
      tip.setAttribute("role", "tooltip");
      tip.setAttribute("aria-hidden", "true");
      // Keep the dev layout overlay scanner from treating the tooltip as a section.
      tip.setAttribute("data-dev-overlay-internal", "1");
      document.body.appendChild(tip);
      return tip;
    };

    const readText = (el) => {
      if (!el || !el.getAttribute) return "";
      const data = el.getAttribute("data-tooltip");
      if (data && data.trim()) return data.trim();
      const title = el.getAttribute("title");
      if (title && title.trim()) return title.trim();
      return "";
    };

    // Measure the bubble at its current text. Called from show() only — the one
    // place the content can have changed.
    const measure = (text) => {
      if (!tip) return;
      const cached = sizeCache.get(text);
      if (cached) {
        tipW = cached.w;
        tipH = cached.h;
        return;
      }
      // Measure from the viewport origin so the available width is the full
      // viewport — the bubble must not wrap differently just because the cursor
      // happens to be near the right edge.
      tip.style.left = "0px";
      tip.style.top = "0px";
      tipW = tip.offsetWidth;
      tipH = tip.offsetHeight;
      sizeCache.set(text, { w: tipW, h: tipH });
    };

    const position = () => {
      if (!tip) return;
      const tw = tipW;
      const th = tipH;

      // Follow the cursor: anchor the tooltip to the pointer rather than the
      // trigger element, so it shows exactly where the cursor is.
      let left = pointerX - tw / 2;
      left = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - tw - VIEWPORT_PAD));

      // Prefer below the cursor; flip above only if it would overflow the viewport bottom.
      let top = pointerY + EDGE_GAP;
      if (top + th > window.innerHeight - VIEWPORT_PAD && pointerY - EDGE_GAP - th > VIEWPORT_PAD) {
        top = pointerY - EDGE_GAP - th;
      }

      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    };

    const show = (el, text) => {
      const node = getTip();
      node.textContent = text;
      // Honour newlines so multi-line tooltips render as a readable list (left-
      // aligned); single-line tooltips are unaffected and stay centred.
      const multiline = text.includes("\n");
      node.style.whiteSpace = "pre-line";
      node.style.textAlign = multiline ? "left" : "center";
      node.classList.add("is-visible");
      node.setAttribute("aria-hidden", "false");
      measure(text);
      position();
    };

    const hide = () => {
      if (showTimer) {
        window.clearTimeout(showTimer);
        showTimer = null;
      }
      if (moveFrame) {
        window.cancelAnimationFrame(moveFrame);
        moveFrame = 0;
      }
      if (tip) {
        tip.classList.remove("is-visible");
        tip.setAttribute("aria-hidden", "true");
      }
      // Restore the native title we stripped on enter.
      if (activeEl && restoreTitle != null && !activeEl.hasAttribute("title")) {
        activeEl.setAttribute("title", restoreTitle);
      }
      activeEl = null;
      restoreTitle = null;
    };

    const begin = (el) => {
      // Match the scope of the in-app design system — staff pages only.
      if (!document.documentElement.classList.contains("staff-scope")) return;
      if (el === activeEl) return;
      const text = readText(el);
      if (!text) return;

      hide();
      activeEl = el;
      // Suppress the browser's native tooltip by removing `title` while hovered.
      if (el.hasAttribute("title")) {
        restoreTitle = el.getAttribute("title");
        el.removeAttribute("title");
      }
      showTimer = window.setTimeout(() => show(el, text), SHOW_DELAY);
    };

    const onOver = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      const el = event.target?.closest?.(TRIGGER_SELECTOR);
      if (!el || el.classList?.contains("app-global-tooltip")) return;
      begin(el);
    };

    // Keep the tooltip pinned to the cursor as it moves across the trigger.
    // Pointer events fire far faster than the screen refreshes, so coalesce the
    // repositioning to one write per frame.
    const onMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!activeEl || !tip || !tip.classList.contains("is-visible")) return;
      if (moveFrame) return;
      moveFrame = window.requestAnimationFrame(() => {
        moveFrame = 0;
        position();
      });
    };

    const onOut = (event) => {
      if (!activeEl) return;
      const next = event.relatedTarget;
      // Ignore moves onto a child of the same trigger.
      if (next && activeEl.contains?.(next)) return;
      hide();
    };

    const onFocusIn = (event) => {
      const el = event.target?.closest?.(TRIGGER_SELECTOR);
      if (el && !el.classList?.contains("app-global-tooltip")) {
        // No cursor for keyboard focus — fall back to the centre of the trigger.
        const rect = el.getBoundingClientRect();
        pointerX = rect.left + rect.width / 2;
        pointerY = rect.bottom;
        begin(el);
      }
    };

    const dismiss = () => hide();
    const onKey = (event) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", dismiss, true);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss, true);
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", dismiss, true);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss, true);
      document.removeEventListener("keydown", onKey, true);
      if (showTimer) window.clearTimeout(showTimer);
      if (moveFrame) window.cancelAnimationFrame(moveFrame);
      if (tip && tip.parentNode) tip.parentNode.removeChild(tip);
      tip = null;
    };
  }, []);

  return null;
}
