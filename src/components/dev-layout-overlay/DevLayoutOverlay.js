// file location: src/components/dev-layout-overlay/DevLayoutOverlay.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";
import styles from "@/components/dev-layout-overlay/DevLayoutOverlay.module.css";

const FALLBACK_SELECTORS = [
  { selector: ".app-layout-page-shell,.app-page-shell", type: "page-shell" },
  { selector: ".app-page-card", type: "page-shell" },
  {
    selector:
      ".app-section-card,.app-layout-section-shell,.app-layout-card,.app-layout-surface-subtle,.app-layout-surface-accent,.customer-portal-card",
    type: "content-card",
  },
  { selector: ".app-toolbar-row,.app-layout-toolbar-row", type: "toolbar" },
  { selector: ".tab-scroll-row,.tab-api,.app-layout-tab-row", type: "tab-row" },
  { selector: ".table-api,table", type: "data-table" },
  { selector: "[class*='stat'],[class*='metric'],.app-layout-stat-card", type: "stat-card" },
];

const MIN_WIDTH = 110;
const MIN_HEIGHT = 30;
const KNOWN_RADIUS = new Set([8, 10, 12, 14, 16, 20, 24, 999]);

const px = (value) => {
  const parsed = parseFloat(String(value || "0").replace("px", ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const isVisibleRect = (rect) =>
  rect.width >= MIN_WIDTH &&
  rect.height >= MIN_HEIGHT &&
  rect.bottom > 0 &&
  rect.right > 0 &&
  rect.top < window.innerHeight &&
  rect.left < window.innerWidth;

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

  return {
    reference: `${section.route} :: ${section.number} (${section.key})`,
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

const scanSections = ({ route, registry }) => {
  const sectionsByKey = new Map();
  const explicitNodes = Array.from(document.querySelectorAll("[data-dev-section-key]"));

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

  // fallback detection for non-registered structures
  let fallbackIndex = 0;
  FALLBACK_SELECTORS.forEach(({ selector, type }) => {
    Array.from(document.querySelectorAll(selector)).forEach((node) => {
      if (!node || node.getAttribute("data-dev-section-key")) return;
      if (node.closest("[data-dev-disable-fallback='1']")) return;
      const explicitParent = node.closest("[data-dev-section-key]");
      if (explicitParent === node) return;
      const rect = node.getBoundingClientRect();
      if (!isVisibleRect(rect)) return;
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

  const sections = Array.from(sectionsByKey.values()).filter((section) => isVisibleRect(section.rect));
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
    enabled,
    mode,
    fullScreen,
    legacyMarkers,
    setMode,
    toggleFullScreen,
    toggleLegacyMarkers,
    cycleMode,
  } = useDevLayoutOverlay();
  const [sections, setSections] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [copiedAction, setCopiedAction] = useState("");
  const [copiedText, setCopiedText] = useState("");
  const rafRef = useRef(null);

  useEffect(() => {
    if (!canAccess || !enabled || typeof window === "undefined") {
      setSections([]);
      setSelectedKey("");
      return;
    }

    const update = () => {
      const route = router.asPath || router.pathname || "/";
      const scanned = scanSections({ route, registry: registeredSections });
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
  }, [canAccess, enabled, router.asPath, router.pathname, registeredSections, syncComputedSections]);

  const overlayBounds = useMemo(() => {
    if (fullScreen) {
      return getViewportBounds();
    }
    return resolveOverlayBounds(sections, selectedKey);
  }, [fullScreen, sections, selectedKey]);
  const scopedSections = useMemo(() => {
    if (!overlayBounds) return sections;
    return sections.filter((section) => {
      if (!isRectWithinBounds(section.rect, overlayBounds)) return false;
      if (!fullScreen && (isSidebarSection(section) || isTopbarSection(section))) {
        return false;
      }
      return true;
    });
  }, [sections, overlayBounds, fullScreen]);
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

  if (!canAccess || !enabled) return null;

  const currentRoute = router.asPath || router.pathname || "/";
  const isJobCardsCreateRoute = currentRoute.startsWith("/job-cards/create");
  const canInspectClick = true;
  const handleCopy = async (type, text) => {
    await copyText(text);
    setCopiedAction(type);
    setCopiedText(text || "");
  };
  const handleInspectClick = async (sectionKey) => {
    setSelectedKey(sectionKey);
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

  return (
    <div className={`${styles.root} ${isJobCardsCreateRoute ? styles.rootCreate : ""}`.trim()} aria-hidden="true" style={overlayStyle}>
      {scopedSections.map((section) => {
        const selectedClass = scopedSelected?.key === section.key ? styles.boxSelected : "";
        const sidebarSection = fullScreen && isSidebarSection(section);
        const primarySidebarSection = fullScreen && isPrimarySidebarSection(section);
        const sidebarColumnSection = fullScreen && isSidebarColumnSection(section);
        const labelText = mode === "labels"
          ? section.number
          : isJobCardsCreateRoute
            ? `${section.number} · ${section.type}`
            : `${section.number} · ${section.type} · ${section.backgroundToken}`;
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
              <button
                type="button"
                className={styles.inspectButton}
                onClick={async (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  await handleInspectClick(section.key);
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

      {scopedSelected && (
        <aside className={`${styles.panel} ${isJobCardsCreateRoute ? styles.panelCreate : ""}`.trim()} role="dialog" aria-label="Dev layout inspector">
          <div className={styles.panelScroll}>
            <div className={styles.panelHeader}>
              <div className={styles.panelTitleBlock}>
                <p className={styles.kicker}>Dev Layout Inspector</p>
                <h3 className={styles.title}>
                  Section {scopedSelected.number} · {scopedSelected.key}
                </h3>
                <p className={styles.subtitle}>
                  {scopedSelected.route} · {scopedSelected.type} · {scopedSelected.source}
                </p>
              </div>
              <div className={styles.panelHeaderActions}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={fullScreen}
                  aria-label="Toggle full-screen dev layout overlay"
                  className={`app-btn ${fullScreen ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                  onClick={toggleFullScreen}
                >
                  Full Screen {fullScreen ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={legacyMarkers}
                  aria-label="Toggle extra dotted dev markers"
                  className={`app-btn ${legacyMarkers ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                  onClick={toggleLegacyMarkers}
                >
                  Dotted Lines {legacyMarkers ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  className={`app-btn ${mode === "labels" ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                  aria-pressed={mode === "labels"}
                  onClick={() => setMode("labels")}
                >
                  Labels
                </button>
                <button
                  type="button"
                  className={`app-btn ${mode === "details" ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                  aria-pressed={mode === "details"}
                  onClick={() => setMode("details")}
                >
                  Details
                </button>
                <button
                  type="button"
                  className={`app-btn ${mode === "inspect" ? "app-btn--primary" : "app-btn--secondary"} app-btn--xs app-btn--pill`}
                  aria-pressed={mode === "inspect"}
                  onClick={cycleMode}
                >
                  Next Mode
                </button>
                <button type="button" className="app-btn app-btn--ghost app-btn--xs" onClick={() => setSelectedKey("")}>
                  Close
                </button>
              </div>
            </div>

            <div className={styles.summaryRow}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Sections</span>
                <span className={styles.summaryValue}>{stats.total}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Flagged</span>
                <span className={styles.summaryValue}>{stats.issueCount}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Shells</span>
                <span className={styles.summaryValue}>{stats.shellCount}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Fallback</span>
                <span className={styles.summaryValue}>{stats.fallbackCount}</span>
              </div>
            </div>

            {(() => {
              const prompts = buildPrompts(scopedSelected);
              return (
                <div className={styles.sectionBlock}>
                  <p className={styles.blockTitle}>Copy Tools</p>
                  <div className={styles.row}>
                    <button type="button" className="app-btn app-btn--secondary app-btn--xs" onClick={() => handleCopy("reference", prompts.reference)}>Copy section reference</button>
                    <button type="button" className="app-btn app-btn--secondary app-btn--xs" onClick={() => handleCopy("debug", prompts.debug)}>Copy debug summary</button>
                    <button type="button" className="app-btn app-btn--secondary app-btn--xs" onClick={() => handleCopy("codex", prompts.codex)}>Copy Codex prompt</button>
                    <button type="button" className="app-btn app-btn--secondary app-btn--xs" onClick={() => handleCopy("claude", prompts.claude)}>Copy Claude prompt</button>
                  </div>
                  <p className={styles.copyStatus}>{copiedAction ? `Copied ${copiedAction}` : "Select any copy action to export context."}</p>
                  <p className={styles.copyStatus}>{copiedAction === "reference" ? copiedText : "Shortcuts: Ctrl+Shift+D toggles overlay, Ctrl+Shift+M cycles modes. Dotted Lines controls the extra dashed fallback markers across pages."}</p>
                </div>
              );
            })()}

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Overlay Colour Guide</p>
              <div className={styles.row}>
                <span className={styles.legendItem}>
                  <span
                    className={styles.legendSwatch}
                    style={{ borderColor: "rgba(var(--accent-base-rgb), 0.74)", borderStyle: "dashed" }}
                    aria-hidden="true"
                  />
                  Default section outline
                </span>
                <span className={styles.legendItem}>
                  <span
                    className={styles.legendSwatch}
                    style={{ borderColor: "var(--accent-strong)", borderStyle: "solid" }}
                    aria-hidden="true"
                  />
                  Selected section outline
                </span>
              </div>
              <p className={styles.emptyHint}>
                Dashed accent outlines mark every detected section. The solid accent outline shows the section currently selected in the inspector.
              </p>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Identity</p>
              <div className={styles.grid}>
                <span className={styles.labelKey}>Route</span><span className={styles.value}>{scopedSelected.route}</span>
                <span className={styles.labelKey}>Section Number</span><span className={styles.value}>{scopedSelected.number}</span>
                <span className={styles.labelKey}>Stable Key</span><span className={`${styles.value} ${styles.codeValue}`}>{scopedSelected.key}</span>
                <span className={styles.labelKey}>Element</span><span className={styles.value}>{scopedSelected.tagName || "unknown"}</span>
                <span className={styles.labelKey}>Section Type</span><span className={styles.value}>{scopedSelected.type}</span>
                <span className={styles.labelKey}>Wrapper Class</span><span className={styles.value}>{scopedSelected.wrapperClass}</span>
                <span className={styles.labelKey}>Source</span><span className={styles.value}>{scopedSelected.source}</span>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Content Preview</p>
              <p className={styles.previewText}>
                {scopedSelected.textPreview || "No visible text content detected for this section."}
              </p>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Hierarchy</p>
              <div className={styles.grid}>
                <span className={styles.labelKey}>Parent</span><span className={styles.value}>{scopedSelected.parentNumber || "none"} ({scopedSelected.parentKey || "none"})</span>
                <span className={styles.labelKey}>Children</span><span className={styles.value}>{scopedSelected.childNumbers.join(", ") || "none"} {scopedSelected.childKeys.length ? `(${scopedSelected.childKeys.join(", ")})` : ""}</span>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Layout</p>
              <div className={styles.grid}>
                <span className={styles.labelKey}>Padding</span><span className={styles.value}>{scopedSelected.padding}</span>
                <span className={styles.labelKey}>Margin</span><span className={styles.value}>{scopedSelected.margin}</span>
                <span className={styles.labelKey}>Radius</span><span className={styles.value}>{scopedSelected.radius}</span>
                <span className={styles.labelKey}>Width/Bounds</span><span className={styles.value}>{scopedSelected.width}px × {scopedSelected.height}px at x {scopedSelected.left}, y {scopedSelected.top}</span>
                <span className={styles.labelKey}>Gap from Prev</span><span className={styles.value}>{scopedSelected.computedGapFromPrevious ?? "n/a"} px</span>
                <span className={styles.labelKey}>Left Offset</span><span className={styles.value}>{scopedSelected.computedLeftOffsetFromParent ?? "n/a"} px</span>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Background</p>
              <div className={styles.grid}>
                <span className={styles.labelKey}>Background Token</span><span className={styles.value}>{scopedSelected.backgroundToken}</span>
                <span className={styles.labelKey}>Background Class</span><span className={styles.value}>{scopedSelected.backgroundClass || "none"}</span>
                <span className={styles.labelKey}>Computed Background</span><span className={styles.value}>{scopedSelected.backgroundColor}</span>
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Likely Issues</p>
              <div className={styles.row}>
                {scopedSelected.issueTags.length === 0 && <span className={`${styles.tag} ${styles.tagSuccess}`}>no-issues-detected</span>}
                {scopedSelected.issueTags.map((tag) => (
                  <span key={tag} className={`${styles.tag} ${tagToneClass(tag)}`.trim()}>{tag}</span>
                ))}
              </div>
            </div>

            <div className={styles.sectionBlock}>
              <p className={styles.blockTitle}>Overlay Usage</p>
              <p className={styles.emptyHint}>
                Click any highlighted region to focus it. In Full Screen mode, sidebar sections are pinned and tinted separately so the navigation lane reads more clearly against the main content area.
              </p>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
