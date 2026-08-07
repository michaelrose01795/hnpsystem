// file location: src/components/dev-platform/StaffStyleReviewHighlighter.js
//
// Receiving end of the Staff Style Review "Search" button. The review popup
// links to the audited route with ?styleReviewHighlight=<auditId> plus the
// source reference; this component resolves that reference into locator hints
// (server side), finds the matching node, scrolls to it and rings it.
//
// Mounted once from _app.js. It renders nothing at all unless the highlight
// query parameter is present, so it costs nothing on a normal page view.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Button from "@/components/ui/Button";
import {
  HIGHLIGHT_QUERY_PARAM,
  findHighlightTarget,
} from "@/lib/staff-style-review/highlightLocator";
import styles from "./StaffStyleReviewHighlighter.module.css";

const LOCATE_PATH = "/api/dev/staff-style-review/locate";
// The destination page may still be fetching data, so keep retrying the lookup.
const RETRY_INTERVAL_MS = 300;
const MAX_ATTEMPTS = 25;
const TRACK_INTERVAL_MS = 250;

function parseSourceReference(value) {
  const match = String(value || "").match(/^(src\/[^:]+):(\d+)$/);
  if (!match) return null;
  return { file: match[1], line: Number.parseInt(match[2], 10) };
}

function rectOf(element) {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export default function StaffStyleReviewHighlighter() {
  const router = useRouter();
  const auditId = router.query?.[HIGHLIGHT_QUERY_PARAM];
  const itemName = router.query?.styleReviewItem;
  const sourceReference = router.query?.styleReviewSource;

  const [target, setTarget] = useState(null); // { rect, via, matched }
  const [status, setStatus] = useState("searching"); // searching | found | missing | error
  const [message, setMessage] = useState("");
  const elementRef = useRef(null);

  const dismiss = useCallback(() => {
    elementRef.current = null;
    setTarget(null);
    setStatus("searching");
    const { pathname, query } = router;
    const nextQuery = { ...query };
    delete nextQuery[HIGHLIGHT_QUERY_PARAM];
    delete nextQuery.styleReviewItem;
    delete nextQuery.styleReviewSource;
    router.replace({ pathname, query: nextQuery }, undefined, { shallow: true });
  }, [router]);

  // Resolve the source reference into hints, then poll the DOM until the
  // audited element exists (or we give up).
  useEffect(() => {
    if (!auditId) return undefined;
    const reference = parseSourceReference(sourceReference);
    if (!reference) {
      setStatus("error");
      setMessage("This finding has no parsable source reference, so the element cannot be located automatically.");
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    setStatus("searching");
    setMessage("");
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
          setMessage(`Nothing on this page matched ${reference.file}:${reference.line}. The item may need a different route, a specific record, or an interaction to render.`);
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
  }, [auditId, sourceReference]);

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
    if (!auditId) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [auditId, dismiss]);

  if (!auditId) return null;

  const label = itemName ? `Review ${auditId} — ${itemName}` : `Review ${auditId}`;
  const ringStyle = target
    ? { top: `${target.rect.top}px`, left: `${target.rect.left}px`, width: `${target.rect.width}px`, height: `${target.rect.height}px` }
    : null;

  return (
    <div className={styles.root} data-staff-style-review-highlighter>
      {ringStyle && (
        <div
          className={`${styles.ring} ${target.via === "section" ? styles.ringSection : ""}`.trim()}
          style={ringStyle}
          aria-hidden="true"
        />
      )}
      <div className={styles.panel} role="status" aria-live="polite">
        <p className={styles.title}>{label}</p>
        {status === "searching" && <p className={styles.meta}>Searching this page for the audited element…</p>}
        {status === "found" && (
          <p className={styles.meta}>
            {target?.via === "section"
              ? "Exact element not identified — highlighting the audited section instead."
              : `Matched on ${target?.matched?.slice(0, 3).join(", ") || "source hints"}.`}
          </p>
        )}
        {(status === "missing" || status === "error") && <p className={styles.meta}>{message}</p>}
        {sourceReference && <p className={styles.meta}>{sourceReference}</p>}
        <div className={styles.actions}>
          <Button type="button" size="sm" variant="secondary" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
