// file location: src/components/ui/searchBarAPI/PhoneSearchCollapse.js
//
// Collapsed search behaviour for every page search bar, at every screen size.
// (It began as the portrait-phone behaviour — hence the name — and now applies
// to tablet and desktop too.)
//
// The field folds into a search SymbolButton; pressing it opens the same
// floating .app-phone-search-bar (with a Close button) the topbar's global
// search uses, with the page's own field inside it. Unlike the global search,
// only the topbar itself is tinted and blurred, and the bar sits inside it on
// its own clear (untinted) surface —
// the page stays clear and usable, so the user watches the list filter as they
// type. With no topbar on screen (e.g. a page without staff chrome) the tint
// falls back to a strip across the top. Pass enabled={false} to keep a field
// inline.
//
// Close: the Close button, a click anywhere outside the bar (the click still
// reaches the page), Escape, or Enter. Enter also
// submits the trigger's <form> when there is one — the field is portalled out
// of that form while open, so native implicit submission cannot reach it.
//
// renderField(inOverlay) returns the field. Hosts drop wrapper sizing (and
// visible labels) when inOverlay is true so the field fills the bar.
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SymbolButton from "@/components/ui/SymbolButton";

// Must match the bar's close animation (app-phone-search-bar-out in
// staffglobal.css). Only a safety net: animationend normally ends the close.
const CLOSE_FALLBACK_MS = 400;
const CLOSE_ANIMATION = "app-phone-search-bar-out";

// Window event a page search fires as it opens / closes ({ detail: { open } }).
// StaffLayout listens so the auto-hiding topbar stays unfolded while a page
// search is anchored to it.
export const PAGE_SEARCH_EVENT = "app:page-search";

// The topbar's resting box in viewport pixels, ignoring its fold transform, so
// the tint and bar land on the topbar even while it is still unfolding. Left and
// width come from the dock (which the bar always spans); top from the bar's own
// fixed position when it floats, otherwise from the dock. A topbar scrolled
// above the screen (tablet, where it stays in the page flow) pins to the top
// gutter instead. null when no topbar is showing.
function measureTopbar() {
  const bar = document.querySelector(".app-topbar-shell");
  const dock = bar?.closest(".app-topbar-dock");
  if (!bar || !dock || !bar.offsetHeight) return null;
  const dockRect = dock.getBoundingClientRect();
  const barStyle = window.getComputedStyle(bar);
  const rawTop = barStyle.position === "fixed" ? parseFloat(barStyle.top) : dockRect.top;
  const gutter = parseFloat(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(window.innerWidth <= 640 ? "--page-gutter-y-mobile" : "--page-gutter-y")
  );
  return {
    top: Math.max(Number.isFinite(rawTop) ? rawTop : 0, Number.isFinite(gutter) ? gutter : 0),
    left: dockRect.left,
    width: dockRect.width,
    height: bar.offsetHeight,
  };
}

/**
 * Open / closing / closed state for a search overlay, shared by
 * the page searches below and StaffLayout's global search. close() keeps the
 * overlay mounted with `is-closing` so the bar and backdrop can animate out,
 * and drops the keyboard at the same moment instead of after the unmount.
 * Spread overlayProps onto the .app-mobile-sidebar-overlay element.
 */
