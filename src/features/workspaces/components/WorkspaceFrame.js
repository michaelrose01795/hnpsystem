// file location: src/features/workspaces/components/WorkspaceFrame.js
//
// Body of a workspace card: a same-origin iframe of the app, named so the
// document inside knows it is a workspace (see workspaceBridge.js). The iframe
// is the card's own viewport, so the page inside reflows to the card's width
// and its popups centre in the card. Until the frame reports READY it stays
// invisible behind the page skeleton, so its one pre-hydration render of full
// chrome is never seen.
//
// The iframe's src is set ONCE per page the host asks for. Navigation inside
// the frame never touches src (that would reload it); the host drives an
// already-loaded frame by message instead.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { WORKSPACE_MESSAGES, frameNameFor } from "@/features/workspaces/workspaceBridge";

// If a page inside the frame never mounts the bridge (it crashed, or it
// redirected somewhere without the staff shell) reveal it anyway.
const READY_FALLBACK_MS = 8000;

// The start panel's looping how-to: a cursor clicks the empty card to select
// it, then a page in the sidebar, and the card fills. Drawn in the surface
// ladder's tokens and animated purely in CSS (.app-workspace-demo in
// workspaces.css); with reduced motion it shows the finished state instead.
function WorkspaceStartDemo() {
  return (
    <svg className="app-workspace-demo" viewBox="0 0 240 150" aria-hidden="true" focusable="false">
      <rect className="app-workspace-demo__screen" x="0" y="0" width="240" height="150" rx="12" />
      <rect className="app-workspace-demo__panel" x="8" y="8" width="48" height="134" rx="8" />
      {[0, 1, 2, 3].map((index) => (
        <rect
          key={index}
          className={`app-workspace-demo__nav${index === 2 ? " app-workspace-demo__nav--target" : ""}`}
          x="16"
          y={20 + index * 18}
          width="32"
          height="8"
          rx="4"
        />
      ))}
      <rect className="app-workspace-demo__panel" x="64" y="8" width="80" height="134" rx="8" />
      {[48, 64, 40, 56].map((width, index) => (
        <rect key={index} className="app-workspace-demo__line" x="72" y={20 + index * 14} width={width} height="6" rx="3" />
      ))}
      <rect className="app-workspace-demo__panel" x="152" y="8" width="80" height="134" rx="8" />
      <rect className="app-workspace-demo__focus" x="152" y="8" width="80" height="134" rx="8" />
      {[56, 44, 64, 36].map((width, index) => (
        <rect
          key={index}
          className="app-workspace-demo__line app-workspace-demo__line--new"
          x="160"
          y={20 + index * 14}
          width={width}
          height="6"
          rx="3"
        />
      ))}
      <circle className="app-workspace-demo__click app-workspace-demo__click--card" cx="192" cy="76" r="10" />
      <circle className="app-workspace-demo__click app-workspace-demo__click--nav" cx="32" cy="60" r="10" />
      <g className="app-workspace-demo__cursor">
        <path d="M0 0 L0 15 L4 11 L7 17 L9.5 16 L6.5 10 L12 10 Z" />
      </g>
    </svg>
  );
}

const WorkspaceFrame = forwardRef(function WorkspaceFrame(
  { id, href, label, isFocused = false, suggestHref, suggestLabel, onChoose },
  ref
) {
  const iframeRef = useRef(null);
  const [src, setSrc] = useState(href || null);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);

  const markReady = useCallback(() => {
    readyRef.current = true;
    setReady(true);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      contentWindow: () => iframeRef.current?.contentWindow || null,
      markReady,
      post: (message) => {
        const win = iframeRef.current?.contentWindow;
        if (!win || !readyRef.current) return;
        win.postMessage(message, window.location.origin);
      },
      navigate: (nextHref) => {
        if (!nextHref) return;
        const win = iframeRef.current?.contentWindow;
        if (win && readyRef.current) {
          win.postMessage({ type: WORKSPACE_MESSAGES.NAVIGATE, href: nextHref }, window.location.origin);
          return;
        }
        // Not loaded yet (or showing the start panel): load it directly.
        readyRef.current = false;
        setReady(false);
        setSrc(nextHref);
      },
      reload: () => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        readyRef.current = false;
        setReady(false);
        try {
          win.location.reload();
        } catch {
          // Same-origin by construction; ignore if the frame is mid-teardown.
        }
      },
    }),
    [markReady]
  );

  useEffect(() => {
    if (!src || ready) return undefined;
    const timer = window.setTimeout(markReady, READY_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [src, ready, markReady]);

  if (!src) {
    // Sits directly on the card's --surface fill (.app-workspace-pane), so no
    // extra layer here: a LayerSurface would stack surface on surface.
    return (
      <div className="app-workspace-frame app-workspace-frame--start">
        <div className="app-workspace-start">
          <EmptyState
            variant="bare"
            illustration={<WorkspaceStartDemo />}
            title="Open a page from the sidebar"
            description={
              isFocused
                ? "This card is selected. Pick any page in the sidebar, or search in the top bar, and it opens here."
                : "Click this card to select it, then pick a page in the sidebar."
            }
            action={
              suggestHref ? (
                <Button variant="secondary" onClick={() => onChoose(suggestHref)} symbol={false}>
                  {`Open ${suggestLabel} here too`}
                </Button>
              ) : null
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-workspace-frame" aria-busy={!ready || undefined}>
      {!ready && (
        <div className="app-workspace-frame__loading" aria-hidden="true">
          <PageSkeleton href={src} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        key={src}
        name={frameNameFor(id)}
        src={src}
        // aria-label, not title: GlobalTooltip turns any `title` into a hover
        // tooltip, which would float over the whole card.
        aria-label={`Workspace: ${label}`}
        className={`app-workspace-frame__iframe${ready ? "" : " is-loading"}`}
      />
    </div>
  );
});

export default WorkspaceFrame;
