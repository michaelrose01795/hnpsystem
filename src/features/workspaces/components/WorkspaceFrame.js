// file location: src/features/workspaces/components/WorkspaceFrame.js
//
// Body of an extra workspace: a same-origin iframe of the app, named so the
// document inside knows it is a workspace (see workspaceBridge.js). Until the
// frame reports READY it stays invisible behind the page skeleton, so its one
// pre-hydration render of full chrome is never seen.
//
// The iframe's src is set ONCE per page the host asks for. Navigation inside
// the frame never touches src (that would reload it); the host drives an
// already-loaded frame by message instead.
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { WORKSPACE_MESSAGES, frameNameFor } from "@/features/workspaces/workspaceBridge";

// If a page inside the frame never mounts the bridge (it crashed, or it
// redirected somewhere without the staff shell) reveal it anyway.
const READY_FALLBACK_MS = 8000;
const MAX_START_LINKS = 9;

const WorkspaceFrame = forwardRef(function WorkspaceFrame(
  { id, href, label, primaryHref, primaryLabel, navigationItems, onChoose },
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
    const links = (navigationItems || [])
      .filter((item) => item?.href && item?.label)
      .slice(0, MAX_START_LINKS);
    return (
      <div className="app-workspace-frame app-workspace-frame--start">
        <LayerSurface className="app-workspace-start">
          <EmptyState
            variant="bare"
            title="Choose a page for this workspace"
            description="This workspace is focused, so the sidebar now opens pages here. You can also start from one of these."
            action={
              primaryHref ? (
                <Button variant="primary" onClick={() => onChoose(primaryHref)} symbol={false}>
                  {`Open ${primaryLabel} here too`}
                </Button>
              ) : null
            }
          />
          {links.length > 0 && (
            <div className="app-workspace-start__links">
              {links.map((item) => (
                <Button
                  key={`${item.label}|${item.href}`}
                  variant="secondary"
                  symbol={false}
                  onClick={() => onChoose(item.href)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          )}
        </LayerSurface>
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
        title={`Workspace: ${label}`}
        className={`app-workspace-frame__iframe${ready ? "" : " is-loading"}`}
      />
    </div>
  );
});

export default WorkspaceFrame;
