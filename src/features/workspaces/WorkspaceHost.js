// file location: src/features/workspaces/WorkspaceHost.js
//
// The multi-workspace DMS shell. Mounted once by StaffLayout around the main
// column (the PRIMARY workspace) and never anywhere else, so every current and
// future staff page gets workspaces without any page-level code.
//
// Single-screen behaviour is unchanged by construction: with only the primary
// workspace, the wrapper and the primary slot are `display: contents`, render
// no bar and add no box, so the main column lays out exactly as it did before.
// The DOM nesting is the same in both modes, which is also what stops the
// primary page from remounting (and losing its state) when a workspace is added.
//
// Extra workspaces are same-origin iframes of the app in embedded mode (see
// WorkspaceEmbedBridge): same NextAuth session, same roles, same theme storage,
// their own router and page state. Every frame stays mounted while it exists —
// collapsed ones are hidden, not removed — and on-screen order is CSS `order`,
// so swapping or collapsing never reloads a page.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/router";
import { isPublicVhcReportPath } from "@/config/routeAccess";
import { buildKey, readJSON, writeJSON } from "@/lib/topbar/workspaceStorage";
import {
  PRIMARY_WORKSPACE_ID,
  MAX_WORKSPACES,
  createInitialState,
  workspaceReducer,
  computeLayout,
  fitCapacity,
  suggestCapacity,
  shouldOfferWorkspace,
  activePresetId,
  pickOtherWorkspace,
  weightOf,
  labelForHref,
  toWorkspaceHref,
  serializeState,
  deserializeState,
} from "@/features/workspaces/workspaceModel";
import {
  WORKSPACE_MESSAGES,
  OPEN_IN_WORKSPACE_EVENT,
  setWorkspaceHostAvailable,
} from "@/features/workspaces/workspaceBridge";
import { bindWorkspaceLinkTargets } from "@/features/workspaces/workspaceLinks";
import WorkspacePaneBar from "@/features/workspaces/components/WorkspacePaneBar";
import WorkspaceFrame from "@/features/workspaces/components/WorkspaceFrame";
import WorkspaceDivider from "@/features/workspaces/components/WorkspaceDivider";
import WorkspaceSpacePrompt from "@/features/workspaces/components/WorkspaceSpacePrompt";

const STORAGE_FEATURE = "multi-workspace";
// Marks the one global sidebar. Its links open in the focused workspace.
export const GLOBAL_NAV_ATTRIBUTE = "data-workspace-nav";

const toHref = (raw) =>
  typeof window === "undefined"
    ? null
    : toWorkspaceHref(raw, window.location.origin, isPublicVhcReportPath);

// Stable per-id callback refs, so React does not detach/re-attach every render.
function useKeyedRefs() {
  const nodes = useRef(new Map());
  const callbacks = useRef(new Map());
  const refFor = useCallback((id) => {
    if (!callbacks.current.has(id)) {
      callbacks.current.set(id, (instance) => {
        if (instance) nodes.current.set(id, instance);
        else nodes.current.delete(id);
      });
    }
    return callbacks.current.get(id);
  }, []);
  return [nodes, refFor];
}

