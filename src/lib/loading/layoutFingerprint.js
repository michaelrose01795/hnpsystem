// file location: src/lib/loading/layoutFingerprint.js
// Route-keyed in-memory cache of "layout fingerprints" — snapshots of where the
// content sections of each page sit inside the .app-page-content container.
// The global loading skeleton uses these snapshots to render shimmer placeholders
// that exactly match the page that's about to mount, so the loading grid mirrors
// the real page layout instead of a generic template.

const fingerprintCache = new Map();

const MIN_BLOCK_WIDTH = 24;
const MIN_BLOCK_HEIGHT = 18;

// Wrapper types that typically contain smaller cards/tiles. We want the skeleton
// to show the inner cards, not the wrapper itself — otherwise the first section
// renders as one big shimmer block instead of a card grid.
const WRAPPER_SECTION_TYPES = new Set([
  "page-shell",
  "section-shell",
  "section-stack",
  "content-stack",
  "tab-panel",
  "data-table-shell",
]);

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

  // Strip wrapper shells so we don't draw a giant skeleton block over the whole
  // section — we want the inner cards/tiles/rows to render as individual
  // skeleton placeholders.
  candidates = candidates.filter((el) => {
    const type = el.getAttribute("data-dev-section-type") || "";
    return !WRAPPER_SECTION_TYPES.has(type);
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

  // Final fallback: the container's direct children, excluding the skeleton overlay.
  if (candidates.length < 2) {
    candidates = Array.from(container.children).filter(
      (el) => !el.hasAttribute("data-loading-overlay")
    );
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

  // Keep only leaf blocks — drop any block that fully contains a smaller block.
  // This gives us the innermost cards/tiles so the skeleton mirrors a card grid
  // rather than one giant section placeholder.
  const contains = (outer, inner) =>
    outer.left <= inner.left + 1 &&
    outer.top <= inner.top + 1 &&
    outer.left + outer.width >= inner.left + inner.width - 1 &&
    outer.top + outer.height >= inner.top + inner.height - 1 &&
    outer.width * outer.height > inner.width * inner.height;

  let pruned = blocks.filter((block, i) => {
    return !blocks.some((other, j) => i !== j && contains(block, other));
  });

  // Safety net: if pruning removed everything, fall back to the raw blocks.
  if (!pruned.length) pruned = blocks;

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
