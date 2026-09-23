// Shared positioning for customer select/date panels. Native popovers escape
// clipped cards; measured runtime tokens keep the panel inside the viewport.
import { useEffect, useRef } from "react";

export default function useWebsitePopover(open, anchorRef, calendar = false) {
  const panelRef = useRef(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return undefined;
    const position = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const viewport = window.visualViewport;
      const width = viewport?.width || document.documentElement.clientWidth;
      const height = viewport?.height || document.documentElement.clientHeight;
      const offsetX = viewport?.offsetLeft || 0;
      const offsetY = viewport?.offsetTop || 0;
      const tokens = getComputedStyle(panel);
      const controlHeight = parseFloat(tokens.getPropertyValue("--website-control-height"));
      const fieldGap = parseFloat(tokens.getPropertyValue("--website-field-gap"));
      const panelWidth = Math.min(width - 12, calendar ? controlHeight * 7 + fieldGap * 2 : Math.max(controlHeight * 5, anchor.width));
      const left = Math.max(offsetX + 6, Math.min(anchor.left, offsetX + width - panelWidth - 6));
      const wantedHeight = Math.min(calendar ? 440 : 320, height - 12);
      const below = offsetY + height - anchor.bottom - 6;
      const top = below >= wantedHeight || anchor.top - offsetY < below
        ? Math.max(offsetY + 6, anchor.bottom + 6)
        : Math.max(offsetY + 6, anchor.top - wantedHeight - 6);
      panel.style.setProperty("--website-popover-left", `${left}px`);
      panel.style.setProperty("--website-popover-top", `${top}px`);
      panel.style.setProperty("--website-popover-width", `${panelWidth}px`);
      panel.style.setProperty("--website-popover-height", `${Math.max(44, offsetY + height - top - 6)}px`);
    };
    position();
    panel.showPopover?.();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
      if (panel.isConnected && panel.matches(":popover-open")) panel.hidePopover();
    };
  }, [open, anchorRef, calendar]);
  return panelRef;
}
