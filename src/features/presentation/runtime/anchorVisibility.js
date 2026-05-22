const VIEWPORT_PAD = 32;
const PAGE_HIGHLIGHT_PAD = 24;

export const DEFAULT_PRESENTATION_HIGHLIGHT_ANCHOR = "__presentation_page_highlight__";

function getViewportHighlightRect() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const pad = Math.min(PAGE_HIGHLIGHT_PAD, Math.floor(Math.min(viewportWidth, viewportHeight) / 8));
  return {
    top: pad,
    left: pad,
    right: viewportWidth - pad,
    bottom: viewportHeight - pad,
    width: Math.max(viewportWidth - pad * 2, 0),
    height: Math.max(viewportHeight - pad * 2, 0),
  };
}

export function getAnchorRect(anchor) {
  if (!anchor || typeof document === "undefined") return null;
  if (anchor === DEFAULT_PRESENTATION_HIGHLIGHT_ANCHOR) {
    const rect = getViewportHighlightRect();
    return rect ? { rect, el: null } : null;
  }
  const el = document.querySelector(anchor);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { rect, el };
}

export function isRectInViewport(rect, pad = VIEWPORT_PAD) {
  if (!rect || typeof window === "undefined") return false;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  return (
    rect.top >= pad &&
    rect.left >= pad &&
    rect.bottom <= viewportHeight - pad &&
    rect.right <= viewportWidth - pad
  );
}

function getScrollableAncestors(el) {
  if (!el || typeof window === "undefined") return [];
  const ancestors = [];
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
    const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX);
    if ((canScrollY && node.scrollHeight > node.clientHeight) || (canScrollX && node.scrollWidth > node.clientWidth)) {
      ancestors.push(node);
    }
    node = node.parentElement;
  }
  return ancestors;
}

function centreWithinAncestor(el, ancestor) {
  const targetRect = el.getBoundingClientRect();
  const ancestorRect = ancestor.getBoundingClientRect();

  if (ancestor.scrollHeight > ancestor.clientHeight) {
    const deltaY =
      targetRect.top -
      ancestorRect.top -
      (ancestor.clientHeight / 2 - targetRect.height / 2);
    ancestor.scrollTop += deltaY;
  }

  if (ancestor.scrollWidth > ancestor.clientWidth) {
    const deltaX =
      targetRect.left -
      ancestorRect.left -
      (ancestor.clientWidth / 2 - targetRect.width / 2);
    ancestor.scrollLeft += deltaX;
  }
}

export function scrollAnchorIntoView(anchor) {
  const found = getAnchorRect(anchor);
  if (!found) return false;

  for (const ancestor of getScrollableAncestors(found.el)) {
    centreWithinAncestor(found.el, ancestor);
  }

  const next = getAnchorRect(anchor);
  if (next && !isRectInViewport(next.rect)) {
    next.el?.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }

  return true;
}

export function isAnchorVisible(anchor) {
  const found = getAnchorRect(anchor);
  return Boolean(found && isRectInViewport(found.rect));
}
