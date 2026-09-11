// file location: src/features/website/hooks/useWebsitePreviewMode.js
//
// Detects whether /website is being rendered inside a staff panel, and in
// which of the three embed modes.
//
//   ?preview=editor
//     The old WYSIWYG mode, still used by the Design & layout tab. The whole
//     site renders, every editable section becomes a clickable overlay (see
//     PreviewClickTarget) and selection events are posted back to the parent.
//
//   ?preview=site
//     The whole site, exactly as a customer sees it — top bar, every block,
//     footer — but still an embed, so the cookie banner and the support
//     launcher stay off. Used by the website-manager Preview tab's first
//     tab ("Website"), which scrolls the site inside its frame.
//
//   ?preview=section&block=<id>[,<id>]&filter=<carFilter>
//     Section mode, used by the website-manager Preview tab. The page draws
//     ONLY the named layout blocks — no top bar, no footer, no click overlays
//     — so the staff tab can show the real section content inline underneath
//     its own tab row rather than a shrunken picture of the whole site.
//     `filter` seeds the Cars block's New / Used filter, which is how the
//     "New" and "Used" tabs show different content from the same block.
//     The embed posts its rendered height back to the parent (HEIGHT) so the
//     iframe can size itself to the section and never scroll internally.
//
// Activation signal is the query string in both cases. We avoid sniffing
// window.parent !== window because that would mis-fire when the staff app
// embeds /website anywhere else.

import { useEffect, useMemo, useState } from "react";

export const PREVIEW_MESSAGE_TYPES = {
  // From iframe -> parent
  READY: "hnp:editor-ready",
  SECTION_SELECTED: "hnp:section-selected",
  ROW_SELECTED: "hnp:row-selected",
  HEIGHT: "hnp:preview-height",
  // From parent -> iframe
  PATCH: "hnp:content-patch",
  REFRESH: "hnp:editor-refresh",
  HIGHLIGHT: "hnp:section-highlight",
};

export default function useWebsitePreviewMode() {
  // The query string is read once: a preview embed never changes mode without
  // the parent reloading the iframe, and holding the raw string keeps the
  // memo below identity-stable across renders.
  const search = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.location.search || "";
    } catch {
      return "";
    }
  }, []);

  const mode = useMemo(() => {
    try {
      return new URLSearchParams(search).get("preview");
    } catch {
      return null;
    }
  }, [search]);

  const isPreview = mode === "editor";
  // The whole site, embedded. Nothing is filtered out and no height is
  // reported — the parent gives that frame a fixed height and lets it scroll.
  const isSiteEmbed = mode === "site";

  const sectionPreview = useMemo(() => {
    if (mode !== "section") return null;
    let params;
    try {
      params = new URLSearchParams(search);
    } catch {
      return null;
    }
    const blocks = (params.get("block") || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (!blocks.length) return null;
    return { blocks, carFilter: params.get("filter") || "all" };
  }, [mode, search]);

  const [highlightedSection, setHighlightedSection] = useState(null);

  const isEmbedded = isPreview || isSiteEmbed || Boolean(sectionPreview);

  useEffect(() => {
    if (!isEmbedded || typeof window === "undefined") return undefined;
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
  }, [isEmbedded]);

  // Section mode reports its own height so the parent iframe can grow to fit.
  // The measured box is `.ws-page` rather than the document, because a short
  // section leaves the document at viewport height and would over-report.
  useEffect(() => {
    if (!sectionPreview || typeof window === "undefined") return undefined;
    const target = document.querySelector(".ws-page") || document.body;
    if (!target) return undefined;
    let last = 0;
    const post = () => {
      const height = Math.ceil(target.getBoundingClientRect().height);
      if (!height || height === last) return;
      last = height;
      window.parent?.postMessage(
        { type: PREVIEW_MESSAGE_TYPES.HEIGHT, height },
        "*"
      );
    };
    post();
    // Content arrives from the API after mount and images settle later still;
    // both change the box, which the observer picks up. `load` covers fonts.
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(post) : null;
    observer?.observe(target);
    window.addEventListener("load", post);
    return () => {
      observer?.disconnect();
      window.removeEventListener("load", post);
    };
  }, [sectionPreview]);

  return { isPreview, highlightedSection, sectionPreview };
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
