// file location: src/features/workspaces/workspaceModel.js
//
// Pure state model for the multi-workspace DMS shell. No React, no DOM, no
// storage — everything here is a plain function over plain objects so it can be
// unit-tested (workspaceModel.test.js) and reasoned about in isolation.
//
// Vocabulary:
//   workspace  one independent DMS page. The PRIMARY workspace is the host
//              document itself (the page the user loaded); every other
//              workspace is a same-origin iframe of the app running in
//              embedded (chrome-less) mode, so it has its own router and page
//              state while sharing the session, roles and theme.
//   slot       a column on screen. There are as many slots as the available
//              width fits at MIN_PANE_WIDTH, capped at the workspace count.
//   tabbed     when there are more workspaces than slots, the last slot hosts
//              the overflow as tabs. Hidden workspaces stay mounted, so a
//              narrower window never loses a workspace's state.

export const PRIMARY_WORKSPACE_ID = "main";
export const MAX_WORKSPACES = 3;

// Narrowest a pane may be dragged or laid out. Below this the page inside no
// longer reads as a desktop DMS page, so the layout collapses into tabs instead.
export const MIN_PANE_WIDTH = 640;
// Width EACH pane would need before the shell offers another workspace. Set well
// above MIN_PANE_WIDTH so an ordinary 1920px screen never sees the prompt — it
// only appears on genuinely wide windows (QHD/ultrawide, or spanning monitors).
export const SUGGEST_PANE_WIDTH = 1000;
// Width of the divider between two panes (hit area; the visible rule is thinner).
export const DIVIDER_WIDTH = 12;

export const LAYOUT_PRESETS = [
  { id: "50-50", label: "50/50", lead: 0.5 },
  { id: "60-40", label: "60/40", lead: 0.6 },
  { id: "70-30", label: "70/30", lead: 0.7 },
];

export const STORAGE_VERSION = 1;

const DEFAULT_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------
export function createInitialState() {
  return {
    workspaces: [{ id: PRIMARY_WORKSPACE_ID, primary: true, href: null }],
    weights: { [PRIMARY_WORKSPACE_ID]: DEFAULT_WEIGHT },
    focusedId: PRIMARY_WORKSPACE_ID,
    // Most-recently-focused first. Used to pick the "other" workspace a link
    // should open in.
    focusHistory: [PRIMARY_WORKSPACE_ID],
    tabbedId: null,
    // Highest capacity the user has already said "not now" to. The prompt only
    // returns if even more room appears (e.g. a third monitor).
    promptDismissedCapacity: 0,
  };
}

let idCounter = 0;
export function createWorkspaceId() {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `ws-${Date.now().toString(36)}-${idCounter}-${random}`;
}

// ---------------------------------------------------------------------------
// Hrefs + labels
// ---------------------------------------------------------------------------
// Route prefixes that must never load inside a workspace: they are either not
// staff pages (customer site / portal, public reports), have their own full
// shell (login, presentation), or are not pages at all.
const INELIGIBLE_PREFIXES = [
  "/api",
  "/_next",
  "/login",
  "/loginPresentation",
  "/presentation",
  "/website",
  "/customer",
];

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Normalise a link into a same-origin "path?query#hash", or null when it is not
 * something a workspace can show. `origin` is the app origin; `isExcluded` is an
 * optional extra predicate over the pathname (the host passes the public VHC
 * report check here, keeping this module dependency-free).
 */
