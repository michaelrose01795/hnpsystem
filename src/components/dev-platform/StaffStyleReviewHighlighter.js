// file location: src/components/dev-platform/StaffStyleReviewHighlighter.js
//
// Receiving end of the Staff Style Review "Search / View Item" button.
//
// Two jobs, both DEVELOPER-PLATFORM ONLY (the synthetic `dev` login — see
// hasDevPlatformPageAccess). No other account ever mounts any of this:
//
//   1. Highlight — resolves the finding's `file:line` into locator hints
//      (server side), finds the matching node, scrolls to it and rings it.
//   2. Review command panel — a floating, draggable command button (same
//      pattern as the floating Notes bubble) that opens a panel holding the
//      whole finding: route, section/item, how to see it, audit rationale,
//      source reference and a one-click Codex prompt. It survives navigation
//      because the finding is parked in sessionStorage, so the reviewer never
//      has to go back to /dev/staff-style-review and reload the page.
//
// Mounted once from _app.js. Renders nothing at all until a review context
// exists, so it costs nothing on a normal page view.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import { useUser } from "@/context/UserContext";
import { hasDevPlatformPageAccess } from "@/lib/auth/devSession";
import { buildCodexPrompt } from "@/lib/staff-style-review/codexPrompt";
import {
  REVIEW_CONTEXT_EVENT,
  clearReviewContext,
  readReviewContext,
} from "@/lib/staff-style-review/reviewContext";
import { HIGHLIGHT_QUERY_PARAM, findHighlightTarget } from "@/lib/staff-style-review/highlightLocator";
import styles from "./StaffStyleReviewHighlighter.module.css";

const LOCATE_PATH = "/api/dev/staff-style-review/locate";
const STYLE_REVIEW_PATH = "/dev/staff-style-review";
// The destination page may still be fetching data, so keep retrying the lookup.
const RETRY_INTERVAL_MS = 300;
const MAX_ATTEMPTS = 25;
const TRACK_INTERVAL_MS = 250;
const BUBBLE_SIZE = 52;
const DRAG_THRESHOLD = 4;
const BUBBLE_POSITION_KEY = "hnp-style-review-command-bubble";
const PANEL_POSITION_KEY = "hnp-style-review-command-panel";
const PANEL_MARGIN = 8;

const CATEGORY_TONES = Object.freeze({
  badge: "accent-soft",
  button: "success",
  input: "warning",
  popup: "neutral",
  specialised: "danger",
});

