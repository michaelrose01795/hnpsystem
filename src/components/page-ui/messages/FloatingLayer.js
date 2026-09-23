// file location: src/components/page-ui/messages/FloatingLayer.js
//
// A layer that floats over the whole /messages page: the message action
// toolbar and the "more" menus. It is portalled to <body> and positioned with
// fixed coordinates against its anchor, so a scrolling transcript, a panel's
// overflow or a neighbouring card can never clip or cover it.
//
//   placement  "above" (default) or "below" the anchor — flipped automatically
//              when there is not room on that side
//   align      "start" lines the layer up with the anchor's left edge,
//              "end" with its right edge; always kept inside the viewport
//
// Closes on Escape and on a pointer press outside every floating layer (so a
// menu opened from the toolbar does not close the toolbar). It follows its
// anchor while the transcript scrolls.

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const EDGE = 8;

export default function FloatingLayer({
  anchorRef,
  onClose,
  placement = "above",
  align = "start",
  className = "",
  children,
  ...rest
}) {
  const layerRef = useRef(null);
  const [position, setPosition] = useState(null);

  const measure = useCallback(() => {
    const anchor = anchorRef?.current;
    const layer = layerRef.current;
    if (!anchor || !layer) return;
    const rect = anchor.getBoundingClientRect();
    // The anchor has scrolled out of sight: nothing left to point at.
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      onClose?.();
      return;
    }
    const width = layer.offsetWidth;
    const height = layer.offsetHeight;
    const roomAbove = rect.top - GAP - EDGE;
    const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const goAbove = placement === "above" ? roomAbove >= height || roomAbove > roomBelow : roomBelow < height && roomAbove > roomBelow;
    const top = goAbove ? rect.top - GAP - height : rect.bottom + GAP;
    const rawLeft = align === "end" ? rect.right - width : rect.left;
    const left = Math.min(Math.max(rawLeft, EDGE), Math.max(EDGE, window.innerWidth - width - EDGE));
    setPosition({ top: Math.max(EDGE, Math.round(top)), left: Math.round(left) });
  }, [align, anchorRef, onClose, placement]);

  useLayoutEffect(() => {
    measure();
  }, [measure, children]);

  // The layer can change size by itself — the reaction bar sliding open
  // inside the toolbar — so it re-anchors whenever its box changes.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(layer);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (event.target.closest?.("[data-msg-floating]")) return;
      if (anchorRef?.current?.contains(event.target)) return;
      onClose?.();
    };
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef, measure, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={layerRef}
      data-msg-floating=""
      className={className}
      // Layout only: fixed coordinates, hidden until the first measurement so
      // it never flashes at 0,0.
      style={{
        position: "fixed",
        top: position ? position.top : 0,
        left: position ? position.left : 0,
        visibility: position ? "visible" : "hidden",
      }}
      {...rest}
    >
      {children}
    </div>,
    document.body
  );
}