export function toWorkspaceHref(rawHref, origin, isExcluded) {
  if (!rawHref || typeof rawHref !== "string") return null;
  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.startsWith("#") || /^(mailto|tel|javascript|blob|data):/i.test(trimmed)) {
    return null;
  }
  let url;
  try {
    url = new URL(trimmed, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const path = url.pathname || "/";
  if (path === "/") return null;
  if (INELIGIBLE_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) return null;
  if (typeof isExcluded === "function" && isExcluded(path)) return null;
  return `${path}${url.search}${url.hash}`;
}

const titleCase = (value) =>
  value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Human label for a workspace href. Prefers the matching navigation label (the
 * same text the sidebar shows); falls back to the path, e.g.
 * "/job-cards/12345" -> "Job Cards · 12345".
 */
export function labelForHref(href, navigationItems = []) {
  if (!href) return "New workspace";
  const path = String(href).split("#")[0].split("?")[0].replace(/\/$/, "") || "/";
  let best = null;
  for (const item of navigationItems || []) {
    const itemPath = String(item?.href || "").split("?")[0].replace(/\/$/, "");
    if (!itemPath || !item?.label) continue;
    if (path === itemPath || path.startsWith(`${itemPath}/`)) {
      if (!best || itemPath.length > best.path.length) best = { path: itemPath, label: item.label };
    }
  }
  const segments = path.split("/").filter(Boolean);
  if (best) {
    const extra = path.slice(best.path.length).split("/").filter(Boolean);
    return extra.length ? `${best.label} · ${decodeURIComponent(extra.join(" / "))}` : best.label;
  }
  if (!segments.length) return "Home";
  const [head, ...rest] = segments;
  const headLabel = titleCase(decodeURIComponent(head));
  return rest.length ? `${headLabel} · ${decodeURIComponent(rest.join(" / "))}` : headLabel;
}

// ---------------------------------------------------------------------------
// Capacity + layout
// ---------------------------------------------------------------------------
const slotsFor = (areaWidth, paneWidth) => {
  const width = Number(areaWidth) || 0;
  if (width <= 0) return 1;
  return Math.max(1, Math.floor((width + DIVIDER_WIDTH) / (paneWidth + DIVIDER_WIDTH)));
};

/** How many panes the area can SHOW side by side (at the minimum width). */
export function fitCapacity(areaWidth) {
  return Math.min(MAX_WORKSPACES, slotsFor(areaWidth, MIN_PANE_WIDTH));
}

/** How many workspaces the area comfortably supports — drives the prompt. */
export function suggestCapacity(areaWidth) {
  return Math.min(MAX_WORKSPACES, slotsFor(areaWidth, SUGGEST_PANE_WIDTH));
}

export function shouldOfferWorkspace(state, areaWidth) {
  const capacity = suggestCapacity(areaWidth);
  const count = state.workspaces.length;
  return capacity > count && count < MAX_WORKSPACES && capacity > (state.promptDismissedCapacity || 0);
}

/**
 * Which workspaces are on screen and which are tabbed.
 * Returns { slots, visibleIds, tabIds, tabbedShownId }.
 */
export function computeLayout(state, areaWidth) {
  const ids = state.workspaces.map((w) => w.id);
  const slots = Math.min(ids.length, fitCapacity(areaWidth));
  if (ids.length <= slots) {
    return { slots, visibleIds: ids, tabIds: [], tabbedShownId: null };
  }
  const fixed = ids.slice(0, slots - 1);
  const overflow = ids.slice(slots - 1);
  const shown = overflow.includes(state.tabbedId)
    ? state.tabbedId
    : overflow.includes(state.focusedId)
      ? state.focusedId
      : overflow[0];
  return { slots, visibleIds: [...fixed, shown], tabIds: overflow, tabbedShownId: shown };
}

export function getWorkspace(state, id) {
  return state.workspaces.find((w) => w.id === id) || null;
}

export function weightOf(state, id) {
  const value = Number(state.weights?.[id]);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_WEIGHT;
}

/**
 * Resize the boundary between two adjacent visible panes. `leftShare` is the
 * left pane's fraction (0..1) of the PAIR's combined width; it is clamped so
 * neither pane drops below MIN_PANE_WIDTH given `pairWidth` in px. The pair's
 * combined weight is preserved, so other panes do not move.
 */
export function resizePair(state, leftId, rightId, leftShare, pairWidth) {
  const total = weightOf(state, leftId) + weightOf(state, rightId);
  const minShare = pairWidth > 0 ? Math.min(0.5, MIN_PANE_WIDTH / pairWidth) : 0.2;
  const share = Math.min(1 - minShare, Math.max(minShare, Number(leftShare) || 0.5));
  return {
    ...state,
    weights: { ...state.weights, [leftId]: total * share, [rightId]: total * (1 - share) },
  };
}

/** Apply a quick layout: the first visible pane takes `lead`, the rest share. */
export function applyPreset(state, visibleIds, lead) {
  if (!visibleIds.length) return state;
  if (visibleIds.length === 1) {
    return { ...state, weights: { ...state.weights, [visibleIds[0]]: DEFAULT_WEIGHT } };
  }
  const rest = (1 - lead) / (visibleIds.length - 1);
  const weights = { ...state.weights };
  visibleIds.forEach((id, index) => {
    weights[id] = index === 0 ? lead : rest;
  });
  return { ...state, weights };
}

/** The lead share of the current layout, for highlighting the active preset. */
export function activePresetId(state, visibleIds) {
  if (visibleIds.length < 2) return null;
  const total = visibleIds.reduce((sum, id) => sum + weightOf(state, id), 0);
  const lead = weightOf(state, visibleIds[0]) / total;
  const rest = visibleIds.slice(1).map((id) => weightOf(state, id) / total);
  const restEven = rest.every((value) => Math.abs(value - rest[0]) < 0.01);
  if (!restEven) return null;
  const match = LAYOUT_PRESETS.find((preset) => Math.abs(preset.lead - lead) < 0.01);
  return match ? match.id : null;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------
const touchFocus = (state, id) => ({
  ...state,
  focusedId: id,
  focusHistory: [id, ...state.focusHistory.filter((entry) => entry !== id)],
});

const withoutWorkspace = (state, id) => {
  const workspaces = state.workspaces.filter((w) => w.id !== id);
  const weights = { ...state.weights };
  delete weights[id];
  const focusHistory = state.focusHistory.filter((entry) => entry !== id);
  const focusedId =
    state.focusedId === id ? focusHistory[0] || PRIMARY_WORKSPACE_ID : state.focusedId;
  return {
    ...state,
    workspaces,
    weights,
    focusHistory: focusHistory.length ? focusHistory : [PRIMARY_WORKSPACE_ID],
    focusedId,
    tabbedId: state.tabbedId === id ? null : state.tabbedId,
  };
};

/** The workspace a link from `sourceId` should open in, or null (= add one). */
export function pickOtherWorkspace(state, sourceId) {
  const candidates = state.focusHistory.filter(
    (id) => id !== sourceId && state.workspaces.some((w) => w.id === id)
  );
  if (candidates.length) return candidates[0];
  const fallback = state.workspaces.find((w) => w.id !== sourceId);
  return fallback ? fallback.id : null;
}

export function workspaceReducer(state, action) {
  switch (action.type) {
    // Saved state never carries the primary's page (it is whatever the user
    // loaded), so keep the one the host has already reported.
    case "restore": {
      if (!action.state) return state;
      const currentPrimary = getWorkspace(state, PRIMARY_WORKSPACE_ID);
      return {
        ...action.state,
        workspaces: action.state.workspaces.map((w) =>
          w.primary ? { ...w, href: currentPrimary?.href ?? w.href } : w
        ),
      };
    }

    case "add": {
      if (state.workspaces.length >= MAX_WORKSPACES) return state;
      const id = action.id || createWorkspaceId();
      const record = { id, primary: false, href: action.href || null };
      const workspaces = [...state.workspaces];
      const afterIndex = action.afterId
        ? workspaces.findIndex((w) => w.id === action.afterId)
        : -1;
      if (afterIndex >= 0) workspaces.splice(afterIndex + 1, 0, record);
      else workspaces.push(record);
      // A new pane takes an equal share of the current total, so a first extra
      // workspace lands at 50/50 and a third at thirds.
      const count = state.workspaces.length;
      const total = state.workspaces.reduce((sum, w) => sum + weightOf(state, w.id), 0);
      const weights = { ...state.weights, [id]: count ? total / count : DEFAULT_WEIGHT };
      return touchFocus({ ...state, workspaces, weights, tabbedId: id }, id);
    }

    case "close": {
      if (action.id === PRIMARY_WORKSPACE_ID) return state;
      if (!getWorkspace(state, action.id)) return state;
      return withoutWorkspace(state, action.id);
    }

    case "focus": {
      if (!getWorkspace(state, action.id) || state.focusedId === action.id) return state;
      return touchFocus(state, action.id);
    }

    case "showTab": {
      if (!getWorkspace(state, action.id)) return state;
      return touchFocus({ ...state, tabbedId: action.id }, action.id);
    }

    // Bring a workspace into view (if it is collapsed into tabs) WITHOUT moving
    // focus — used when a link is sent to another workspace, so the user keeps
    // working where they are.
    case "reveal": {
      if (!getWorkspace(state, action.id) || state.tabbedId === action.id) return state;
      return { ...state, tabbedId: action.id };
    }

    // The page inside a workspace changed (reported by the workspace itself, or
    // by the host router for the primary). Never reloads anything.
    case "route": {
      const target = getWorkspace(state, action.id);
      if (!target || target.href === action.href) return state;
      return {
        ...state,
        workspaces: state.workspaces.map((w) => (w.id === action.id ? { ...w, href: action.href } : w)),
      };
    }

    // Reorder two workspaces on screen. Only the ORDER changes — the host keeps
    // every frame mounted in place and positions it with CSS `order`, so a swap
    // between two extra workspaces preserves both pages' state.
    case "swapOrder": {
      const a = state.workspaces.findIndex((w) => w.id === action.a);
      const b = state.workspaces.findIndex((w) => w.id === action.b);
      if (a < 0 || b < 0 || a === b) return state;
      const workspaces = [...state.workspaces];
      [workspaces[a], workspaces[b]] = [workspaces[b], workspaces[a]];
      return { ...state, workspaces };
    }

    case "resizePair":
      return resizePair(state, action.leftId, action.rightId, action.leftShare, action.pairWidth);

    case "preset":
      return applyPreset(state, action.visibleIds || [], action.lead);

    case "dismissPrompt":
      return {
        ...state,
        promptDismissedCapacity: Math.max(state.promptDismissedCapacity || 0, action.capacity || 0),
      };

    case "reset":
      return { ...createInitialState(), promptDismissedCapacity: state.promptDismissedCapacity };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Persistence (the shape written to localStorage, per user, per workstation)
// ---------------------------------------------------------------------------
// The primary workspace is never persisted: it is whatever page the user loads.
// Extra workspaces keep their CURRENT page, so a reload restores where each one
// had got to, not where it started.
export function serializeState(state) {
  return {
    version: STORAGE_VERSION,
    order: state.workspaces.map((w) => w.id),
    workspaces: state.workspaces
      .filter((w) => !w.primary && w.href)
      .map((w) => ({ id: w.id, href: w.href })),
    weights: state.weights,
    promptDismissedCapacity: state.promptDismissedCapacity || 0,
  };
}

export function deserializeState(raw, { isValidHref } = {}) {
  const base = createInitialState();
  if (!raw || typeof raw !== "object" || raw.version !== STORAGE_VERSION) return base;
  const extras = (Array.isArray(raw.workspaces) ? raw.workspaces : [])
    .filter((w) => w && typeof w.id === "string" && typeof w.href === "string")
    .filter((w) => (typeof isValidHref === "function" ? isValidHref(w.href) : true))
    .slice(0, MAX_WORKSPACES - 1)
    .map((w) => ({ id: w.id, primary: false, href: w.href }));

  const byId = new Map([[PRIMARY_WORKSPACE_ID, base.workspaces[0]], ...extras.map((w) => [w.id, w])]);
  const order = (Array.isArray(raw.order) ? raw.order : []).filter((id) => byId.has(id));
  const ordered = [...new Set([...order, ...byId.keys()])].map((id) => byId.get(id));

  const weights = {};
  ordered.forEach((w) => {
    const value = Number(raw.weights?.[w.id]);
    weights[w.id] = Number.isFinite(value) && value > 0 ? value : DEFAULT_WEIGHT;
  });

  return {
    ...base,
    workspaces: ordered,
    weights,
    promptDismissedCapacity: Number(raw.promptDismissedCapacity) || 0,
  };
}
