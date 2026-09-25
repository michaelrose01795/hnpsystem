// file location: src/components/ui/filterAPI/FilterButton.js
//
// The shared filter control: a 44px circle with the filter mark that opens a
// floating filter card, the way the calendar picker opens its month grid.
//
// Everything about the button and the card — shape, surface, layering,
// spacing, motion, the count badge — lives in src/styles/staffglobal.css under
// ".app-filter". The only thing a page supplies is the content: the dropdowns,
// search bars or toggles that make up its filters.
//
//   <FilterButton activeCount={3} onClear={clearFilters}>
//     <FilterField label="Categories">
//       <MultiSelectDropdown searchPlaceholder="Search categories" usePortal … />
//     </FilterField>
//   </FilterButton>
//
// The card is portalled to <body> and fixed-positioned under the button, so no
// page card's overflow or stacking context can clip it or sit on top of it.
// The button itself opens and closes the card: one press opens it, the next
// closes it. A click outside or Escape also closes it, and it animates out
// before it unmounts.
//
// A control that is not a filter can borrow the same floating card: pass
// `trigger` (the button's content) and `triggerClassName` (its look, owned by
// that control's family) in place of the filter circle. `children` may also be
// a function, ({ close }) => …, for cards whose buttons should close it.

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Symbol } from "@/components/ui/SymbolButton";
import Button from "@/components/ui/Button";

// Gap between the button and the card, and the minimum gap to the viewport.
const PANEL_OFFSET = 8;
const VIEWPORT_GUTTER = 16;

// Longest the close animation may take before the card unmounts regardless —
// a fallback for when animationend never fires (reduced motion, hidden tab).
const CLOSE_FALLBACK_MS = 220;

