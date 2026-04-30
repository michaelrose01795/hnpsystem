// file location: src/components/dev-layout-overlay/DevLayoutOverlay.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";
import {
  DEV_OVERLAY_FALLBACK_GROUPS,
  getCategoryById,
  getCategoryIdForSectionType,
  getFamilyForCategoryId,
} from "@/lib/dev-layout/categories";
import {
  UI_FAMILIES,
  AUDIT_STATUS_OPTIONS,
  getFamilyById,
} from "@/components/ui/variants";
import {
  buildAuditKey,
  getAuditTag,
  setAuditTag,
  clearAuditTag,
} from "@/lib/dev-layout/auditTags";
import styles from "@/components/dev-layout-overlay/DevLayoutOverlay.module.css";

// Default visibility thresholds (match the original overlay behaviour). Small
// UI categories (buttons, toggles, badges) override these via their category
// entry so they don't get culled.
const DEFAULT_MIN_WIDTH = 110;
const DEFAULT_MIN_HEIGHT = 30;
const KNOWN_RADIUS = new Set([8, 10, 12, 14, 16, 20, 24, 999]);

const px = (value) => {
  const parsed = parseFloat(String(value || "0").replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

// Short, human-readable snippet of a section's own text content. Used on the
// floating labels and the panel title so an inspector can identify a section
// by what it says on screen, not just by its auto-generated index — those
// indexes reshuffle whenever a sibling is added or removed.
const truncateLabel = (text, max = 36) => {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
};

const sanitizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const isVisibleRect = (rect, minWidth = DEFAULT_MIN_WIDTH, minHeight = DEFAULT_MIN_HEIGHT) =>
  rect.width >= minWidth &&
  rect.height >= minHeight &&
  rect.bottom > 0 &&
  rect.right > 0 &&
  rect.top < window.innerHeight &&
  rect.left < window.innerWidth;

const getThresholdsForType = (type) => {
  const categoryId = getCategoryIdForSectionType(type);
  const category = categoryId ? getCategoryById(categoryId) : null;
  return {
    minWidth: category?.minWidth ?? DEFAULT_MIN_WIDTH,
    minHeight: category?.minHeight ?? DEFAULT_MIN_HEIGHT,
  };
};

const getBackgroundToken = (node, computed) => {
  const explicitToken = node.getAttribute("data-dev-background-token");
  if (explicitToken) return explicitToken;
  const classToken = String(node.className || "").match(/(?:surface|accent|layer|bg|tone)[-\w]*/i)?.[0];
  if (classToken) return classToken;
  return `computed:${computed.backgroundColor}`;
};

const getBackgroundClass = (node) => {
  const classNames = String(node.className || "")
    .split(/\s+/)
    .filter(Boolean);

  const tokenClass = classNames.find((name) => /(surface|accent|layer|bg|tone)/i.test(name));
  return tokenClass || "";
};

const classifyType = (node, fallbackType) => {
  const explicitType = node.getAttribute("data-dev-section-type");
  if (explicitType) return explicitType;
  const classes = String(node.className || "").toLowerCase();
  if (classes.includes("tab")) return "tab-row";
  if (classes.includes("toolbar")) return "toolbar";
  if (classes.includes("filter")) return "filter-row";
  if (classes.includes("table")) return "data-table";
  if (classes.includes("stat") || classes.includes("metric")) return "stat-card";
  if (fallbackType) return fallbackType;
  return "section-shell";
};

const compareNodeOrder = (a, b) => {
  if (a === b) return 0;
  const pos = a.compareDocumentPosition(b);
  if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
};

const getRectArea = (rect) => Math.max(0, rect.width) * Math.max(0, rect.height);

const isRectWithinBounds = (rect, bounds) => {
  if (!rect || !bounds) return false;
  return (
    rect.left >= bounds.left - 1 &&
    rect.top >= bounds.top - 1 &&
    rect.right <= bounds.right + 1 &&
    rect.bottom <= bounds.bottom + 1
  );
};

const toLocalRect = (rect, bounds) => ({
  left: rect.left - bounds.left,
  top: rect.top - bounds.top,
  width: rect.width,
  height: rect.height,
  right: rect.right - bounds.left,
  bottom: rect.bottom - bounds.top,
});

const getSectionTextPreview = (node) => {
  if (!node) return "";

  const rootKey = sanitizeKey(node.getAttribute?.("data-dev-section-key") || "");
  const parts = [];
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode(textNode) {
      const rawText = String(textNode?.textContent || "").replace(/\s+/g, " ").trim();
      if (!rawText) return NodeFilter.FILTER_REJECT;

      const parentElement = textNode.parentElement;
      if (!parentElement) return NodeFilter.FILTER_REJECT;
      if (parentElement.closest("script, style, noscript, template, [hidden], [aria-hidden='true']")) {
        return NodeFilter.FILTER_REJECT;
      }

      const owningSection = parentElement.closest("[data-dev-section-key]");
      const owningKey = sanitizeKey(owningSection?.getAttribute?.("data-dev-section-key") || "");
      if (owningKey && rootKey && owningKey !== rootKey) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const text = String(walker.currentNode?.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    parts.push(text);
    if (parts.join(" ").length >= 180) break;
  }

  return parts.join(" ").trim().slice(0, 180);
};

const buildEntry = ({ key, node, route, order, type, parentKey = "", widthMode = "", isShell = false, backgroundToken = "", source = "explicit" }) => {
  const computed = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();
  const textPreview = getSectionTextPreview(node);

  return {
    key,
    route,
    node,
    rect,
    order,
    source,
    type,
    wrapperClass: isShell ? "shell" : "content",
    isShell,
    widthMode,
    parentKey,
    parentNumber: "",
    childKeys: [],
    childNumbers: [],
    number: "",
    tagName: String(node.tagName || "").toLowerCase(),
    classData: String(node.className || "").replace(/\s+/g, " ").trim(),
    textPreview,
    backgroundToken: backgroundToken || getBackgroundToken(node, computed),
    backgroundClass: getBackgroundClass(node),
    backgroundColor: computed.backgroundColor,
    padding: computed.padding,
    margin: computed.margin,
    paddingTop: px(computed.paddingTop),
    paddingRight: px(computed.paddingRight),
    paddingBottom: px(computed.paddingBottom),
    paddingLeft: px(computed.paddingLeft),
    marginTop: px(computed.marginTop),
    marginBottom: px(computed.marginBottom),
    radius: computed.borderRadius,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    left: Math.round(rect.left),
    top: Math.round(rect.top),
    issueTags: [],
    computedGapFromPrevious: null,
    computedLeftOffsetFromParent: null,
  };
};

const addTableSubSections = ({ sectionsByKey, route }) => {
  const currentSections = Array.from(sectionsByKey.values());
  let orderCursor = currentSections.length;

  currentSections.forEach((section) => {
    const nodeName = section.node?.tagName?.toLowerCase() || "";
    if (nodeName !== "table" && !String(section.type || "").includes("table")) return;
    if (section.node?.getAttribute?.("data-dev-disable-table-subsections") === "1") return;

    const headingNode = section.node.tHead || section.node.querySelector("thead");
    const headingKeyFromDom = sanitizeKey(headingNode?.getAttribute?.("data-dev-section-key") || "");
    const headingKey = headingKeyFromDom || sanitizeKey(`${section.key}-headings`);
    if (headingNode && headingKey && !sectionsByKey.has(headingKey)) {
      sectionsByKey.set(
        headingKey,
        buildEntry({
          key: headingKey,
          node: headingNode,
          route: section.route || route,
          order: orderCursor++,
          type: "table-headings",
          parentKey: section.key,
          widthMode: section.widthMode || "",
          isShell: false,
          source: headingKeyFromDom ? "explicit" : "table-auto",
        })
      );
    }

    const bodyNodes = Array.from(section.node.tBodies || []).filter(Boolean);
    if (!bodyNodes.length) {
      const fallbackBody = section.node.querySelector("tbody");
      if (fallbackBody) bodyNodes.push(fallbackBody);
    }

    bodyNodes.forEach((rowNode, index) => {
      const rowKeyFromDom = sanitizeKey(rowNode?.getAttribute?.("data-dev-section-key") || "");
      const rowKey =
        rowKeyFromDom || sanitizeKey(bodyNodes.length > 1 ? `${section.key}-rows-${index + 1}` : `${section.key}-rows`);
      if (!rowNode || !rowKey || sectionsByKey.has(rowKey)) return;

      sectionsByKey.set(
        rowKey,
        buildEntry({
          key: rowKey,
          node: rowNode,
          route: section.route || route,
          order: orderCursor++,
          type: "table-rows",
          parentKey: section.key,
          widthMode: section.widthMode || "",
          isShell: false,
          source: rowKeyFromDom ? "explicit" : "table-auto",
        })
      );
    });
  });
};

const numberSections = (sections) => {
  const childrenByParent = new Map();
  sections.forEach((entry) => {
    const parent = entry.parentKey || "";
    if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
    childrenByParent.get(parent).push(entry);
  });

  childrenByParent.forEach((entries) => entries.sort((a, b) => a.order - b.order));

  const walk = (parentKey, prefix = "") => {
    const children = childrenByParent.get(parentKey) || [];
    children.forEach((child, index) => {
      child.number = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
      walk(child.key, child.number);
    });
  };

  walk("");
};

const inferIssueTags = (section, parent, previousSibling, sectionByKey) => {
  const tags = [];
  const radius = Math.round(px(section.radius));
  const maxPadding = Math.max(section.paddingTop, section.paddingRight, section.paddingBottom, section.paddingLeft);

  if (section.isShell && section.childKeys.length === 1) {
    const child = sectionByKey.get(section.childKeys[0]);
    if (child) {
      const leftDelta = Math.abs(child.rect.left - section.rect.left);
      const widthDelta = Math.abs(child.rect.width - section.rect.width);
      const topDelta = Math.abs(child.rect.top - section.rect.top);
      if (leftDelta < 14 && widthDelta < 18 && topDelta < 14) {
        tags.push("extra-wrapper");
        tags.push("rogue-wrapper");
      } else if (leftDelta > 18 || widthDelta > 32) {
        tags.push("misaligned-start");
      }
    }
  }

  if (!KNOWN_RADIUS.has(radius) && radius > 0) {
    tags.push("nonstandard-radius");
  }

  if (maxPadding >= 32) {
    tags.push("over-padded");
  }

  if (section.backgroundToken.includes("accent") || section.backgroundToken.includes("danger")) {
    tags.push("accent-overuse");
  }

  if (parent) {
    const leftOffset = Math.round(section.rect.left - parent.rect.left);
    section.computedLeftOffsetFromParent = leftOffset;
    if (Math.abs(leftOffset) > 16) {
      tags.push("misaligned-start");
    }

    if (section.isShell && parent.isShell) {
      tags.push("nested-shell");
    }

    if (section.backgroundColor === parent.backgroundColor && section.isShell) {
      tags.push("duplicate-surface");
    }

    if (section.rect.width < parent.rect.width * 0.62) {
      tags.push("off-grid");
    }
  }

  if (previousSibling) {
    const gap = Math.round(section.rect.top - previousSibling.rect.bottom);
    section.computedGapFromPrevious = gap;
    if (gap > 34 || gap < -1) {
      tags.push("inconsistent-gap");
    }
  }

  return Array.from(new Set(tags));
};

const buildPrompts = (section) => {
  const childSummary = section.childNumbers.length
    ? `Children ${section.childNumbers.join(", ")} (${section.childKeys.join(", ")}).`
    : "No child sections.";

  const metadata = `Type ${section.type}, wrapper ${section.wrapperClass}, background token ${section.backgroundToken}, background class ${section.backgroundClass || "none"}, computed background ${section.backgroundColor}, padding ${section.padding}, margin ${section.margin}, radius ${section.radius}, bounds ${section.width}x${section.height} at (${section.left}, ${section.top}).`;
  const issues = section.issueTags.length ? `Likely issues: ${section.issueTags.join(", ")}.` : "No obvious issues flagged.";
  const suggestedAction = section.issueTags.length
    ? `Suggested actions: ${section.issueTags
        .map((tag) => {
          if (tag === "rogue-wrapper" || tag === "extra-wrapper") return "remove redundant wrapper shells";
          if (tag === "duplicate-surface") return "flatten duplicate surface/background layers";
          if (tag === "nested-shell") return "collapse nested shells into one structural wrapper";
          if (tag === "misaligned-start") return "align left edge to parent content start";
          if (tag === "over-padded") return "reduce outer padding to shared spacing tokens";
          if (tag === "nonstandard-radius") return "replace radius with approved token";
          if (tag === "inconsistent-gap") return "normalize vertical rhythm to shared section gap";
          return `review ${tag}`;
        })
        .join("; ")}.`
    : "Suggested actions: standardize with nearest shared layout primitives only if mismatch is confirmed.";
  const prefix = `On ${section.route}, section ${section.number} (${section.key})`;

  const previewForRef = truncateLabel(section.textPreview, 60);
  return {
    reference: previewForRef
      ? `${section.route} :: ${section.number} (${section.key}) — “${previewForRef}”`
      : `${section.route} :: ${section.number} (${section.key})`,
    debug: `${prefix}. Parent ${section.parentNumber || "none"} (${section.parentKey || "none"}). ${metadata} ${issues} ${suggestedAction} ${childSummary}`,
    codex: `${prefix}, standardise this section using existing page-shell/section/card primitives while preserving current business behaviour. ${metadata} ${issues} ${suggestedAction} ${childSummary}`,
    claude: `${prefix}, refactor layout structure for consistency and wrapper cleanup, keeping logic and data flow unchanged. ${metadata} ${issues} ${suggestedAction} ${childSummary}`,
  };
};

const copyText = async (text) => {
  if (!text) return;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
};

const tagToneClass = (tag) => {
  if (tag === "no-issues-detected") return styles.tagSuccess;
  if (["rogue-wrapper", "extra-wrapper", "nested-shell", "duplicate-surface"].includes(tag)) return styles.tagDanger;
  if (["misaligned-start", "over-padded", "inconsistent-gap", "off-grid", "accent-overuse", "nonstandard-radius"].includes(tag)) return styles.tagWarn;
  return "";
};

const getCreateSectionLabel = (section, mode) => {
  const shortKey = String(section?.key || "")
    .replace(/^job-cards-create-/, "")
    .replace(/-/g, " ")
    .trim();

  if (mode === "labels") {
    return (
      <>
        <span className={styles.labelPrimary}>{section.number}</span>
        {shortKey ? <span className={styles.labelSecondary}>{shortKey}</span> : null}
      </>
    );
  }

  return (
    <>
      <span className={styles.labelPrimary}>{section.number}</span>
      {shortKey ? <span className={styles.labelSecondary}>{shortKey}</span> : null}
      <span className={styles.labelMeta}>{section.type}</span>
    </>
  );
};

const isOverlayInternalNode = (node) =>
  Boolean(node?.closest?.("[data-dev-overlay-internal='1']"));

const scanSections = ({ route, registry, activeCategoryIds }) => {
  const sectionsByKey = new Map();
  const explicitNodes = Array.from(document.querySelectorAll("[data-dev-section-key]")).filter(
    (node) => !isOverlayInternalNode(node)
  );

  explicitNodes.forEach((node, index) => {
    const key = sanitizeKey(node.getAttribute("data-dev-section-key"));
    if (!key) return;

    const registryEntry = registry[key] || null;
    const parentKey = sanitizeKey(node.getAttribute("data-dev-section-parent") || registryEntry?.parentKey || "");
    const type = classifyType(node, registryEntry?.type || "");
    const widthMode = node.getAttribute("data-dev-width-mode") || registryEntry?.widthMode || "";
    const isShell = node.getAttribute("data-dev-shell") === "1" || Boolean(registryEntry?.isShell) || type.includes("shell");
    const backgroundToken = node.getAttribute("data-dev-background-token") || registryEntry?.backgroundToken || "";

    sectionsByKey.set(
      key,
      buildEntry({
        key,
        node,
        route: registryEntry?.route || route,
        order: index,
        type,
        parentKey,
        widthMode,
        isShell,
        backgroundToken,
        source: registryEntry ? "registry" : "explicit",
      })
    );
  });

  // include registry sections that are not already in explicit DOM list but still mounted
  Object.values(registry).forEach((entry) => {
    const key = sanitizeKey(entry?.key);
    const node = entry?.element;
    if (!key || !node || sectionsByKey.has(key) || !node.isConnected) return;
    if (isOverlayInternalNode(node)) return;
    sectionsByKey.set(
      key,
      buildEntry({
        key,
        node,
        route: entry.route || route,
        order: sectionsByKey.size,
        type: entry.type || classifyType(node),
        parentKey: sanitizeKey(entry.parentKey),
        widthMode: entry.widthMode || "",
        isShell: Boolean(entry.isShell),
        backgroundToken: entry.backgroundToken || "",
        source: "registry",
      })
    );
  });

  // Fallback detection for non-registered structures. The selectors + size
  // thresholds are declared per category in src/lib/dev-layout/categories.js.
  // We only scan categories that are currently active — this prevents runaway
  // work and, critically, stops the overlay from recursively detecting its
  // own buttons/inputs/dialogs when those categories are toggled off.
  let fallbackIndex = 0;
  DEV_OVERLAY_FALLBACK_GROUPS.forEach(({ selector, type, minWidth, minHeight, categoryId }) => {
    if (activeCategoryIds && categoryId && !activeCategoryIds.has(categoryId)) return;
    Array.from(document.querySelectorAll(selector)).forEach((node) => {
      if (!node || node.getAttribute("data-dev-section-key")) return;
      if (node.closest("[data-dev-disable-fallback='1']")) return;
      if (isOverlayInternalNode(node)) return;
      const explicitParent = node.closest("[data-dev-section-key]");
      if (explicitParent === node) return;
      const rect = node.getBoundingClientRect();
      if (!isVisibleRect(rect, minWidth, minHeight)) return;
      fallbackIndex += 1;
      const key = sanitizeKey(`${route.replace(/\//g, "-")}-auto-${type}-${fallbackIndex}`);
      if (sectionsByKey.has(key)) return;

      const parentKey = explicitParent ? sanitizeKey(explicitParent.getAttribute("data-dev-section-key")) : "";

      sectionsByKey.set(
        key,
        buildEntry({
          key,
          node,
          route,
          order: explicitNodes.length + fallbackIndex,
          type: classifyType(node, type),
          parentKey,
          widthMode: "",
          isShell: type.includes("shell"),
          source: "fallback",
        })
      );
    });
  });

  addTableSubSections({ sectionsByKey, route });

  const sections = Array.from(sectionsByKey.values()).filter((section) => {
    const { minWidth, minHeight } = getThresholdsForType(section.type);
    return isVisibleRect(section.rect, minWidth, minHeight);
  });
  sections.sort((a, b) => compareNodeOrder(a.node, b.node));
  sections.forEach((section, index) => {
    section.order = index;
  });

  const byKey = new Map(sections.map((entry) => [entry.key, entry]));

  sections.forEach((section) => {
    if (section.parentKey && byKey.has(section.parentKey)) return;

    let parentNode = section.node.parentElement;
    while (parentNode) {
      const parentKey = sanitizeKey(parentNode.getAttribute?.("data-dev-section-key") || "");
      if (parentKey && parentKey !== section.key && byKey.has(parentKey)) {
        section.parentKey = parentKey;
        break;
      }
      parentNode = parentNode.parentElement;
    }
  });

  sections.forEach((section) => {
    if (!section.parentKey) return;
    const parent = byKey.get(section.parentKey);
    if (parent) parent.childKeys.push(section.key);
  });

  numberSections(sections);

  sections.forEach((section) => {
    const parent = section.parentKey ? byKey.get(section.parentKey) : null;
    const siblings = sections
      .filter((candidate) => candidate.parentKey === section.parentKey)
      .sort((a, b) => a.order - b.order);
    const index = siblings.findIndex((candidate) => candidate.key === section.key);
    const previous = index > 0 ? siblings[index - 1] : null;

    section.parentNumber = parent?.number || "";
    section.childNumbers = section.childKeys.map((key) => byKey.get(key)?.number).filter(Boolean);
    section.issueTags = inferIssueTags(section, parent || null, previous, byKey);
  });

  return sections;
};

const buildGuide = (section, sections) => {
  if (!section) return null;
  const parent = sections.find((item) => item.key === section.parentKey) || null;
  const siblings = sections
    .filter((item) => item.parentKey === section.parentKey)
    .sort((a, b) => a.order - b.order);
  const currentIndex = siblings.findIndex((item) => item.key === section.key);
  const previous = currentIndex > 0 ? siblings[currentIndex - 1] : null;

  return {
    parent,
    previous,
    leftGap: parent ? Math.max(0, Math.round(section.rect.left - parent.rect.left)) : 0,
    topGap: previous ? Math.max(0, Math.round(section.rect.top - previous.rect.bottom)) : 0,
    width: Math.round(section.rect.width),
  };
};

const isSidebarSection = (section) => {
  const key = String(section?.key || "");
  const classData = String(section?.classData || "");
  const backgroundToken = String(section?.backgroundToken || "");

  return (
    key.includes("sidebar") ||
    classData.includes("app-sidebar") ||
    backgroundToken.includes("sidebar")
  );
};

const isTopbarSection = (section) => {
  const key = String(section?.key || "");
  const classData = String(section?.classData || "");
  const backgroundToken = String(section?.backgroundToken || "");

  return (
    key.includes("topbar") ||
    classData.includes("app-topbar") ||
    backgroundToken.includes("topbar")
  );
};

const isPrimarySidebarSection = (section) => {
  const key = String(section?.key || "");
  return key === "app-sidebar-body" || key === "app-sidebar-body-mobile";
};

const isSidebarColumnSection = (section) => {
  const key = String(section?.key || "");
  return key === "app-layout-sidebar-rail";
};

const resolveOverlayBounds = (sections, selectedKey = "") => {
  const pageShells = (sections || []).filter((section) => section.type === "page-shell");
  if (!pageShells.length) return null;

  const selectedSection = selectedKey ? sections.find((section) => section.key === selectedKey) : null;
  if (selectedSection) {
    let parentKey = selectedSection.parentKey || "";
    while (parentKey) {
      const parent = sections.find((section) => section.key === parentKey) || null;
      if (!parent) break;
      if (parent.type === "page-shell") return parent.rect;
      parentKey = parent.parentKey || "";
    }
  }

  const rankedPageShells = [...pageShells].sort((left, right) => {
    const leftExplicit = left.source !== "fallback" && !String(left.key || "").startsWith("app-");
    const rightExplicit = right.source !== "fallback" && !String(right.key || "").startsWith("app-");
    if (leftExplicit !== rightExplicit) return leftExplicit ? -1 : 1;

    const leftArea = getRectArea(left.rect);
    const rightArea = getRectArea(right.rect);
    if (leftArea !== rightArea) return rightArea - leftArea;

    return left.order - right.order;
  });

  return rankedPageShells[0]?.rect || null;
};

const getViewportBounds = () => {
  if (typeof window === "undefined") return null;
  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

export default function DevLayoutOverlay() {
  const router = useRouter();
  const { registeredSections, syncComputedSections } = useDevLayoutRegistry();
  const {
    canAccess,
    hydrated,
    enabled,
    toggleEnabled,
    mode,
    fullScreen,
    legacyMarkers,
    setMode,
    toggleFullScreen,
    toggleLegacyMarkers,
    categories,
    categoryFilters,
    toggleCategoryFilter,
    setAllCategoryFilters,
    resetCategoryFilters,
    soloCategory,
    isCategoryActive,
    panelOpen,
    setPanelOpen,
  } = useDevLayoutOverlay();
  const [sections, setSections] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [copiedAction, setCopiedAction] = useState("");
  const [auditDraft, setAuditDraft] = useState({ family: "", variant: "", status: "", notes: "" });
  const [auditKey, setAuditKeyState] = useState("");
  const [auditSavedAt, setAuditSavedAt] = useState(0);
  const rafRef = useRef(null);

  // Stable set of active category ids for the scanner — rebuilt only when
  // filters change. Prevents scanning categories the user has turned off
  // (which also prevents the overlay from detecting its own internal DOM
  // when those element types are disabled).
  const activeCategoryIds = useMemo(() => {
    const set = new Set();
    Object.entries(categoryFilters || {}).forEach(([id, on]) => {
      if (on) set.add(id);
    });
    return set;
  }, [categoryFilters]);
  const activeCategorySignature = useMemo(
    () => Array.from(activeCategoryIds).sort().join("|"),
    [activeCategoryIds]
  );

  useEffect(() => {
    if (!canAccess || !enabled || typeof window === "undefined") {
      setSections([]);
      setSelectedKey("");
      return;
    }

    const update = () => {
      const route = router.asPath || router.pathname || "/";
      const scanned = scanSections({ route, registry: registeredSections, activeCategoryIds });
      setSections(scanned);
      syncComputedSections(route, scanned);
    };

    const schedule = () => {
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        update();
      });
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-dev-section-key", "data-dev-section-parent", "data-dev-background-token"],
    });

    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, enabled, router.asPath, router.pathname, registeredSections, syncComputedSections, activeCategorySignature]);

  const overlayBounds = useMemo(() => {
    if (fullScreen) {
      return getViewportBounds();
    }
    return resolveOverlayBounds(sections, selectedKey);
  }, [fullScreen, sections, selectedKey]);
  const scopedSections = useMemo(() => {
    const withinBounds = (section) => {
      if (!overlayBounds) return true;
      if (!isRectWithinBounds(section.rect, overlayBounds)) return false;
      if (!fullScreen && (isSidebarSection(section) || isTopbarSection(section))) {
        return false;
      }
      return true;
    };

    return sections.filter((section) => {
      if (!withinBounds(section)) return false;
      const categoryId = getCategoryIdForSectionType(section.type);
      // Sections without a known category default to visible so new/unmapped
      // types never silently disappear from the overlay.
      if (categoryId && !isCategoryActive(categoryId)) return false;
      return true;
    });
  }, [sections, overlayBounds, fullScreen, isCategoryActive]);
  const scopedSelected = useMemo(
    () => scopedSections.find((section) => section.key === selectedKey) || null,
    [scopedSections, selectedKey]
  );
  const scopedGuide = useMemo(() => buildGuide(scopedSelected, scopedSections), [scopedSelected, scopedSections]);
  const stats = useMemo(() => {
    const issueCount = scopedSections.filter((section) => section.issueTags.length > 0).length;
    const shellCount = scopedSections.filter((section) => section.isShell).length;
    const fallbackCount = scopedSections.filter((section) => section.source === "fallback").length;
    return {
      total: scopedSections.length,
      issueCount,
      shellCount,
      fallbackCount,
    };
  }, [scopedSections]);

  useEffect(() => {
    if (!selectedKey) return;
    if (!scopedSections.some((entry) => entry.key === selectedKey)) {
      setSelectedKey("");
    }
  }, [scopedSections, selectedKey]);

  useEffect(() => {
    if (!copiedAction) return undefined;
    const timer = window.setTimeout(() => setCopiedAction(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedAction]);

  // Load (or reset) the audit classification draft whenever the selected
  // section changes. The draft is pre-filled from the persisted tag, falling
  // back to the family the dev-overlay has already inferred from the
  // section's category.
  const scopedSelectedForAudit = useMemo(
    () => scopedSections.find((section) => section.key === selectedKey) || null,
    [scopedSections, selectedKey]
  );

  useEffect(() => {
    if (!scopedSelectedForAudit?.node) {
      setAuditDraft({ family: "", variant: "", status: "", notes: "" });
      setAuditKeyState("");
      return;
    }
    const key = buildAuditKey({
      route: scopedSelectedForAudit.route,
      node: scopedSelectedForAudit.node,
    });
    setAuditKeyState(key);
    const existing = getAuditTag(key);
    const categoryId = getCategoryIdForSectionType(scopedSelectedForAudit.type);
    const defaultFamily = getFamilyForCategoryId(categoryId) || "";
    setAuditDraft({
      family: existing?.family || defaultFamily,
      variant: existing?.variant || "",
      status: existing?.status || "needs-review",
      notes: existing?.notes || "",
    });
  }, [scopedSelectedForAudit]);

  const applyAuditPatch = (patch) => {
    setAuditDraft((prev) => {
      const next = { ...prev, ...patch };
      if (auditKey) {
        setAuditTag(auditKey, next);
        setAuditSavedAt(Date.now());
      }
      return next;
    });
  };

  const handleClearAuditTag = () => {
    if (!auditKey) return;
    clearAuditTag(auditKey);
    setAuditDraft({ family: "", variant: "", status: "", notes: "" });
    setAuditSavedAt(Date.now());
  };

  if (!canAccess || !hydrated) return null;

  const currentRoute = router.asPath || router.pathname || "/";
  const isJobCardsCreateRoute = currentRoute.startsWith("/job-cards/create");
  const canInspectClick = true;
  const handleCopy = async (type, text) => {
    await copyText(text);
    setCopiedAction(type);
  };
  const handleInspectClick = async (sectionKey) => {
    setSelectedKey(sectionKey);
    setPanelOpen(true);
    const section = scopedSections.find((entry) => entry.key === sectionKey);
    if (!section) return;
    const prompts = buildPrompts(section);
    await handleCopy("reference", prompts.reference);
  };

  const overlayStyle = overlayBounds
    ? {
        left: overlayBounds.left,
        top: overlayBounds.top,
        width: overlayBounds.width,
        height: overlayBounds.height,
      }
    : undefined;

  const activeCategoryCount = categories.reduce(
    (total, cat) => total + (categoryFilters[cat.id] ? 1 : 0),
    0
  );

  const selectedPrompts = scopedSelected ? buildPrompts(scopedSelected) : null;

  const renderUnifiedPanel = () => {
    if (!panelOpen) return null;

    return (
      <aside
        className={`${styles.panel} ${isJobCardsCreateRoute ? styles.panelCreate : ""}`.trim()}
        data-dev-overlay-internal="1"
        role="dialog"
        aria-label="Dev layout inspector"
      >
        <div className={styles.panelScroll}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleBlock}>
              <p className={styles.kicker}>Dev Layout Inspector</p>
              <h3 className={styles.title}>
                {scopedSelected
                  ? `${scopedSelected.route} :: ${scopedSelected.number} (${scopedSelected.key})`
                  : enabled
                  ? "Overlay controls"
                  : "Overlay disabled"}
              </h3>
              <p className={styles.subtitle}>
                {scopedSelected
                  ? [
                      truncateLabel(scopedSelected.textPreview, 80) ? `“${truncateLabel(scopedSelected.textPreview, 80)}”` : null,
                      scopedSelected.type,
                      scopedSelected.source,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : `Route ${currentRoute} · ${stats.total} section${stats.total === 1 ? "" : "s"} detected`}
              </p>
            </div>
            <div className={styles.panelHeaderActions}>
              <button
                type="button"
                className={`${styles.iconBtn}`.trim()}
                onClick={() => setPanelOpen(false)}
                aria-label="Minimise dev overlay panel"
                title="Minimise"
              >
                −
              </button>
            </div>
          </div>

          <div className={styles.controlsBlock}>
            <div className={styles.controlRow}>
              <label className={styles.controlLabel}>
                <span>Overlay enabled</span>
                <span className={styles.controlHint}>
                  {enabled ? "Rendering on the page" : "Hidden — no boxes or outlines"}
                </span>
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Toggle overlay master"
                className={`${styles.switch} ${enabled ? styles.switchOn : ""}`.trim()}
                onClick={toggleEnabled}
              />
            </div>

            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>
                <span>Label mode</span>
              </span>
              <div className={styles.modeRow}>
                {["labels", "details", "inspect", "trace"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.modeBtn} ${mode === value ? styles.modeBtnActive : ""}`.trim()}
                    onClick={() => setMode(value)}
                    aria-pressed={mode === value}
                    disabled={!enabled}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>
                <span>Full-screen scope</span>
                <span className={styles.controlHint}>Extend overlay over the sidebar/topbar</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={fullScreen}
                aria-label="Toggle full-screen overlay"
                className={`${styles.switch} ${fullScreen ? styles.switchOn : ""}`.trim()}
                onClick={toggleFullScreen}
                disabled={!enabled}
              />
            </div>

            <div className={styles.controlRow}>
              <span className={styles.controlLabel}>
                <span>Dotted markers</span>
                <span className={styles.controlHint}>Extra dashed lines for nested/fallback</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={legacyMarkers}
                aria-label="Toggle dotted markers"
                className={`${styles.switch} ${legacyMarkers ? styles.switchOn : ""}`.trim()}
                onClick={toggleLegacyMarkers}
                disabled={!enabled}
              />
            </div>
          </div>

          <div className={styles.controlsBlock}>
            <div className={styles.controlsHead}>
              <p className={styles.blockTitle}>
                Categories <span className={styles.countChip}>{activeCategoryCount}/{categories.length}</span>
              </p>
              <div className={styles.bulkRow}>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={() => setAllCategoryFilters(true)}
                  disabled={!enabled}
                >
                  All
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={() => setAllCategoryFilters(false)}
                  disabled={!enabled}
                >
                  None
                </button>
                <button
                  type="button"
                  className={styles.bulkBtn}
                  onClick={resetCategoryFilters}
                  disabled={!enabled}
                  title="Reset to defaults"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className={styles.categoryGrid}>
              {categories.map((cat) => {
                const active = Boolean(categoryFilters[cat.id]);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="switch"
                    aria-checked={active}
                    className={`${styles.categoryPill} ${active ? styles.categoryPillActive : ""}`.trim()}
                    onClick={(event) => {
                      // Shift-click → solo this category (isolate it, hide everything else).
                      // Plain click → regular toggle.
                      if (event.shiftKey) {
                        soloCategory(cat.id);
                      } else {
                        toggleCategoryFilter(cat.id);
                      }
                    }}
                    disabled={!enabled}
                    title={`${cat.description || cat.label} — Shift+click to solo this family`}
                  >
                    <span
                      className={`${styles.categoryCheck} ${active ? styles.categoryCheckOn : ""}`.trim()}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span
                      className={styles.categorySwatch}
                      style={{ background: cat.color }}
                      aria-hidden="true"
                    />
                    <span className={styles.categoryName}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {scopedSelected && selectedPrompts && (
            <div className={styles.selectedBlock}>
              <div className={styles.selectedHead}>
                <p className={styles.blockTitle}>Selected section</p>
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={() => setSelectedKey("")}
                >
                  Clear
                </button>
              </div>

              <div className={styles.grid}>
                <span className={styles.labelKey}>Element</span>
                <span className={styles.value}>{scopedSelected.tagName || "unknown"} · {scopedSelected.wrapperClass}</span>
                <span className={styles.labelKey}>Parent</span>
                <span className={styles.value}>{scopedSelected.parentNumber || "none"} ({scopedSelected.parentKey || "none"})</span>
                <span className={styles.labelKey}>Children</span>
                <span className={styles.value}>{scopedSelected.childNumbers.join(", ") || "none"}</span>
                <span className={styles.labelKey}>Padding</span>
                <span className={styles.value}>{scopedSelected.padding}</span>
                <span className={styles.labelKey}>Radius</span>
                <span className={styles.value}>{scopedSelected.radius}</span>
                <span className={styles.labelKey}>Bounds</span>
                <span className={styles.value}>{scopedSelected.width}×{scopedSelected.height} at ({scopedSelected.left}, {scopedSelected.top})</span>
                <span className={styles.labelKey}>Gap / Offset</span>
                <span className={styles.value}>
                  gap {scopedSelected.computedGapFromPrevious ?? "n/a"}px · left {scopedSelected.computedLeftOffsetFromParent ?? "n/a"}px
                </span>
                <span className={styles.labelKey}>Background</span>
                <span className={styles.value}>{scopedSelected.backgroundToken}</span>
              </div>

              {scopedSelected.textPreview ? (
                <p className={styles.previewText}>{scopedSelected.textPreview}</p>
              ) : null}

              <div className={styles.row}>
                {scopedSelected.issueTags.length === 0 && (
                  <span className={`${styles.tag} ${styles.tagSuccess}`}>no-issues-detected</span>
                )}
                {scopedSelected.issueTags.map((tag) => (
                  <span key={tag} className={`${styles.tag} ${tagToneClass(tag)}`.trim()}>{tag}</span>
                ))}
              </div>

              <div className={styles.row}>
                <button type="button" className={styles.copyBtn} onClick={() => handleCopy("reference", selectedPrompts.reference)}>Copy ref</button>
                <button type="button" className={styles.copyBtn} onClick={() => handleCopy("debug", selectedPrompts.debug)}>Copy debug</button>
                <button type="button" className={styles.copyBtn} onClick={() => handleCopy("codex", selectedPrompts.codex)}>Copy Codex prompt</button>
                <button type="button" className={styles.copyBtn} onClick={() => handleCopy("claude", selectedPrompts.claude)}>Copy Claude prompt</button>
              </div>
              <p className={styles.copyStatus}>
                {copiedAction ? `Copied ${copiedAction}` : "Pick a copy action to export context for this section."}
              </p>

              {/* Classification form — persists to localStorage via auditTags.js. */}
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Classification
                  </strong>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>
                    {auditSavedAt ? "Saved to localStorage" : "Edits save automatically"}
                  </span>
                </div>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>Family</span>
                  <select
                    value={auditDraft.family}
                    onChange={(event) => applyAuditPatch({ family: event.target.value, variant: "" })}
                    style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6 }}
                  >
                    <option value="">—</option>
                    {UI_FAMILIES.map((fam) => (
                      <option key={fam.id} value={fam.id}>{fam.label}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>Variant</span>
                  <select
                    value={auditDraft.variant}
                    onChange={(event) => applyAuditPatch({ variant: event.target.value })}
                    disabled={!auditDraft.family}
                    style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6 }}
                  >
                    <option value="">—</option>
                    {(getFamilyById(auditDraft.family)?.variants || []).map((variant) => (
                      <option key={variant.id} value={variant.id}>{variant.id}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>Status</span>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {AUDIT_STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => applyAuditPatch({ status: option.id })}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.18)",
                          background: auditDraft.status === option.id ? "var(--primary)" : "transparent",
                          color: auditDraft.status === option.id ? "var(--onAccentText)" : "inherit",
                          cursor: "pointer",
                        }}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 10, opacity: 0.75 }}>Notes</span>
                  <textarea
                    value={auditDraft.notes}
                    onChange={(event) => applyAuditPatch({ notes: event.target.value })}
                    placeholder="Optional review notes — what's off, what to keep custom, etc."
                    rows={2}
                    style={{ padding: "6px 8px", fontSize: 12, borderRadius: 6, resize: "vertical" }}
                  />
                </label>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={handleClearAuditTag}
                    style={{
                      padding: "4px 10px",
                      fontSize: 11,
                      background: "transparent",
                      color: "inherit",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 6,
                      cursor: "pointer",
                    }}
                  >
                    Clear tag
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className={styles.footerHint}>
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> toggle ·{" "}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>M</kbd> cycle mode ·{" "}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> trace mode ·{" "}
          <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> this panel ·{" "}
          <kbd>Shift</kbd>+click a category to solo it
        </p>
      </aside>
    );
  };

  if (!enabled) {
    return renderUnifiedPanel();
  }

  return (
    <>
      <div
        className={`${styles.root} ${isJobCardsCreateRoute ? styles.rootCreate : ""}`.trim()}
        data-dev-overlay-internal="1"
        aria-hidden="true"
        style={overlayStyle}
      >
        {scopedSections.map((section) => {
        const selectedClass = scopedSelected?.key === section.key ? styles.boxSelected : "";
        const sidebarSection = fullScreen && isSidebarSection(section);
        const primarySidebarSection = fullScreen && isPrimarySidebarSection(section);
        const sidebarColumnSection = fullScreen && isSidebarColumnSection(section);
        const previewSnippet = truncateLabel(section.textPreview, 36);
        const labelText = mode === "labels"
          ? section.number
          : isJobCardsCreateRoute
            ? [section.number, previewSnippet ? `“${previewSnippet}”` : null, section.type]
                .filter(Boolean)
                .join(" · ")
            : [section.number, previewSnippet ? `“${previewSnippet}”` : null, section.type, section.backgroundToken]
                .filter(Boolean)
                .join(" · ");
        const localRect = overlayBounds ? toLocalRect(section.rect, overlayBounds) : section.rect;
        const labelStyle = isJobCardsCreateRoute
          ? {
              left: localRect.left + 8,
              top: localRect.top + 8,
              maxWidth: Math.max(96, localRect.width - 16),
            }
          : sidebarColumnSection
          ? {
              left: Math.max(12, localRect.left + Math.min(localRect.width / 2, 120)),
              top: Math.max(8, localRect.top + 8),
              transform: "translateX(-50%)",
            }
          : primarySidebarSection
          ? {
              left: Math.max(12, localRect.left + Math.min(localRect.width / 2, 110)),
              top: Math.max(10, localRect.top + 10),
              transform: "translateX(-50%)",
            }
          : sidebarSection
          ? {
              left: Math.max(8, localRect.right - 8),
              top: Math.max(8, localRect.top + 34),
              transform: "translateX(-100%)",
            }
          : {
              left: localRect.left + 6,
              top: Math.max(6, localRect.top - 10),
            };

        return (
          <React.Fragment key={section.key}>
            {canInspectClick && (
              <div
                role="button"
                tabIndex={0}
                aria-label={`Inspect section ${section.number} (${section.key})`}
                className={styles.inspectButton}
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  await handleInspectClick(section.key);
                }}
                onKeyDown={async (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    await handleInspectClick(section.key);
                  }
                }}
                style={{
                  left: localRect.left,
                  top: localRect.top,
                  width: localRect.width,
                  height: localRect.height,
                }}
                title={`${section.number} (${section.key})`}
              />
            )}
            <div
              className={`${styles.box} ${isJobCardsCreateRoute ? styles.boxCreate : ""} ${sidebarSection ? styles.boxSidebar : ""} ${sidebarColumnSection ? styles.boxSidebarColumn : ""} ${primarySidebarSection ? styles.boxSidebarPrimary : ""} ${selectedClass}`.trim()}
              style={{
                left: localRect.left,
                top: localRect.top,
                width: localRect.width,
                height: localRect.height,
              }}
            />
            <div
              className={`${styles.label} ${isJobCardsCreateRoute ? styles.labelCreate : ""} ${sidebarSection ? styles.labelSidebar : ""} ${sidebarColumnSection ? styles.labelSidebarColumn : ""} ${primarySidebarSection ? styles.labelSidebarPrimary : ""} ${mode !== "labels" && !isJobCardsCreateRoute ? styles.labelDetails : ""}`}
              style={labelStyle}
            >
              {isJobCardsCreateRoute ? getCreateSectionLabel(section, mode) : labelText}
            </div>
          </React.Fragment>
        );
      })}

      {scopedSelected && scopedGuide && (
        <>
          {scopedGuide.parent && overlayBounds && (
            <>
              <div
                className={styles.guideLine}
                style={{
                  left: scopedGuide.parent.rect.left - overlayBounds.left,
                  top: scopedSelected.rect.top - overlayBounds.top - 12,
                  width: Math.max(1, scopedSelected.rect.left - scopedGuide.parent.rect.left),
                  height: 1,
                }}
              />
              <div className={styles.guideLabel} style={{ left: scopedGuide.parent.rect.left - overlayBounds.left + 4, top: scopedSelected.rect.top - overlayBounds.top - 24 }}>
                left {scopedGuide.leftGap}px
              </div>
            </>
          )}

          {scopedGuide.previous && overlayBounds && (
            <>
              <div
                className={styles.guideLine}
                style={{
                  left: scopedSelected.rect.left - overlayBounds.left - 10,
                  top: scopedGuide.previous.rect.bottom - overlayBounds.top,
                  width: 1,
                  height: Math.max(1, scopedSelected.rect.top - scopedGuide.previous.rect.bottom),
                }}
              />
              <div className={styles.guideLabel} style={{ left: scopedSelected.rect.left - overlayBounds.left + 2, top: scopedGuide.previous.rect.bottom - overlayBounds.top + 4 }}>
                gap {scopedGuide.topGap}px
              </div>
            </>
          )}

          <div
            className={styles.guideLine}
            style={{
              left: overlayBounds ? scopedSelected.rect.left - overlayBounds.left : scopedSelected.rect.left,
              top: overlayBounds ? scopedSelected.rect.bottom - overlayBounds.top + 6 : scopedSelected.rect.bottom + 6,
              width: scopedSelected.rect.width,
              height: 1,
            }}
          />
          <div className={styles.guideLabel} style={{ left: overlayBounds ? scopedSelected.rect.left - overlayBounds.left + 8 : scopedSelected.rect.left + 8, top: overlayBounds ? scopedSelected.rect.bottom - overlayBounds.top + 8 : scopedSelected.rect.bottom + 8 }}>
            width {scopedGuide.width}px
          </div>
        </>
      )}

      </div>
      {renderUnifiedPanel()}
    </>
  );
}