export function usePhoneSearchOverlay() {
  const [phase, setPhase] = useState("closed");
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setPhase("closed");
  }, []);

  const open = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setPhase("open");
  }, []);

  const close = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase((current) => {
      if (current !== "open") return current;
      return reduceMotion ? "closed" : "closing";
    });
  }, []);

  useEffect(() => {
    if (phase !== "closing") return undefined;
    // Start the keyboard retracting alongside the animation.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    timerRef.current = window.setTimeout(() => setPhase("closed"), CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [phase]);

  const isClosing = phase === "closing";
  return {
    isOpen: phase !== "closed",
    isClosing,
    open,
    close,
    dismiss,
    overlayProps: {
      className: `app-mobile-sidebar-overlay app-phone-search-overlay${isClosing ? " is-closing" : ""}`,
      onAnimationEnd: (event) => {
        if (isClosing && event.animationName === CLOSE_ANIMATION) dismiss();
      },
    },
  };
}

export default function PhoneSearchCollapse({
  renderField,
  label = "Search",
  hasValue = false,
  disabled = false,
  enabled = true,
}) {
  const { isOpen, isClosing, open, close: closeOverlay, overlayProps } = usePhoneSearchOverlay();
  const triggerRef = useRef(null);
  const fieldRef = useRef(null);
  const barRef = useRef(null);
  const overlayRef = useRef(null);

  const close = useCallback(() => {
    closeOverlay();
    // preventScroll: returning focus must not jump the page mid-animation.
    window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, [closeOverlay]);

  // Focus the field once the overlay has mounted — same as the global search's
  // autoFocus, but it works for any input the host renders.
  useEffect(() => {
    if (!isOpen || isClosing) return;
    fieldRef.current?.querySelector("input, textarea")?.focus();
  }, [isOpen, isClosing]);

  // The page is no longer covered, so "tap outside" is a document listener.
  // It uses click (not pointerdown) so scrolling the page leaves the search
  // open, and it never cancels the click, so a tapped row still opens.
  useEffect(() => {
    if (!isOpen || isClosing) return undefined;
    const handleOutsideClick = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (barRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      // Suggestion menus portalled to <body> belong to the field.
      if (target instanceof Element && target.closest(".searchbar-api__results-menu")) return;
      close();
    };
    document.addEventListener("click", handleOutsideClick, true);
    return () => document.removeEventListener("click", handleOutsideClick, true);
  }, [isOpen, isClosing, close]);

  // Hold the topbar unfolded while this search is open (see PAGE_SEARCH_EVENT).
  useEffect(() => {
    if (!isOpen || isClosing) return undefined;
    const announce = (open) =>
      window.dispatchEvent(new CustomEvent(PAGE_SEARCH_EVENT, { detail: { open } }));
    announce(true);
    return () => announce(false);
  }, [isOpen, isClosing]);

  // Anchor the tint and the bar to the topbar's box, before first paint and
  // again whenever scrolling, resizing or the topbar's own size moves it. Set on
  // the DOM directly (not via React state) so scrolling never re-renders.
  useLayoutEffect(() => {
    if (!isOpen) return undefined;
    const overlayEl = overlayRef.current;
    if (!overlayEl) return undefined;
    let frame = 0;
    const apply = () => {
      frame = 0;
      const box = measureTopbar();
      overlayEl.dataset.topbarAnchored = box ? "true" : "false";
      if (!box) return;
      const vars = {
        "--page-search-topbar-top": `${box.top}px`,
        "--page-search-topbar-left": `${box.left}px`,
        "--page-search-topbar-width": `${box.width}px`,
        "--page-search-topbar-height": `${box.height}px`,
      };
      Object.entries(vars).forEach(([name, value]) => overlayEl.style.setProperty(name, value));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const topbarEl = document.querySelector(".app-topbar-shell");
    const resizeObserver =
      topbarEl && typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(topbarEl);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
    };
  }, [isOpen]);

  if (!enabled) {
    return renderField(false);
  }

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      // Keep Escape from also closing a popup this search sits inside.
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
    const form = triggerRef.current?.closest("form");
    if (form && !event.defaultPrevented) {
      event.preventDefault();
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
    close();
  };

  const overlay =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            {...overlayProps}
            ref={overlayRef}
            className={`${overlayProps.className} app-phone-search-overlay--page`}
            data-draft-ignore="true"
          >
            <div className="app-mobile-sidebar-backdrop" />
            <div className="app-phone-search-bar" ref={barRef} role="dialog" aria-label={label}>
              <div className="app-phone-search-bar__field" ref={fieldRef} onKeyDown={handleKeyDown}>
                {renderField(true)}
              </div>
              <SymbolButton symbol="close" label="Close search" onClick={close} />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <span className={`app-phone-search-trigger${hasValue ? " has-value" : ""}`}>
      <SymbolButton
        ref={triggerRef}
        symbol="search"
        label={hasValue ? `${label} (filter active)` : label}
        onClick={open}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen && !isClosing}
      />
      {overlay}
    </span>
  );
}