// Portalled menus opened from inside the card (MultiSelectDropdown with
// usePortal) render in <body>, outside the card's DOM. A click in one of them
// is still "inside" the filter, so it must not close the card.
const NESTED_FLOATING_SELECTOR = ".dropdown-api__menu, .app-dropdown-menu";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function FilterField({ label, htmlFor, children }) {
  return (
    <div className="app-filter__field">
      {label && (
        <label className="app-filter__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

export default function FilterButton({
  title = "Filters",
  label = "Filters",
  activeCount = 0,
  onClear,
  clearLabel = "Clear all",
  onApply,
  applyLabel = "Show results",
  showActions = true,
  disabled = false,
  className = "",
  trigger = null,
  triggerClassName = "",
  children,
  // Anything else (data-presentation, data-testid, …) lands on the trigger
  // button, the one part of the control that is always on screen.
  ...triggerProps
}) {
  // `open` is what the user asked for; `rendered` keeps the card in the DOM
  // while its close animation plays.
  const [open, setOpen] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelPosition, setPanelPosition] = useState(null);
  const anchorRef = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();
  const titleId = `${panelId}-title`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) setRendered(true);
  }, [open]);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Once closed, unmount on the close animation's end, with a timer as a
  // backstop so the card can never get stuck on screen.
  const finishClose = useCallback(() => {
    setRendered(false);
    setPanelPosition(null);
  }, []);

  useEffect(() => {
    if (open || !rendered) return undefined;
    const timer = window.setTimeout(finishClose, CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [open, rendered, finishClose]);

  // Anchor the card under the button, right-aligned to it (it opens back
  // across the page, as in the toolbar it usually sits at the end of), then
  // clamp it inside the viewport. On a phone the CSS width is the viewport
  // minus the gutters, so the clamp alone makes it span the screen. If there
  // is more room above the button than below, it opens upwards instead, and
  // grows from its bottom edge rather than its top.
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const panelWidth = panel.offsetWidth;

    const left = Math.min(
      Math.max(VIEWPORT_GUTTER, rect.right - panelWidth),
      Math.max(VIEWPORT_GUTTER, viewportWidth - panelWidth - VIEWPORT_GUTTER)
    );

    const spaceBelow = viewportHeight - rect.bottom - PANEL_OFFSET - VIEWPORT_GUTTER;
    const spaceAbove = rect.top - PANEL_OFFSET - VIEWPORT_GUTTER;
    const openUpwards = spaceBelow < Math.min(panel.scrollHeight, 320) && spaceAbove > spaceBelow;

    // Grow out of the button: the transform origin sits where the button is
    // relative to the card, so the card appears to unfold from it.
    const originX = Math.min(Math.max(rect.left + rect.width / 2 - left, 0), panelWidth);

    setPanelPosition(
      openUpwards
        ? {
            placement: "above",
            style: {
              left,
              bottom: viewportHeight - rect.top + PANEL_OFFSET,
              maxHeight: spaceAbove,
              transformOrigin: `${originX}px 100%`,
            },
          }
        : {
            placement: "below",
            style: {
              left,
              top: rect.bottom + PANEL_OFFSET,
              maxHeight: spaceBelow,
              transformOrigin: `${originX}px 0`,
            },
          }
    );
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!rendered) return undefined;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    // Capture, so scrolling any ancestor of the button keeps the card on it.
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [rendered, updatePosition]);

  // Move focus into the card when it opens — onto the card itself, not the
  // first field, because focusing a dropdown's search would pop its menu open.
  useEffect(() => {
    if (open && rendered && panelPosition) {
      panelRef.current?.focus({ preventScroll: true });
    }
    // Only on the transition to a placed, open card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rendered, Boolean(panelPosition)]);

  // Click outside closes. pointerdown rather than click so a drag that starts
  // inside the card and ends outside it does not dismiss it.
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest(NESTED_FLOATING_SELECTOR)) return;
      close(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, close]);

  // Escape closes the card — unless a control inside it (an open dropdown)
  // is using that Escape to close itself.
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest(NESTED_FLOATING_SELECTOR)) return;
      if (
        target instanceof Element &&
        target !== triggerRef.current &&
        target.closest('[aria-expanded="true"]:not(.app-filter__trigger)')
      )
        return;
      close(true);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, close]);

  const hasActive = activeCount > 0;
  // The button is the card's only open/close control, so its name says which
  // one a press will do.
  const accessibleName = open
    ? `Close ${label.toLowerCase()}`
    : hasActive
      ? `${label} (${activeCount} active)`
      : label;
  const showApply = onApply !== null;
  const hasActions = showActions && (Boolean(onClear) || showApply);

  const panel = rendered ? (
    <div
      ref={panelRef}
      id={panelId}
      className="app-filter__panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-state={open ? "open" : "closing"}
      data-placement={panelPosition?.placement || "below"}
      data-positioned={panelPosition ? "true" : "false"}
      style={panelPosition?.style}
      onAnimationEnd={(event) => {
        if (!open && event.target === event.currentTarget) finishClose();
      }}
    >
      <div className="app-filter__header">
        <h2 id={titleId} className="app-filter__title">
          {title}
        </h2>

        {hasActions && (
          <div className="app-filter__actions">
            {onClear && (
              <Button type="button" variant="ghost" symbol={false} onClick={onClear} disabled={!hasActive}>
                {clearLabel}
              </Button>
            )}
            {showApply && (
              <Button
                type="button"
                variant="primary"
                symbol={false}
                onClick={() => {
                  onApply?.();
                  close(true);
                }}
              >
                {applyLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="app-filter__body">
        {typeof children === "function" ? children({ close: () => close(true) }) : children}
      </div>
    </div>
  ) : null;

  return (
    <div ref={anchorRef} className={["app-filter", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        className={trigger ? triggerClassName : "app-filter__trigger"}
        aria-label={accessibleName}
        title={accessibleName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-active={hasActive ? "true" : "false"}
        disabled={disabled}
        {...triggerProps}
        onClick={() => setOpen((previous) => !previous)}
      >
        {trigger || <Symbol symbol="filter" className="app-filter__glyph" />}
        {!trigger && hasActive && (
          <span className="app-filter__count" aria-hidden="true">
            {activeCount > 99 ? "99+" : activeCount}
          </span>
        )}
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
