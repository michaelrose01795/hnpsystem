// file location: src/lib/loading/layoutFingerprint.js
// Route-keyed in-memory cache of "layout fingerprints" — snapshots of where the
// content sections of each page sit inside the .app-page-content container.
// The global loading skeleton uses these snapshots to render shimmer placeholders
// that exactly match the page that's about to mount, so the loading grid mirrors
// the real page layout instead of a generic template.

const fingerprintCache = new Map();

const MIN_BLOCK_WIDTH = 24;
const MIN_BLOCK_HEIGHT = 18;

// Capture the layout of every meaningful section inside the given container.
// Prefers DevLayoutSection-annotated nodes (every page-shell wraps content in them);
// falls back to direct children of common content stacks for pages that don't.
export function captureLayoutFingerprint(container) {
  if (!container || typeof container.getBoundingClientRect !== "function") return null;

  const containerRect = container.getBoundingClientRect();
  if (!containerRect.width || !containerRect.height) return null;

  // Pull every DevLayoutSection-annotated node — these are the semantic regions
  // (page shells, section shells, content cards, stat cards) that pages register.
  let candidates = Array.from(container.querySelectorAll("[data-dev-section]"));

  // Strip outer shells so we don't draw a giant skeleton block over the whole page.
  candidates = candidates.filter((el) => {
    const type = el.getAttribute("data-dev-section-type") || "";
    if (type === "page-shell") return false;
    return true;
  });

  // Fallback: walk the immediate children of any .app-page-stack inside the container.
  if (candidates.length < 2) {
    const stacks = container.querySelectorAll(".app-page-stack");
    const fallback = [];
    stacks.forEach((stack) => {
      Array.from(stack.children).forEach((child) => fallback.push(child));
    });
    if (fallback.length) candidates = fallback;
  }

  // Final fallback: the container's direct children.
  if (candidates.length < 2) {
    candidates = Array.from(container.children);
  }

  const blocks = [];
  candidates.forEach((el) => {
    if (!(el instanceof Element)) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < MIN_BLOCK_WIDTH || rect.height < MIN_BLOCK_HEIGHT) return;

    const left = rect.left - containerRect.left;
    const top = rect.top - containerRect.top;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;

    const computed = typeof window !== "undefined" ? window.getComputedStyle(el) : null;
    const radiusRaw = computed ? computed.borderRadius : "";
    const radius = parseFloat(radiusRaw) || 12;

    blocks.push({
      left,
      top,
      width: rect.width,
      height: rect.height,
      radius,
    });
  });

  // Drop blocks that are fully covered by another (parent) block — keeps only the
  // visible leaves so we don't double-render shimmer over the same area.
  const pruned = blocks.filter((block, i) => {
    return !blocks.some((other, j) => {
      if (i === j) return false;
      if (other.width * other.height <= block.width * block.height) return false;
      return (
        other.left <= block.left + 1 &&
        other.top <= block.top + 1 &&
        other.left + other.width >= block.left + block.width - 1 &&
        other.top + other.height >= block.top + block.height - 1
      );
    });
  });

  if (!pruned.length) return null;

  return {
    capturedAt: Date.now(),
    containerHeight: containerRect.height,
    containerWidth: containerRect.width,
    blocks: pruned,
  };
}

export function setLayoutFingerprint(route, fingerprint) {
  if (!route || !fingerprint) return;
  fingerprintCache.set(route, fingerprint);
}

export function getLayoutFingerprint(route) {
  if (!route) return null;
  return fingerprintCache.get(route) || null;
}

export function clearLayoutFingerprint(route) {
  if (!route) return;
  fingerprintCache.delete(route);
}