export default function WorkspaceHost({ enabled, userId, areaWidth, navigationItems, children }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const areaWidthRef = useRef(areaWidth);
  areaWidthRef.current = areaWidth;

  const [frames, frameRef] = useKeyedRefs();
  const [slots, slotRef] = useKeyedRefs();
  const [resizing, setResizing] = useState(false);

  // ── Persistence: per user, per workstation (localStorage) ──────────────────
  const storageKey = enabled && userId ? buildKey(STORAGE_FEATURE, userId) : null;
  const [restoredKey, setRestoredKey] = useState(null);
  useEffect(() => {
    if (!storageKey || restoredKey === storageKey) return;
    const saved = deserializeState(readJSON(storageKey, null), {
      isValidHref: (href) => Boolean(toHref(href)),
    });
    dispatch({ type: "restore", state: saved });
    setRestoredKey(storageKey);
  }, [storageKey, restoredKey]);
  useEffect(() => {
    if (!storageKey || restoredKey !== storageKey) return;
    writeJSON(storageKey, serializeState(state));
  }, [state, storageKey, restoredKey]);
  const restored = Boolean(storageKey) && restoredKey === storageKey;

  // The primary workspace's page is simply the host route.
  useEffect(() => {
    dispatch({ type: "route", id: PRIMARY_WORKSPACE_ID, href: router.asPath });
  }, [router.asPath]);

  const active = enabled && restored && state.workspaces.length > 1;
  const layout = useMemo(() => computeLayout(state, areaWidth), [state, areaWidth]);
  const hostAvailable = enabled && restored && (state.workspaces.length > 1 || fitCapacity(areaWidth) >= 2);
  const hostAvailableRef = useRef(hostAvailable);
  hostAvailableRef.current = hostAvailable;

  useEffect(() => {
    setWorkspaceHostAvailable(hostAvailable);
    return () => setWorkspaceHostAvailable(false);
  }, [hostAvailable]);

  const labelOf = useCallback(
    (workspace) => labelForHref(workspace?.href, navigationItems),
    [navigationItems]
  );

  // ── Commands ───────────────────────────────────────────────────────────────
  const navigateWorkspace = useCallback(
    (id, href) => {
      if (!href) return;
      if (id === PRIMARY_WORKSPACE_ID) {
        router.push(href);
        return;
      }
      frames.current.get(id)?.navigate(href);
      dispatch({ type: "route", id, href });
    },
    [router, frames]
  );

  const openInOther = useCallback(
    (rawHref, sourceId) => {
      const href = toHref(rawHref);
      if (!href) return false;
      const current = stateRef.current;
      const target = pickOtherWorkspace(current, sourceId);
      if (target) {
        navigateWorkspace(target, href);
        dispatch({ type: "reveal", id: target });
        return true;
      }
      if (current.workspaces.length >= MAX_WORKSPACES) return false;
      dispatch({ type: "add", href, afterId: sourceId });
      return true;
    },
    [navigateWorkspace]
  );

  const focusWorkspace = useCallback((id) => dispatch({ type: "focus", id }), []);
  const addWorkspace = useCallback(
    () => dispatch({ type: "add", href: null, afterId: stateRef.current.workspaces.at(-1)?.id }),
    []
  );

  // ── Frame -> host messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || typeof data.type !== "string" || !data.type.startsWith("hnp-workspace/")) return;
      const frame = frames.current.get(data.id);
      // Only the frame this host created for that id may speak for it.
      if (!frame || frame.contentWindow() !== event.source) return;
      switch (data.type) {
        case WORKSPACE_MESSAGES.READY:
          frame.markReady();
          if (toHref(data.href)) dispatch({ type: "route", id: data.id, href: toHref(data.href) });
          break;
        case WORKSPACE_MESSAGES.ROUTE:
          // Pages a workspace cannot restore (e.g. /login after a session
          // expiry) are not recorded, so a reload does not reopen them.
          if (toHref(data.href)) dispatch({ type: "route", id: data.id, href: toHref(data.href) });
          break;
        case WORKSPACE_MESSAGES.FOCUS:
          dispatch({ type: "focus", id: data.id });
          break;
        case WORKSPACE_MESSAGES.OPEN:
          openInOther(data.href, data.id);
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, frames, openInOther]);

  // ── Host-document link requests ────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return undefined;
    const onOpen = (event) => openInOther(event.detail?.href, PRIMARY_WORKSPACE_ID);
    window.addEventListener(OPEN_IN_WORKSPACE_EVENT, onOpen);
    const unbindLinks = bindWorkspaceLinkTargets(
      (href) => hostAvailableRef.current && openInOther(href, PRIMARY_WORKSPACE_ID)
    );
    return () => {
      window.removeEventListener(OPEN_IN_WORKSPACE_EVENT, onOpen);
      unbindLinks();
    };
  }, [enabled, openInOther]);

  // ── The one global sidebar drives the focused workspace ────────────────────
  useEffect(() => {
    if (!active) return undefined;
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || !anchor.closest(`[${GLOBAL_NAV_ATTRIBUTE}="global"]`)) return;
      const current = stateRef.current;
      if (current.focusedId === PRIMARY_WORKSPACE_ID) return;
      if (!computeLayout(current, areaWidthRef.current).visibleIds.includes(current.focusedId)) return;
      const href = toHref(anchor.getAttribute("href"));
      if (!href) return;
      // preventDefault only: next/link then skips its own navigation, while the
      // sidebar's onClick (close drawer, record recents) still runs.
      event.preventDefault();
      navigateWorkspace(current.focusedId, href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, navigateWorkspace]);

  // ── Page actions ───────────────────────────────────────────────────────────
  const actionOptionsFor = (workspace) => {
    const href = workspace.primary ? router.asPath : workspace.href;
    const others = state.workspaces.filter((other) => other.id !== workspace.id);
    const nameOf = (other) => (other.primary ? `Main (${labelOf(other)})` : labelOf(other));
    const options = others.map((other) => ({ value: `swap:${other.id}`, label: `Swap places with ${nameOf(other)}` }));
    if (href) {
      others.forEach((other) =>
        options.push({ value: `copy:${other.id}`, label: `Open this page in ${nameOf(other)} too` })
      );
      if (!workspace.primary) {
        others.forEach((other) =>
          options.push({ value: `move:${other.id}`, label: `Move this page to ${nameOf(other)}` })
        );
      }
      if (state.workspaces.length < MAX_WORKSPACES) {
        options.push({ value: "duplicate", label: "Duplicate into a new workspace" });
      }
      if (!workspace.primary) options.push({ value: "reload", label: "Reload this workspace" });
      options.push({ value: "tab", label: "Open in a new browser tab" });
    }
    return options;
  };

  const runAction = (workspace, value) => {
    const href = workspace.primary ? router.asPath : workspace.href;
    const [verb, targetId] = String(value).split(":");
    switch (verb) {
      case "swap":
        dispatch({ type: "swapOrder", a: workspace.id, b: targetId });
        break;
      case "copy":
        navigateWorkspace(targetId, href);
        dispatch({ type: "reveal", id: targetId });
        break;
      case "move":
        navigateWorkspace(targetId, href);
        dispatch({ type: "close", id: workspace.id });
        dispatch({ type: "showTab", id: targetId });
        break;
      case "duplicate":
        dispatch({ type: "add", href, afterId: workspace.id });
        break;
      case "reload":
        frames.current.get(workspace.id)?.reload();
        break;
      case "tab":
        if (href) window.open(href, "_blank", "noopener,noreferrer");
        break;
      default:
        break;
    }
  };

  // ── Divider sizing ─────────────────────────────────────────────────────────
  const getPairRect = useCallback(
    (leftId, rightId) => {
      const left = slots.current.get(leftId)?.getBoundingClientRect();
      const right = slots.current.get(rightId)?.getBoundingClientRect();
      if (!left || !right) return null;
      return { left: left.left, width: Math.max(1, right.right - left.left) };
    },
    [slots]
  );
  const onResize = useCallback(
    (leftId, rightId, leftShare, pairWidth) =>
      dispatch({ type: "resizePair", leftId, rightId, leftShare, pairWidth }),
    []
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const visibleIndex = new Map(layout.visibleIds.map((id, index) => [id, index]));
  // flex-grow values that sum to less than 1 only hand out that fraction of the
  // free space, so shares are normalised over what is actually on screen.
  const visibleWeightTotal =
    layout.visibleIds.reduce((sum, id) => sum + weightOf(state, id), 0) || 1;
  const firstVisibleId = layout.visibleIds[0];
  const presetId = activePresetId(state, layout.visibleIds);
  const tabs = layout.tabIds.length
    ? layout.tabIds.map((id) => {
        const workspace = state.workspaces.find((w) => w.id === id);
        return { value: id, label: workspace?.primary ? `Main · ${labelOf(workspace)}` : labelOf(workspace) };
      })
    : null;

  const slotProps = (workspace) => {
    const index = visibleIndex.get(workspace.id);
    const hidden = index === undefined;
    const focused = state.focusedId === workspace.id;
    return {
      ref: slotRef(workspace.id),
      role: "region",
      "aria-label": workspace.primary ? "Main workspace" : `Workspace: ${labelOf(workspace)}`,
      className: [
        "app-workspace-slot",
        workspace.primary ? "" : "app-workspace-slot--frame",
        hidden ? "is-hidden" : "",
        focused ? "is-focused" : "",
      ]
        .filter(Boolean)
        .join(" "),
      style: {
        order: hidden ? 0 : index * 2,
        flexGrow: hidden ? 0 : weightOf(state, workspace.id) / visibleWeightTotal,
      },
      onPointerDownCapture: () => focusWorkspace(workspace.id),
      onFocusCapture: () => focusWorkspace(workspace.id),
    };
  };

  const barFor = (workspace) => {
    const label = labelOf(workspace);
    const showsTabs = Boolean(tabs) && layout.tabbedShownId === workspace.id;
    return (
      <WorkspacePaneBar
        label={label}
        isPrimary={workspace.primary}
        isFocused={state.focusedId === workspace.id}
        tabs={showsTabs ? tabs : null}
        activeTabId={layout.tabbedShownId}
        onSelectTab={(id) => dispatch({ type: "showTab", id })}
        actionOptions={actionOptionsFor(workspace)}
        onAction={(value) => runAction(workspace, value)}
        onClose={workspace.primary ? null : () => dispatch({ type: "close", id: workspace.id })}
        showShellControls={workspace.id === firstVisibleId}
        showPresets={layout.visibleIds.length >= 2}
        presetId={presetId}
        onPreset={(lead) => dispatch({ type: "preset", visibleIds: layout.visibleIds, lead })}
        canAdd={state.workspaces.length < MAX_WORKSPACES}
        onAdd={addWorkspace}
      />
    );
  };

  const primary = state.workspaces.find((w) => w.primary);
  const extras = active ? state.workspaces.filter((w) => !w.primary) : [];
  const promptCapacity = suggestCapacity(areaWidth);
  const showPrompt = enabled && restored && !resizing && shouldOfferWorkspace(state, areaWidth);

  return (
    <div
      className={`app-workspace-area${active ? " is-active" : ""}${resizing ? " is-resizing" : ""}`}
    >
      {/* Primary slot: always index 0, always the same element, so the page
          inside never remounts when the mode changes. */}
      <div {...(active ? slotProps(primary) : { className: "app-workspace-slot", onPointerDownCapture: () => focusWorkspace(PRIMARY_WORKSPACE_ID) })}>
        {active && barFor(primary)}
        {children}
      </div>

      {extras.map((workspace) => (
        <div key={workspace.id} {...slotProps(workspace)}>
          {barFor(workspace)}
          <WorkspaceFrame
            ref={frameRef(workspace.id)}
            id={workspace.id}
            href={workspace.href}
            label={labelOf(workspace)}
            primaryHref={toHref(router.asPath)}
            primaryLabel={labelOf(primary)}
            navigationItems={navigationItems}
            onChoose={(href) => navigateWorkspace(workspace.id, href)}
          />
        </div>
      ))}

      {active &&
        layout.visibleIds.slice(0, -1).map((leftId, index) => {
          const rightId = layout.visibleIds[index + 1];
          const leftWeight = weightOf(state, leftId);
          const share = leftWeight / (leftWeight + weightOf(state, rightId));
          const nameFor = (id) => {
            const workspace = state.workspaces.find((w) => w.id === id);
            return workspace?.primary ? "Main workspace" : labelOf(workspace);
          };
          return (
            <WorkspaceDivider
              key={`${leftId}|${rightId}`}
              leftId={leftId}
              rightId={rightId}
              share={share}
              order={index * 2 + 1}
              getPairRect={getPairRect}
              onResize={onResize}
              onResizeStart={() => setResizing(true)}
              onResizeEnd={() => setResizing(false)}
              leftLabel={nameFor(leftId)}
              rightLabel={nameFor(rightId)}
            />
          );
        })}

      {showPrompt && (
        <WorkspaceSpacePrompt
          capacity={promptCapacity}
          onAdd={addWorkspace}
          onDismiss={() => dispatch({ type: "dismissPrompt", capacity: promptCapacity })}
        />
      )}
    </div>
  );
}
