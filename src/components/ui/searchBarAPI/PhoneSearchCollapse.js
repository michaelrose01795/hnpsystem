// file location: src/components/ui/searchBarAPI/PhoneSearchCollapse.js
//
// Portrait-phone search behaviour for every page search bar.
//
// Above the vertical-phone breakpoint this renders the search field exactly as
// before. On a phone held upright the field folds into a search SymbolButton;
// tapping it opens the same overlay the topbar's global search uses (blurred
// drop-panel backdrop + floating .app-phone-search-bar with a Close button),
// with the page's own field inside it. The value stays with the page, so the
// list underneath is already filtered when the overlay closes.
//
// Close: the Close button, a tap on the backdrop, Escape, or Enter. Enter also
// submits the trigger's <form> when there is one — the field is portalled out
// of that form while open, so native implicit submission cannot reach it.
//
// renderField(inOverlay) returns the field. Hosts drop wrapper sizing (and
// visible labels) when inOverlay is true so the field fills the bar.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SymbolButton from "@/components/ui/SymbolButton";
import { useIsVerticalPhone } from "@/hooks/useIsMobile";

// Must match the bar's close animation (app-phone-search-bar-out in
// staffglobal.css). Only a safety net: animationend normally ends the close.
const CLOSE_FALLBACK_MS = 400;
const CLOSE_ANIMATION = "app-phone-search-bar-out";
// The media query that close animation is declared under.
const CLOSE_ANIMATION_QUERY = "(max-width: 640px) and (orientation: portrait)";

/**
 * Open / closing / closed state for a portrait-phone search overlay, shared by
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
    // The close animation only exists on a portrait phone; anywhere else
    // (an `always` collapse on a wider screen) close at once.
    const animates = window.matchMedia(CLOSE_ANIMATION_QUERY).matches;
    setPhase((current) => {
      if (current !== "open") return current;
      return reduceMotion || !animates ? "closed" : "closing";
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
  // Fold into the button at every width, not only on a portrait phone — for
  // tight toolbars where an inline field does not fit.
  always = false,
}) {
  const isVerticalPhone = useIsVerticalPhone();
  const { isOpen, isClosing, open, close: closeOverlay, overlayProps } = usePhoneSearchOverlay();
  const triggerRef = useRef(null);
  const fieldRef = useRef(null);

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

  // Stay open if the viewport stops matching mid-search (an Android keyboard
  // can shrink the viewport past portrait) — only the trigger is phone-only.
  if (!enabled || (!isVerticalPhone && !always && !isOpen)) {
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
            className={`${overlayProps.className} app-phone-search-overlay--page`}
            data-draft-ignore="true"
          >
            <div className="app-mobile-sidebar-backdrop" onClick={close} />
            <div className="app-phone-search-bar" role="dialog" aria-modal="true" aria-label={label}>
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
