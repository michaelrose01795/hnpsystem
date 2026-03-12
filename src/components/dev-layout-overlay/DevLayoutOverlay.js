// file location: src/components/dev-layout-overlay/DevLayoutOverlay.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { useDevLayoutRegistry } from "@/context/DevLayoutRegistryContext";
import styles from "@/components/dev-layout-overlay/DevLayoutOverlay.module.css";

const FALLBACK_SELECTORS = [
  { selector: ".app-page-card", type: "page-shell" },
  { selector: ".app-section-card", type: "content-card" },
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

const buildEntry = ({ key, node, route, order, type, parentKey = "", widthMode = "", isShell = false, backgroundToken = "", source = "explicit" }) => {
  const computed = window.getComputedStyle(node);
  const rect = node.getBoundingClientRect();

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
    classData: String(node.className || "").replace(/\s+/g, " ").trim(),
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

export default function DevLayoutOverlay() {
  const router = useRouter();
  const { registeredSections, syncComputedSections } = useDevLayoutRegistry();
  const { canAccess, enabled, mode, setMode, cycleMode } = useDevLayoutOverlay();
  const [sections, setSections] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [copiedAction, setCopiedAction] = useState("");
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

  const selected = useMemo(
    () => sections.find((section) => section.key === selectedKey) || null,
    [sections, selectedKey]
  );

  const guide = useMemo(() => buildGuide(selected, sections), [selected, sections]);

  useEffect(() => {
    if (!selectedKey) return;
    if (!sections.some((entry) => entry.key === selectedKey)) {
      setSelectedKey("");
    }
  }, [sections, selectedKey]);

  useEffect(() => {
    if (!copiedAction) return undefined;
    const timer = window.setTimeout(() => setCopiedAction(""), 1600);
    return () => window.clearTimeout(timer);
  }, [copiedAction]);

  if (!canAccess || !enabled) return null;

  const canInspectClick = true;
  const handleCopy = async (type, text) => {
    await copyText(text);
    setCopiedAction(type);
  };

  return (
    <div className={styles.root} aria-hidden="true">
      {sections.map((section) => {
        const selectedClass = selected?.key === section.key ? styles.boxSelected : "";
        const labelText = mode === "labels" ? section.number : `${section.number} · ${section.type} · ${section.backgroundToken}`;

        return (
          <React.Fragment key={section.key}>
            {canInspectClick && (
              <button
                type="button"
                className={styles.inspectButton}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setSelectedKey(section.key);
                }}
                style={{
                  left: section.rect.left,
                  top: section.rect.top,
                  width: section.rect.width,
                  height: section.rect.height,
                }}
                title={`${section.number} (${section.key})`}
              />
            )}
            <div
              className={`${styles.box} ${selectedClass}`.trim()}
              style={{
                left: section.rect.left,
                top: section.rect.top,
                width: section.rect.width,
                height: section.rect.height,
              }}
            />
            <div
              className={`${styles.label} ${mode !== "labels" ? styles.labelDetails : ""}`}
              style={{ left: section.rect.left + 6, top: Math.max(6, section.rect.top - 10) }}
            >
              {labelText}
            </div>
          </React.Fragment>
        );
      })}

      {selected && guide && (
        <>
          {guide.parent && (
            <>
              <div
                className={styles.guideLine}
                style={{
                  left: guide.parent.rect.left,
                  top: selected.rect.top - 12,
                  width: Math.max(1, selected.rect.left - guide.parent.rect.left),
                  height: 1,
                }}
              />
              <div className={styles.guideLabel} style={{ left: guide.parent.rect.left + 4, top: selected.rect.top - 24 }}>
                left {guide.leftGap}px
              </div>
            </>
          )}

          {guide.previous && (
            <>
              <div
                className={styles.guideLine}
                style={{
                  left: selected.rect.left - 10,
                  top: guide.previous.rect.bottom,
                  width: 1,
                  height: Math.max(1, selected.rect.top - guide.previous.rect.bottom),
                }}
              />
              <div className={styles.guideLabel} style={{ left: selected.rect.left + 2, top: guide.previous.rect.bottom + 4 }}>
                gap {guide.topGap}px
              </div>
            </>
          )}

          <div
            className={styles.guideLine}
            style={{
              left: selected.rect.left,
              top: selected.rect.bottom + 6,
              width: selected.rect.width,
              height: 1,
            }}
          />
          <div className={styles.guideLabel} style={{ left: selected.rect.left + 8, top: selected.rect.bottom + 8 }}>
            width {guide.width}px
          </div>
        </>
      )}

      {selected && (
        <aside className={styles.panel} role="dialog" aria-label="Dev layout inspector">
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.kicker}>DEV LAYOUT INSPECTOR</p>
              <h3 className={styles.title}>
                Section {selected.number} · {selected.key}
              </h3>
            </div>
            <button type="button" className={styles.button} onClick={() => setSelectedKey("")}>Close</button>
          </div>

          <div className={styles.row}>
            <button
              type="button"
              className={`${styles.button} ${mode === "labels" ? styles.buttonSelected : ""}`.trim()}
              aria-pressed={mode === "labels"}
              onClick={() => setMode("labels")}
            >
              Labels
            </button>
            <button
              type="button"
              className={`${styles.button} ${mode === "details" ? styles.buttonSelected : ""}`.trim()}
              aria-pressed={mode === "details"}
              onClick={() => setMode("details")}
            >
              Details
            </button>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary} ${mode === "inspect" ? styles.buttonSelected : ""}`.trim()}
              aria-pressed={mode === "inspect"}
              onClick={cycleMode}
            >
              Cycle Mode
            </button>
          </div>

          {(() => {
            const prompts = buildPrompts(selected);
            return (
              <div className={styles.sectionBlock}>
                <p className={styles.blockTitle}>Copy Tools</p>
                <div className={styles.row}>
                  <button type="button" className={styles.button} onClick={() => handleCopy("reference", prompts.reference)}>Copy section reference</button>
                  <button type="button" className={styles.button} onClick={() => handleCopy("debug", prompts.debug)}>Copy debug summary</button>
                  <button type="button" className={styles.button} onClick={() => handleCopy("codex", prompts.codex)}>Copy Codex prompt</button>
                  <button type="button" className={styles.button} onClick={() => handleCopy("claude", prompts.claude)}>Copy Claude prompt</button>
                </div>
                <p className={styles.copyStatus}>{copiedAction ? `Copied ${copiedAction}` : " "}</p>
              </div>
            );
          })()}

          <div className={styles.sectionBlock}>
            <p className={styles.blockTitle}>Identity</p>
            <div className={styles.grid}>
              <span className={styles.labelKey}>Route</span><span className={styles.value}>{selected.route}</span>
              <span className={styles.labelKey}>Section Number</span><span className={styles.value}>{selected.number}</span>
              <span className={styles.labelKey}>Stable Key</span><span className={`${styles.value} ${styles.codeValue}`}>{selected.key}</span>
              <span className={styles.labelKey}>Section Type</span><span className={styles.value}>{selected.type}</span>
              <span className={styles.labelKey}>Wrapper Class</span><span className={styles.value}>{selected.wrapperClass}</span>
              <span className={styles.labelKey}>Source</span><span className={styles.value}>{selected.source}</span>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <p className={styles.blockTitle}>Hierarchy</p>
            <div className={styles.grid}>
              <span className={styles.labelKey}>Parent</span><span className={styles.value}>{selected.parentNumber || "none"} ({selected.parentKey || "none"})</span>
              <span className={styles.labelKey}>Children</span><span className={styles.value}>{selected.childNumbers.join(", ") || "none"} {selected.childKeys.length ? `(${selected.childKeys.join(", ")})` : ""}</span>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <p className={styles.blockTitle}>Layout</p>
            <div className={styles.grid}>
              <span className={styles.labelKey}>Padding</span><span className={styles.value}>{selected.padding}</span>
              <span className={styles.labelKey}>Margin</span><span className={styles.value}>{selected.margin}</span>
              <span className={styles.labelKey}>Radius</span><span className={styles.value}>{selected.radius}</span>
              <span className={styles.labelKey}>Width/Bounds</span><span className={styles.value}>{selected.width}px × {selected.height}px at x {selected.left}, y {selected.top}</span>
              <span className={styles.labelKey}>Gap from Prev</span><span className={styles.value}>{selected.computedGapFromPrevious ?? "n/a"} px</span>
              <span className={styles.labelKey}>Left Offset</span><span className={styles.value}>{selected.computedLeftOffsetFromParent ?? "n/a"} px</span>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <p className={styles.blockTitle}>Background</p>
            <div className={styles.grid}>
              <span className={styles.labelKey}>Background Token</span><span className={styles.value}>{selected.backgroundToken}</span>
              <span className={styles.labelKey}>Background Class</span><span className={styles.value}>{selected.backgroundClass || "none"}</span>
              <span className={styles.labelKey}>Computed Background</span><span className={styles.value}>{selected.backgroundColor}</span>
            </div>
          </div>

          <div className={styles.sectionBlock}>
            <p className={styles.blockTitle}>Likely Issues</p>
            <div className={styles.row}>
            {selected.issueTags.length === 0 && <span className={styles.tag}>no-issues-detected</span>}
            {selected.issueTags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
