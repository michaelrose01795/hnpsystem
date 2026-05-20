// file location: src/singlescroll/hooks/useWebsitePreviewMode.js
//
// Detects whether /website is being rendered inside the staff Live Preview
// editor iframe. When preview-editor mode is active, the WebsitePage wraps
// each editable section in a clickable overlay (see PreviewClickTarget) and
// forwards selection events back to the parent window via postMessage.
//
// Activation signal: the parent loads the iframe with `?preview=editor`. We
// avoid sniffing window.parent !== window because that would mis-fire when
// the staff app embeds /website anywhere else.

import { useEffect, useMemo, useState } from "react";

export const PREVIEW_MESSAGE_TYPES = {
  // From iframe -> parent
  READY: "hnp:editor-ready",
  SECTION_SELECTED: "hnp:section-selected",
  ROW_SELECTED: "hnp:row-selected",
  // From parent -> iframe
  PATCH: "hnp:content-patch",
  REFRESH: "hnp:editor-refresh",
  HIGHLIGHT: "hnp:section-highlight",
};

export default function useWebsitePreviewMode() {
  const isPreview = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("preview") === "editor";
    } catch {
      return false;
    }
  }, []);

  const [highlightedSection, setHighlightedSection] = useState(null);

  useEffect(() => {
    if (!isPreview || typeof window === "undefined") return undefined;
    // Announce readiness so the parent can hide its "loading" placeholder.
    window.parent?.postMessage({ type: PREVIEW_MESSAGE_TYPES.READY }, "*");

    const handle = (event) => {
      const msg = event?.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.type === PREVIEW_MESSAGE_TYPES.HIGHLIGHT) {
        setHighlightedSection(msg.sectionKey || null);
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [isPreview]);

  return { isPreview, highlightedSection };
}

// Helper used by PreviewClickTarget to fire a selection event back to the
// parent. Kept here so the message type names stay co-located with the hook.
export function sendSectionSelected(sectionKey, rowId) {
  if (typeof window === "undefined" || !window.parent) return;
  window.parent.postMessage(
    {
      type: rowId
        ? PREVIEW_MESSAGE_TYPES.ROW_SELECTED
        : PREVIEW_MESSAGE_TYPES.SECTION_SELECTED,
      sectionKey,
      rowId: rowId || null,
    },
    "*"
  );
}