const STATUS_TONES = Object.freeze({
  Pending: "neutral",
  Keep: "success",
  Change: "danger",
  "Unable to Locate": "neutral",
  "Needs Manual Review": "warning",
  "Final Check": "accent-soft",
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function projectToNearestEdge(position) {
  if (typeof window === "undefined") return position;
  const maxX = Math.max(0, window.innerWidth - BUBBLE_SIZE);
  const maxY = Math.max(0, window.innerHeight - BUBBLE_SIZE);
  const x = clamp(position.x, 0, maxX);
  const y = clamp(position.y, 0, maxY);
  const distances = { left: x, right: maxX - x, top: y, bottom: maxY - y };
  const nearest = Object.keys(distances).reduce((best, side) => (distances[side] < distances[best] ? side : best), "left");
  if (nearest === "left") return { x: 0, y };
  if (nearest === "right") return { x: maxX, y };
  if (nearest === "top") return { x, y: 0 };
  return { x, y: maxY };
}

// Bottom-left by default so it never lands on top of the floating Notes bubble.
function defaultBubblePosition() {
  if (typeof window === "undefined") return { x: 0, y: 0 };
  return { x: 0, y: Math.max(0, window.innerHeight - BUBBLE_SIZE - 96) };
}

function parseSourceReference(value) {
  const match = String(value || "").replace(/`/g, "").trim().match(/^(src\/[^:]+):(\d+)$/);
  if (!match) return null;
  return { file: match[1], line: Number.parseInt(match[2], 10) };
}

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

/** Command-panel glyph: a terminal window with a prompt caret. */
function CommandIcon() {
  return (
    <svg className={styles.bubbleIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="2.6" y="4.2" width="18.8" height="15.6" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 10.2l2.7 2.4L7 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.6 15.2h4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Four-way move arrows — the drag grip on the command panel header. */
function MoveIcon() {
  return (
    <svg className={styles.moveIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M12 3.2v17.6M3.2 12h17.6M12 3.2L9.4 5.9M12 3.2l2.6 2.7M12 20.8l-2.6-2.7M12 20.8l2.6-2.7M3.2 12l2.7-2.6M3.2 12l2.7 2.6M20.8 12l-2.7-2.6M20.8 12l-2.7 2.6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelField({ label, value, mono = false }) {
  const text = String(value || "").replace(/`/g, "").trim();
  if (!text) return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <p className={`${styles.fieldValue} ${mono ? styles.fieldValueMono : ""}`.trim()}>{text}</p>
    </div>
  );
}

export default function StaffStyleReviewHighlighter() {
  const router = useRouter();
  const { user } = useUser() || {};
  const isDeveloperPlatform = hasDevPlatformPageAccess(user);

  const [context, setContext] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [runId, setRunId] = useState(0);
  const [pulseId, setPulseId] = useState(0);
  const [target, setTarget] = useState(null); // { rect, via, matched }
  const [status, setStatus] = useState("idle"); // idle | searching | found | missing | error
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [bubblePosition, setBubblePosition] = useState(null);
  // null until the reviewer drags the panel (or a stored position is restored) —
  // until then it sits anchored beside the bubble via the CSS classes.
  const [panelPosition, setPanelPosition] = useState(null);

  const elementRef = useRef(null);
  const dragRef = useRef(null);
  const panelRef = useRef(null);
  const panelDragRef = useRef(null);
  const movedRef = useRef(false);
  // Serialised copy of the stored context, so a re-read that produced identical
  // data keeps the same object reference and does not restart the locate.
  const contextRawRef = useRef(null);
  // Set by "Finish review" so the URL fallback cannot resurrect the panel while
  // the handshake params are still being stripped from the address bar.
  const finishedRef = useRef(false);

  // Read off the query as primitives — `router.query` is a fresh object on every
  // render, so depending on it directly would re-register the listeners endlessly.
  const queryAuditId = router.query?.[HIGHLIGHT_QUERY_PARAM] || "";
  const queryItem = router.query?.styleReviewItem || "";
  const querySource = router.query?.styleReviewSource || "";

  const prompt = useMemo(() => buildCodexPrompt(context, context?.reviewNotes), [context]);
  const auditedPathname = context?.destination?.pathname || null;
  const onAuditedRoute = Boolean(auditedPathname) && router.pathname === auditedPathname;

  // ---------------------------------------------------------------- context
  // The finding is parked in sessionStorage by the review popup, so it survives
  // the navigation (and any later reload) until the reviewer clears it.
  useEffect(() => {
    if (!isDeveloperPlatform) {
      contextRawRef.current = null;
      setContext(null);
      return undefined;
    }
    const sync = () => {
      // Stored context wins; a hand-typed / bookmarked highlight URL still works
      // on its own (that was the original handshake) but carries less detail.
      const stored = readReviewContext();
      if (stored) finishedRef.current = false; // a fresh hand-off re-arms the panel
      const next = stored || (!finishedRef.current && queryAuditId
        ? {
          auditId: String(queryAuditId),
          sectionName: queryItem,
          sourceReference: querySource,
          destination: { pathname: router.pathname },
        }
        : null);
      const raw = next ? JSON.stringify(next) : null;
      if (raw === contextRawRef.current) return;
      contextRawRef.current = raw;
      setContext(next);
    };
    sync();
    window.addEventListener(REVIEW_CONTEXT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(REVIEW_CONTEXT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isDeveloperPlatform, router.asPath, router.pathname, queryAuditId, queryItem, querySource]);

  // A manual "Search this page" applies to that page only — leaving it drops
  // back to "run automatically on the audited route".
  useEffect(() => { setRunId(0); }, [router.asPath]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // The panel's own box, needed to clamp it inside the viewport. Resolved from
  // the DOM marker as well as the ref so it works whether or not the surface
  // primitive forwards refs.
  const panelElement = useCallback(
    () => panelRef.current || (typeof document === "undefined" ? null : document.querySelector("[data-style-review-panel]")),
    []
  );

  const persistBubble = useCallback((position) => {
    try {
      window.localStorage.setItem(BUBBLE_POSITION_KEY, JSON.stringify(position));
    } catch {
      // Position is a convenience only — losing it costs nothing.
    }
  }, []);

  const persistPanel = useCallback((position) => {
    try {
      window.localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify(position));
    } catch {
      // Position is a convenience only — losing it costs nothing.
    }
  }, []);

  // Keeps the panel wholly on screen, measured from its own rendered box so a
  // long finding (taller panel) cannot be dragged off the bottom.
  const clampPanel = useCallback((position) => {
    if (typeof window === "undefined") return position;
    const rect = panelElement()?.getBoundingClientRect();
    const width = rect?.width || 400;
    const height = rect?.height || 320;
    return {
      x: clamp(position.x, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)),
      y: clamp(position.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
    };
  }, [panelElement]);

  // -------------------------------------------------------------- bubble pos
  useEffect(() => {
    if (!context || bubblePosition) return;
    let stored = null;
    try {
      stored = JSON.parse(window.localStorage.getItem(BUBBLE_POSITION_KEY) || "null");
    } catch {
      stored = null;
    }
    setBubblePosition(projectToNearestEdge(stored && typeof stored.x === "number" ? stored : defaultBubblePosition()));
  }, [context, bubblePosition]);

  // Where the reviewer last parked the panel, restored so it reopens in place.
  useEffect(() => {
    if (!context || panelPosition) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem(PANEL_POSITION_KEY) || "null");
      if (stored && typeof stored.x === "number" && typeof stored.y === "number") setPanelPosition(stored);
    } catch {
      // Fall back to the anchored position beside the bubble.
    }
  }, [context, panelPosition]);

  useEffect(() => {
    if (!context) return undefined;
    const onResize = () => {
      setBubblePosition((current) => (current ? projectToNearestEdge(current) : current));
      setPanelPosition((current) => (current ? clampPanel(current) : current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [context, clampPanel]);

  useEffect(() => {
    if (!context) return undefined;
    const onPointerMove = (event) => {
      const bubbleDrag = dragRef.current;
      if (bubbleDrag && bubbleDrag.pointerId === event.pointerId) {
        event.preventDefault();
        const dx = event.clientX - bubbleDrag.startX;
        const dy = event.clientY - bubbleDrag.startY;
        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedRef.current = true;
        setBubblePosition(projectToNearestEdge({ x: bubbleDrag.initialX + dx, y: bubbleDrag.initialY + dy }));
      }

      const panelDrag = panelDragRef.current;
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        event.preventDefault();
        setPanelPosition(clampPanel({
          x: panelDrag.initialX + (event.clientX - panelDrag.startX),
          y: panelDrag.initialY + (event.clientY - panelDrag.startY),
        }));
      }
    };
    const onPointerUp = (event) => {
      const bubbleDrag = dragRef.current;
      if (bubbleDrag && bubbleDrag.pointerId === event.pointerId) {
        dragRef.current = null;
        if (!movedRef.current) setPanelOpen((open) => !open);
        else setBubblePosition((current) => { if (current) persistBubble(current); return current; });
      }

      const panelDrag = panelDragRef.current;
      if (panelDrag && panelDrag.pointerId === event.pointerId) {
        panelDragRef.current = null;
        setPanelPosition((current) => { if (current) persistPanel(current); return current; });
      }

      if (!dragRef.current && !panelDragRef.current) document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [context, persistBubble, persistPanel, clampPanel]);

  const startDrag = (event) => {
    if (!bubblePosition) return;
    event.preventDefault();
    movedRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: bubblePosition.x,
      initialY: bubblePosition.y,
    };
  };

  const startPanelDrag = (event) => {
    const rect = panelElement()?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    document.body.style.userSelect = "none";
    panelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
  };

  // ------------------------------------------------------------- the locate
  // Runs when the reviewer lands on the audited route, and again on demand.
  useEffect(() => {
    if (!context) return undefined;
    if (!onAuditedRoute && runId === 0) {
      setStatus("idle");
      setTarget(null);
      setMessage("");
      return undefined;
    }

    const reference = parseSourceReference(context.sourceReference);
    if (!reference) {
      setStatus("error");
      setMessage("This finding has no parsable source reference, so the element cannot be located automatically.");
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    setStatus("searching");
    setMessage("");
    setTarget(null);
    elementRef.current = null;

    (async () => {
      let payload;
      try {
        const response = await fetch(`${LOCATE_PATH}?file=${encodeURIComponent(reference.file)}&line=${reference.line}`);
        payload = await response.json();
        if (!response.ok) throw new Error(payload?.message || "Locator hints could not be loaded.");
      } catch (locateError) {
        if (cancelled) return;
        setStatus("error");
        setMessage(locateError.message || "Locator hints could not be loaded.");
        return;
      }
      if (cancelled) return;

      let attempts = 0;
      const attempt = () => {
        if (cancelled) return;
        attempts += 1;
        const found = findHighlightTarget(document, payload.data);
        if (found) {
          elementRef.current = found.element;
          found.element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
          setTarget({ rect: rectOf(found.element), via: found.via, matched: found.matched });
          setStatus("found");
          return;
        }
        if (attempts >= MAX_ATTEMPTS) {
          setStatus("missing");
          setMessage(`Nothing on this page matched ${reference.file}:${reference.line}. The item may need a specific record, a tab, or an interaction to render.`);
          return;
        }
        timer = window.setTimeout(attempt, RETRY_INTERVAL_MS);
      };
      attempt();
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [context, onAuditedRoute, runId, router.asPath]);

  // Keep the ring glued to the element while the page scrolls, resizes or reflows.
  useEffect(() => {
    if (status !== "found") return undefined;
    const sync = () => {
      const element = elementRef.current;
      if (!element || !element.isConnected) {
        setStatus("missing");
        setMessage("The highlighted element left the page.");
        setTarget(null);
        return;
      }
      setTarget((current) => (current ? { ...current, rect: rectOf(element) } : current));
    };
    const interval = window.setInterval(sync, TRACK_INTERVAL_MS);
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [status]);

  useEffect(() => {
    if (!context) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") setPanelOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [context]);

  const finish = useCallback(() => {
    elementRef.current = null;
    contextRawRef.current = null;
    finishedRef.current = true;
    setTarget(null);
    setStatus("idle");
    clearReviewContext();
    setContext(null);
    // Straight back to the audit table to record the decision. Navigating away
    // also drops the handshake query params, so the URL fallback cannot rebuild
    // the context the reviewer just finished with.
    if (router.pathname !== STYLE_REVIEW_PATH) router.push(STYLE_REVIEW_PATH);
  }, [router]);

  // One action for "take me to it": off the audited route it navigates there
  // (the locate then runs automatically on arrival), on the audited route it
  // re-runs the locate, and when the element is already ringed it just scrolls
  // back to it rather than paying for the lookup again.
  const highlight = useCallback(() => {
    if (!context) return;
    setPulseId((count) => count + 1); // remounts the ring so it pulses again
    if (!onAuditedRoute && context.destination) {
      router.push(context.destination);
      return;
    }
    const element = elementRef.current;
    if (status === "found" && element?.isConnected) {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      return;
    }
    setRunId((count) => count + 1);
  }, [context, onAuditedRoute, router, status]);

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [prompt]);

  if (!isDeveloperPlatform || !context || !bubblePosition) return null;

  const ringStyle = target
    ? { top: `${target.rect.top}px`, left: `${target.rect.left}px`, width: `${target.rect.width}px`, height: `${target.rect.height}px` }
    : null;
  const statusLine =
    status === "searching" ? "Searching this page for the audited element…"
      : status === "found"
        ? (target?.via === "section"
          ? "Exact element not identified — highlighting the audited section instead."
          : `Matched on ${target?.matched?.slice(0, 3).join(", ") || "source hints"}.`)
        : status === "idle"
          ? `Not on the audited route${auditedPathname ? ` (${auditedPathname})` : ""} — press Highlight to open it and ring the element.`
          : message;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;
  // Until the reviewer drags it, the panel opens on the side away from the
  // bubble's parked edge. After a drag, `panelPosition` takes over completely.
  const panelAnchorClass = bubblePosition.x > viewportWidth / 2 ? styles.panelRight : styles.panelLeft;

  return (
    <div className={styles.root} data-staff-style-review-highlighter>
      {ringStyle && (
        <div
          key={pulseId}
          className={`${styles.ring} ${target.via === "section" ? styles.ringSection : ""}`.trim()}
          style={ringStyle}
          aria-hidden="true"
        />
      )}

      {/* Floating command button — same interaction as the floating Notes bubble:
          drag to reposition (snaps to the nearest edge), tap to toggle the panel. */}
      <button
        type="button"
        className={`app-btn app-btn--primary ${styles.bubble} ${panelOpen ? styles.bubbleOpen : ""}`.trim()}
        style={{ left: bubblePosition.x, top: bubblePosition.y }}
        onPointerDown={startDrag}
        aria-expanded={panelOpen}
        aria-label={`Staff Style Review command panel for Review ${context.auditId}`}
        title={`Review ${context.auditId} — style review command panel`}
      >
        <CommandIcon />
      </button>

      {panelOpen && (
        <LayerSurface
          as="section"
          ref={panelRef}
          className={`${styles.panel} ${panelPosition ? "" : panelAnchorClass} themed-scrollbar`.replace(/\s+/g, " ").trim()}
          radius="var(--section-card-radius)"
          padding="var(--section-card-padding)"
          gap="var(--layout-card-gap)"
          style={panelPosition
            ? { left: `${panelPosition.x}px`, top: `${panelPosition.y}px` }
            : { top: `${clamp(bubblePosition.y, PANEL_MARGIN, Math.max(PANEL_MARGIN, viewportHeight - 120))}px` }}
          role="dialog"
          aria-label={`Review ${context.auditId} command panel`}
          data-style-review-panel="true"
        >
          <LayerTheme radius="var(--radius-sm)" padding="var(--space-sm)" gap="var(--space-xs)">
            <div className={styles.headerRow}>
              <strong className={styles.title}>Review {context.auditId}</strong>
              {/* Drag-to-move grip. The panel is closed from the command bubble
                  (or Escape), so this handle is purely for repositioning. */}
              <span
                className={styles.moveHandle}
                onPointerDown={startPanelDrag}
                role="button"
                tabIndex={-1}
                aria-label="Drag to move the command panel"
                title="Drag to move this panel"
              >
                <MoveIcon />
              </span>
            </div>
            <div className={styles.badges}>
              {context.type && <span className={`app-badge app-badge--${CATEGORY_TONES[context.category] || "neutral"}`}>{context.type}</span>}
              {context.reviewStatus && <span className={`app-badge app-badge--${STATUS_TONES[context.reviewStatus] || "neutral"}`}>{context.reviewStatus}</span>}
              {context.partialAdoption && <span className="app-badge app-badge--warning">Partial adoption</span>}
            </div>
            <p className={styles.statusLine} role="status" aria-live="polite">{statusLine}</p>
          </LayerTheme>

          <LayerTheme radius="var(--radius-sm)" padding="var(--space-sm)" gap="var(--space-sm)">
            <PanelField label="Section / item" value={context.sectionName} />
            <PanelField label="Audited route" value={context.route} />
            <PanelField label="How to see it" value={context.visibilityInstructions} />
            <PanelField label="Audit rationale" value={context.issueSummary} />
            <PanelField label="Source reference" value={context.sourceReference} mono />
            <PanelField label="Reviewer notes" value={context.reviewNotes} />
          </LayerTheme>

          <div className="app-layout-toolbar-row app-toolbar--action">
            <Button
              type="button"
              size="sm"
              onClick={highlight}
              title={onAuditedRoute
                ? "Scroll to the audited element and ring it again"
                : `Open ${auditedPathname || "the audited route"} and highlight the audited element`}
            >
              {onAuditedRoute ? "Highlight again" : "Highlight"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={copyPrompt}>
              {copied ? "Codex prompt copied" : "Copy Codex prompt"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => router.push(STYLE_REVIEW_PATH)}
              title="Open the audit table, keeping this finding loaded in the command panel"
            >
              Back to Style Review
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={finish}
              title="Clear this finding and return to the audit table"
            >
              Finish review
            </Button>
          </div>
        </LayerSurface>
      )}
    </div>
  );
}
