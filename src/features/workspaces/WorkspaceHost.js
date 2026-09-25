// file location: src/features/workspaces/WorkspaceHost.js
//
// The multi-workspace DMS shell. Mounted once by StaffLayout IN PLACE OF the
// page card (inside .app-page-content) and never anywhere else, so every
// current and future staff page gets workspaces without any page-level code.
//
// Single mode (the default): renders its children — the normal page card —
// untouched, plus the "Extra screen space detected" offer on wide windows.
//
// Multi mode ("Multi workspace", from the right-click menu, the offer, or a
// link sent to another workspace): ONLY the page-card area changes. The sidebar,
// topbar and status drawer stay where they are, full width, and drive whichever
// workspace is focused. The card area splits into 2–3 page cards, each a
// same-origin iframe of the app in embedded mode (see WorkspaceEmbedBridge):
//   • each card is its own viewport, so a page reflows to the card's width
//     exactly as it would to a resized window (media queries, useIsMobile);
//   • each page's popups, drawers and toasts centre in its own card and never
//     cover the others;
//   • click inside a card to focus it — like switching windows — and the
//     sidebar (and topbar search) then open pages in that card.
// The host's own page is not rendered in multi mode; the host route is only a
// way in: when it changes (topbar search, a notification link, Back, a pasted
// URL) that page opens in the focused card. While the cards are up the address
// bar reads "/multi-view/<card>-<card>" (src/pages/multi-view). Leaving multi mode keeps the
// focused card's page as the one page.
//
// Every frame stays mounted while it exists — collapsed ones are hidden, not
// removed — frames render in a fixed DOM order and on-screen order is CSS
// `order`, so swapping or collapsing never reloads a page.
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/router";
import { isPublicVhcReportPath, DYNAMIC_DETAIL_EXTENDS } from "@/config/routeAccess";
import { buildKey, readJSON, writeJSON } from "@/lib/topbar/workspaceStorage";
import {
  MAX_WORKSPACES,
  MIN_WORKSPACES,
  createInitialState,
  workspaceReducer,
  isMulti,
  computeLayout,
  fitCapacity,
  suggestCapacity,
  shouldOfferWorkspace,
  pickOtherWorkspace,
  getWorkspace,
  focusedHref,
  findWorkspaceShowing,
  workspaceCount,
  weightOf,
  cardWidthChoices,
  maxCardShare,
  labelForHref,
  toWorkspaceHref,
  serializeState,
  deserializeState,
  isMultiViewPath,
  multiViewHref,
  parseMultiViewPath,
} from "@/features/workspaces/workspaceModel";
import {
  WORKSPACE_MESSAGES,
  WORKSPACE_COMMANDS,
  OPEN_IN_WORKSPACE_EVENT,
  WORKSPACE_COMMAND_EVENT,
  setWorkspaceHostStatus,
} from "@/features/workspaces/workspaceBridge";
import { bindWorkspaceLinkTargets } from "@/features/workspaces/workspaceLinks";
import WorkspacePaneBar from "@/features/workspaces/components/WorkspacePaneBar";
import WorkspaceFrame from "@/features/workspaces/components/WorkspaceFrame";
import WorkspaceDivider from "@/features/workspaces/components/WorkspaceDivider";
import WorkspaceSpacePrompt from "@/features/workspaces/components/WorkspaceSpacePrompt";

const STORAGE_FEATURE = "multi-workspace";
// Marks the one global sidebar. Its links open in the focused workspace.
export const GLOBAL_NAV_ATTRIBUTE = "data-workspace-nav";

// Detail routes ("/job-cards/[jobNumber]") as their static base, so a pasted
// multi-view URL can tell "job-cards.123" apart from a page called "job".
const DETAIL_BASE_PATHS = Object.keys(DYNAMIC_DETAIL_EXTENDS).map((pattern) => pattern.split("/[")[0]);
const FALLBACK_HREF = "/newsfeed";

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

// Fixed DOM order for the frames. Moving an iframe in the DOM reloads it, so
// the array order (which swaps change) is only ever applied through CSS order.
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export default function WorkspaceHost({
  enabled,
  suspended = false,
  userId,
  areaWidth,
  navigationItems,
  onStateChange,
  children,
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const areaWidthRef = useRef(areaWidth);
  areaWidthRef.current = areaWidth;
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  // StaffLayout rebuilds this list every render; effects read it through a ref.
  const navigationItemsRef = useRef(navigationItems);
  navigationItemsRef.current = navigationItems;

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

  const multi = isMulti(state);
  // `live`: the shell can take commands. `active`: the cards are on screen.
  const live = enabled && restored && !suspended;
  const active = live && multi;
  const layout = useMemo(() => computeLayout(state, areaWidth), [state, areaWidth]);
  const canAdd = !multi || state.workspaces.length < MAX_WORKSPACES;
  const count = workspaceCount(state);
  // A declarative data-workspace-target link only diverts a plain click when
  // the cards can actually sit side by side (or already do).
  const linkTargetsLive = live && (multi || fitCapacity(areaWidth) >= MIN_WORKSPACES);
  const linkTargetsLiveRef = useRef(linkTargetsLive);
  linkTargetsLiveRef.current = linkTargetsLive;

  // What the right-click menu may offer in this document.
  useEffect(() => {
    setWorkspaceHostStatus(live ? { available: true, active: multi, canAdd, count } : null);
  }, [live, multi, canAdd, count]);
  useEffect(() => () => setWorkspaceHostStatus(null), []);

  // …and in every workspace frame.
  const postStatus = useCallback(
    (frame) => frame?.post({ type: WORKSPACE_MESSAGES.STATUS, canAdd, count }),
    [canAdd, count]
  );
  useEffect(() => {
    if (!active) return;
    frames.current.forEach((frame) => postStatus(frame));
  }, [active, frames, postStatus]);

  // Tell the layout which page the focused card shows, so the sidebar
  // highlight and the topbar's department follow the focused card.
  const currentFocusedHref = active ? focusedHref(state) : null;
  useEffect(() => {
    onStateChange?.({ active, focusedHref: currentFocusedHref });
  }, [active, currentFocusedHref, onStateChange]);

  const labelOf = useCallback(
    (workspace) => labelForHref(workspace?.href, navigationItems),
    [navigationItems]
  );

  // ── Commands ───────────────────────────────────────────────────────────────
  // Unmounted frames (suspended on a narrow window) just record the page; it
  // loads when the card next mounts.
  const navigateWorkspace = useCallback(
    (id, href) => {
      if (!id || !href) return;
      frames.current.get(id)?.navigate(href);
      dispatch({ type: "route", id, href });
    },
    [frames]
  );

  const enterMulti = useCallback(
    (linkHref = null) => {
      if (isMulti(stateRef.current)) return false;
      const here = toHref(router.asPath);
      // A link sent to another workspace opens beside the page the user is on
      // and leaves them focused where they were. Otherwise the new, empty card
      // takes focus, so the very next sidebar click fills it.
      dispatch({
        type: "enter",
        hrefs: [here, linkHref || null],
        focusIndex: linkHref ? 0 : 1,
        hostHref: router.asPath,
      });
      return true;
    },
    [router]
  );

  const exitMulti = useCallback(
    (keepId) => {
      const current = stateRef.current;
      if (!isMulti(current)) return;
      const keep = getWorkspace(current, keepId) || getWorkspace(current, current.focusedId);
      // The multi-view URL is not a page of its own, so leaving from an empty
      // card still has to land somewhere real.
      const href =
        keep?.href ||
        (isMultiViewPath(router.asPath)
          ? current.workspaces.find((w) => w.href)?.href || FALLBACK_HREF
          : null);
      dispatch({ type: "exit" });
      if (href && href !== router.asPath) router.push(href);
    },
    [router]
  );

  // Closing the second-last card IS leaving multi mode: the one left becomes
  // the page.
  const closeWorkspace = useCallback(
    (id) => {
      const current = stateRef.current;
      if (!getWorkspace(current, id)) return;
      if (current.workspaces.length <= MIN_WORKSPACES) {
        exitMulti(current.workspaces.find((w) => w.id !== id)?.id);
        return;
      }
      dispatch({ type: "close", id });
    },
    [exitMulti]
  );

  const addWorkspace = useCallback(
    (afterId) => {
      const current = stateRef.current;
      if (!isMulti(current)) return enterMulti();
      if (current.workspaces.length >= MAX_WORKSPACES) return false;
      dispatch({ type: "add", href: null, afterId: afterId || current.workspaces.at(-1)?.id });
      return true;
    },
    [enterMulti]
  );

  const openInOther = useCallback(
    (rawHref, sourceId) => {
      const href = toHref(rawHref);
      if (!href) return false;
      const current = stateRef.current;
      if (!isMulti(current)) return suspendedRef.current ? false : enterMulti(href);
      const target = pickOtherWorkspace(current, sourceId);
      if (target) {
        navigateWorkspace(target, href);
        dispatch({ type: "reveal", id: target });
        return true;
      }
      if (current.workspaces.length >= MAX_WORKSPACES) return false;
      dispatch({ type: "add", href, afterId: sourceId, focus: false });
      return true;
    },
    [enterMulti, navigateWorkspace]
  );

  const focusWorkspace = useCallback((id) => dispatch({ type: "focus", id }), []);

  const runCommand = useCallback(
    (command, sourceId) => {
      const focused = sourceId || stateRef.current.focusedId;
      switch (command) {
        case WORKSPACE_COMMANDS.ENTER:
          enterMulti();
          break;
        case WORKSPACE_COMMANDS.ADD:
          addWorkspace(sourceId);
          break;
        case WORKSPACE_COMMANDS.CLOSE:
          if (focused) closeWorkspace(focused);
          break;
        case WORKSPACE_COMMANDS.EXIT:
          exitMulti(focused);
          break;
        default:
          break;
      }
    },
    [enterMulti, addWorkspace, closeWorkspace, exitMulti]
  );

  // ── The host route is a way in ─────────────────────────────────────────────
  // In multi mode the host renders no page, so a host navigation (topbar
  // search, notification, Back, a pasted URL, a reload onto a new URL) opens
  // that page in the focused card — or focuses the card already showing it.
  const hostPath = router.asPath;
  const routerReady = router.isReady;
  useEffect(() => {
    // Before isReady a dynamic route's asPath can still be its pattern
    // ("/job-cards/[id]"), which must never be sent to a card.
    if (!restored || !routerReady) return;
    const current = stateRef.current;
    if (!isMulti(current) || current.hostHref === hostPath) return;
    dispatch({ type: "syncHost", href: hostPath });
    const href = toHref(hostPath);
    if (!href) return;
    if (!suspendedRef.current) {
      const showing = findWorkspaceShowing(current, href);
      if (showing && getWorkspace(current, showing)?.href === href) {
        dispatch({ type: "showTab", id: showing });
        return;
      }
    }
    navigateWorkspace(current.focusedId, href);
    dispatch({ type: "reveal", id: current.focusedId });
  }, [hostPath, restored, routerReady, navigateWorkspace]);

  // Window narrowed to tablet while in multi mode: the normal single card comes
  // back, showing the focused card's page. The cards return, with the pages
  // they had, when the window widens again.
  const wasSuspendedRef = useRef(suspended);
  useEffect(() => {
    const was = wasSuspendedRef.current;
    wasSuspendedRef.current = suspended;
    if (!restored || was || !suspended) return;
    const current = stateRef.current;
    const href = focusedHref(current);
    if (!isMulti(current) || !href || href === router.asPath) return;
    dispatch({ type: "syncHost", href });
    router.replace(href);
  }, [suspended, restored, router]);

  // ── The address bar names the cards ────────────────────────────────────────
  // In multi mode the host renders no page, so its route would otherwise keep
  // naming whatever page the user entered from. It is replaced (never pushed)
  // with "/multi-view/<card>-<card>" whenever the cards change. It only moves
  // once the host is in step with the route (hostHref === hostPath), so a
  // route that has just arrived as a way in is handed to a card first.
  const cardsHref = active ? multiViewHref(state.workspaces) : null;
  const hostInStep = state.hostHref === hostPath || isMultiViewPath(hostPath);
  useEffect(() => {
    if (!cardsHref || !routerReady || !hostInStep || hostPath === cardsHref) return;
    dispatch({ type: "syncHost", href: cardsHref });
    // Shallow: after the first swap onto /multi-view this is the same page, so
    // no data refetch and no route progress bar for a card changing page.
    router.replace(cardsHref, undefined, { shallow: true, scroll: false });
  }, [cardsHref, hostInStep, hostPath, routerReady, router]);

  // A multi-view URL loaded with no cards to show (another workstation, cleared
  // storage, a shared link) opens the cards it names. On a window too narrow for
  // cards it falls back to one page, so the placeholder page is never left up.
  useEffect(() => {
    if (!restored || !routerReady || !isMultiViewPath(hostPath)) return;
    const current = stateRef.current;
    if (isMulti(current) && !suspended) return;
    const knownPaths = [...(navigationItemsRef.current || []).map((item) => item?.href), ...DETAIL_BASE_PATHS];
    const hrefs = parseMultiViewPath(hostPath, knownPaths).map((href) => (href ? toHref(href) : null));
    if (!isMulti(current) && !suspended) {
      dispatch({ type: "enter", hrefs, focusIndex: 0, hostHref: hostPath });
      return;
    }
    const fallback = focusedHref(current) || hrefs.find(Boolean) || FALLBACK_HREF;
    dispatch({ type: "syncHost", href: fallback });
    router.replace(fallback);
  }, [hostPath, restored, routerReady, suspended, router]);

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
          postStatus(frame);
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
        case WORKSPACE_MESSAGES.COMMAND:
          runCommand(data.command, data.id);
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [enabled, frames, openInOther, runCommand, postStatus]);

  // ── Host-document requests (right-click menu, declarative links) ───────────
  useEffect(() => {
    if (!enabled) return undefined;
    const sourceId = () => stateRef.current.focusedId;
    const onOpen = (event) => openInOther(event.detail?.href, sourceId());
    const onCommand = (event) => runCommand(event.detail?.command, null);
    window.addEventListener(OPEN_IN_WORKSPACE_EVENT, onOpen);
    window.addEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
    const unbindLinks = bindWorkspaceLinkTargets(
      (href) => linkTargetsLiveRef.current && openInOther(href, sourceId())
    );
    return () => {
      window.removeEventListener(OPEN_IN_WORKSPACE_EVENT, onOpen);
      window.removeEventListener(WORKSPACE_COMMAND_EVENT, onCommand);
      unbindLinks();
    };
  }, [enabled, openInOther, runCommand]);

  // ── The one global sidebar drives the focused card ─────────────────────────
  useEffect(() => {
    if (!active) return undefined;
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target?.closest?.("a[href]");
      if (!anchor || !anchor.closest(`[${GLOBAL_NAV_ATTRIBUTE}="global"]`)) return;
      const href = toHref(anchor.getAttribute("href"));
      if (!href) return;
      const focused = stateRef.current.focusedId;
      // preventDefault only: next/link then skips its own navigation, while the
      // sidebar's onClick (close drawer, record recents) still runs.
      event.preventDefault();
      navigateWorkspace(focused, href);
      dispatch({ type: "reveal", id: focused });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, navigateWorkspace]);

  const positionOf = (id) => state.workspaces.findIndex((w) => w.id === id) + 1;

  // ── Page options (the floating card behind each card's page name) ─────────
  const pageOptionsFor = (workspace, visibleIds) => {
    const id = workspace.id;
    const href = workspace.href;
    const index = visibleIds.indexOf(id);
    const count = visibleIds.length;
    const total = visibleIds.reduce((sum, visibleId) => sum + weightOf(state, visibleId), 0) || 1;
    const currentShare = weightOf(state, id) / total;
    const maxShare = maxCardShare(count, areaWidth);
    const swapWith = (neighbourId) => neighbourId && dispatch({ type: "swapOrder", a: id, b: neighbourId });
    return {
      href,
      onReload: href ? () => frames.current.get(id)?.reload() : null,
      onOpenTab: href ? () => window.open(href, "_blank", "noopener,noreferrer") : null,
      onMoveLeft: index > 0 ? () => swapWith(visibleIds[index - 1]) : null,
      onMoveRight: index >= 0 && index < count - 1 ? () => swapWith(visibleIds[index + 1]) : null,
      widthChoices:
        index < 0
          ? []
          : cardWidthChoices(count).map((choice) => ({
              ...choice,
              active: Math.abs(choice.share - currentShare) < 0.01,
              disabled: choice.share > maxShare + 0.001,
            })),
      onWidth: (share) => dispatch({ type: "cardWidth", visibleIds, id, share }),
      onDuplicate:
        href && state.workspaces.length < MAX_WORKSPACES
          ? () => dispatch({ type: "add", href, afterId: id })
          : null,
      onKeepOnly: href ? () => exitMulti(id) : null,
    };
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
  const promptCapacity = suggestCapacity(areaWidth);
  const showPrompt = live && !resizing && shouldOfferWorkspace(state, areaWidth);
  const prompt = showPrompt ? (
    <WorkspaceSpacePrompt
      active={multi}
      onAdd={() => addWorkspace()}
      onDismiss={() => dispatch({ type: "dismissPrompt", capacity: promptCapacity })}
    />
  ) : null;

  if (!active) {
    return (
      <>
        {children}
        {prompt}
      </>
    );
  }

  const visibleIndex = new Map(layout.visibleIds.map((id, index) => [id, index]));
  // flex-grow values that sum to less than 1 only hand out that fraction of the
  // free space, so shares are normalised over what is actually on screen.
  const visibleWeightTotal =
    layout.visibleIds.reduce((sum, id) => sum + weightOf(state, id), 0) || 1;
  const tabs = layout.tabIds.length
    ? layout.tabIds.map((id) => ({ value: id, label: labelOf(getWorkspace(state, id)) }))
    : null;

  // The page a new card offers to open "here too": the most recently focused
  // other card that has one.
  const suggestionFor = (workspace) => {
    const otherId = state.focusHistory.find(
      (id) => id !== workspace.id && getWorkspace(state, id)?.href
    );
    return otherId ? getWorkspace(state, otherId) : null;
  };

  const slotProps = (workspace) => {
    const index = visibleIndex.get(workspace.id);
    const hidden = index === undefined;
    const focused = state.focusedId === workspace.id;
    return {
      ref: slotRef(workspace.id),
      role: "region",
      "aria-label": `Workspace ${positionOf(workspace.id)}: ${labelOf(workspace)}${focused ? " (focused)" : ""}`,
      className: ["app-workspace-slot", hidden ? "is-hidden" : "", focused ? "is-focused" : ""]
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

  return (
    <div className={`app-workspace-area is-active${resizing ? " is-resizing" : ""}`}>
      {[...state.workspaces].sort(byId).map((workspace) => {
        const label = labelOf(workspace);
        const suggestion = suggestionFor(workspace);
        return (
          <div key={workspace.id} {...slotProps(workspace)}>
            <WorkspacePaneBar
              label={label}
              isFocused={state.focusedId === workspace.id}
              tabs={tabs && layout.tabbedShownId === workspace.id ? tabs : null}
              activeTabId={layout.tabbedShownId}
              onSelectTab={(id) => dispatch({ type: "showTab", id })}
              onClose={() => closeWorkspace(workspace.id)}
              options={pageOptionsFor(workspace, layout.visibleIds)}
            />
            <div className="app-workspace-pane">
              <WorkspaceFrame
                ref={frameRef(workspace.id)}
                id={workspace.id}
                href={workspace.href}
                label={label}
                isFocused={state.focusedId === workspace.id}
                suggestHref={suggestion?.href || null}
                suggestLabel={suggestion ? labelOf(suggestion) : null}
                onChoose={(href) => {
                  focusWorkspace(workspace.id);
                  navigateWorkspace(workspace.id, href);
                }}
              />
            </div>
          </div>
        );
      })}

      {layout.visibleIds.slice(0, -1).map((leftId, index) => {
        const rightId = layout.visibleIds[index + 1];
        const leftWeight = weightOf(state, leftId);
        const share = leftWeight / (leftWeight + weightOf(state, rightId));
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
            leftLabel={labelOf(getWorkspace(state, leftId))}
            rightLabel={labelOf(getWorkspace(state, rightId))}
          />
        );
      })}

      {prompt}
    </div>
  );
}
