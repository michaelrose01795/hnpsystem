// file location: src/features/workspaces/workspaceModel.js
//
// Pure state model for the multi-workspace DMS shell. No React, no DOM, no
// storage — everything here is a plain function over plain objects so it can be
// unit-tested (workspaceModel.test.js) and reasoned about in isolation.
//
// Vocabulary:
//   mode       "single" — the normal app: the host document shows its own page
//              in the one page card. "multi" — the page-card area is split into
//              workspaces; the sidebar, topbar and status drawer stay exactly
//              where they are and drive whichever workspace is focused.
//   workspace  one independent DMS page in its own page card. In multi mode
//              EVERY workspace is a same-origin iframe of the app running in
//              embedded (chrome-less) mode, so each page has its own router,
//              its own page state, its own viewport (media queries and
//              useIsMobile answer for the card, not the window) and its own
//              popups, which centre in that card and never cover the others.
//   host       the document the user loaded. In multi mode it renders no page;
//              its route only matters as a way in (see hostHref).
//   slot       a column on screen. There are as many slots as the available
//              width fits at MIN_PANE_WIDTH, capped at the workspace count.
//   tabbed     when there are more workspaces than slots, the last slot hosts
//              the overflow as tabs. Hidden workspaces stay mounted, so a
//              narrower window never loses a workspace's state.

export const MAX_WORKSPACES = 3;
export const MIN_WORKSPACES = 2;

// Narrowest a pane may be dragged or laid out. Below this the page inside no
// longer reads as a desktop DMS page, so the layout collapses into tabs instead.
export const MIN_PANE_WIDTH = 640;
// Width EACH pane would need before the shell offers multi-workspace by itself.
// Set well above MIN_PANE_WIDTH so an ordinary 1920px screen never sees the
// prompt — it only appears on genuinely wide windows (QHD/ultrawide, or spanning
// monitors). The right-click menu offers the mode on any desktop width.
export const SUGGEST_PANE_WIDTH = 1000;
// Width of the divider between two panes (hit area; the visible pill is thinner).
export const DIVIDER_WIDTH = 12;

export const LAYOUT_PRESETS = [
  { id: "50-50", label: "50/50", lead: 0.5 },
  { id: "60-40", label: "60/40", lead: 0.6 },
  { id: "70-30", label: "70/30", lead: 0.7 },
];

// v1 stored a host-rendered primary workspace plus extra frames. v2 stores the
// mode and every pane. A v1 record is discarded (the user simply starts in the
// normal single view) apart from the prompt dismissal, which carries over.
export const STORAGE_VERSION = 2;

const DEFAULT_WEIGHT = 1;

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------
export function createInitialState() {
  return {
    mode: "single",
    workspaces: [],
    weights: {},
    focusedId: null,
    // Most-recently-focused first. Used to pick the "other" workspace a link
    // should open in, and who inherits focus when a workspace closes.
    focusHistory: [],
    tabbedId: null,
    // Highest capacity the user has already said "not now" to. The prompt only
    // returns if even more room appears (e.g. a third monitor).
    promptDismissedCapacity: 0,
    // The host route the panes were last in step with. When the host route
    // moves away from it (topbar search, a notification link, Back, or the user
    // loading a new URL) that page is sent to the focused workspace.
    hostHref: null,
  };
}

let idCounter = 0;
export function createWorkspaceId() {
  idCounter += 1;
  const random = Math.random().toString(36).slice(2, 7);
  return `ws-${Date.now().toString(36)}-${idCounter}-${random}`;
}

export const isMulti = (state) => state?.mode === "multi" && state.workspaces.length > 0;

// ---------------------------------------------------------------------------
// Hrefs + labels
// ---------------------------------------------------------------------------
// Route prefixes that must never load inside a workspace: they are either not
// staff pages (customer site / portal, public reports), have their own full
// shell (login, presentation), or are not pages at all.
const INELIGIBLE_PREFIXES = [
  "/multi-view",
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

// Path only — two hrefs that differ just by query/hash are the same page for
// "is this already open somewhere?".
const pathOf = (href) => String(href || "").split("#")[0].split("?")[0].replace(/\/$/, "");

// ---------------------------------------------------------------------------
// The multi-view URL
// ---------------------------------------------------------------------------
// In multi mode the address bar names every card, e.g. two cards on /messages
// and /job-cards/12345 read "/multi-view/messages-job-cards.12345". Within a
// card "/" becomes "." and cards are joined by "-"; a card with no page yet is
// "empty". The URL is for the user to read — a reload restores the exact pages
// from storage — so decoding it (parseMultiViewPath) is best effort.
export const MULTI_VIEW_BASE = "/multi-view";
export const EMPTY_CARD_SLUG = "empty";
const CARD_SEPARATOR = "-";
const SEGMENT_SEPARATOR = ".";

export const isMultiViewPath = (href) => matchesPrefix(pathOf(href), MULTI_VIEW_BASE);

const slugForPath = (path) =>
  String(path || "")
    .split("/")
    .filter(Boolean)
    .join(SEGMENT_SEPARATOR);

/** "/multi-view/<card>-<card>" for these workspaces, in on-screen order. */
export function multiViewHref(workspaces = []) {
  const slugs = workspaces.map((w) => slugForPath(pathOf(w?.href)) || EMPTY_CARD_SLUG);
  return `${MULTI_VIEW_BASE}/${slugs.join(CARD_SEPARATOR)}`;
}

/**
 * Best-effort inverse of multiViewHref. Page names contain "-" too, so each card
 * is matched against the known page paths (longest first) before falling back
 * to "up to the next -". Returns hrefs (null for an empty card), capped at
 * MAX_WORKSPACES.
 */
export function parseMultiViewPath(href, knownPaths = []) {
  const path = pathOf(href);
  if (!matchesPrefix(path, MULTI_VIEW_BASE)) return [];
  let rest = path.slice(MULTI_VIEW_BASE.length).replace(/^\/+/, "");
  try {
    rest = decodeURIComponent(rest);
  } catch {
    // Keep the raw text; it is only ever matched, never rendered as HTML.
  }
  const known = [...new Set((knownPaths || []).map(slugForPath).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );
  const endsAt = (text, index) => index === text.length || text[index] === CARD_SEPARATOR;
  const hrefs = [];
  while (rest && hrefs.length < MAX_WORKSPACES) {
    let slug = null;
    if (rest.startsWith(EMPTY_CARD_SLUG) && endsAt(rest, EMPTY_CARD_SLUG.length)) {
      slug = EMPTY_CARD_SLUG;
    } else {
      const match = known.find(
        (candidate) =>
          rest.startsWith(candidate) &&
          (endsAt(rest, candidate.length) || rest[candidate.length] === SEGMENT_SEPARATOR)
      );
      let length = match ? match.length : 0;
      // A known page plus its detail segments ("job-cards.12345"), or an
      // unknown page read up to the next card separator.
      const tail = rest.slice(length);
      const next = tail.indexOf(CARD_SEPARATOR);
      if (!match || tail.startsWith(SEGMENT_SEPARATOR)) length += next < 0 ? tail.length : next;
      slug = rest.slice(0, length);
    }
    hrefs.push(slug === EMPTY_CARD_SLUG ? null : `/${slug.split(SEGMENT_SEPARATOR).join("/")}`);
    rest = rest.slice(slug.length).replace(/^-/, "");
  }
  return hrefs;
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

/** How many page cards are on screen: 1 in single mode. */
export const workspaceCount = (state) => (isMulti(state) ? state.workspaces.length : 1);

export function shouldOfferWorkspace(state, areaWidth) {
  const capacity = suggestCapacity(areaWidth);
  const count = workspaceCount(state);
  return capacity > count && count < MAX_WORKSPACES && capacity > (state.promptDismissedCapacity || 0);
}

/**
 * Which workspaces are on screen and which are tabbed.
 * Returns { slots, visibleIds, tabIds, tabbedShownId }.
 */
export function computeLayout(state, areaWidth) {
  const ids = isMulti(state) ? state.workspaces.map((w) => w.id) : [];
  if (!ids.length) return { slots: 0, visibleIds: [], tabIds: [], tabbedShownId: null };
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

/** The page the focused workspace is showing (null in single mode / start panel). */
export function focusedHref(state) {
  if (!isMulti(state)) return null;
  return getWorkspace(state, state.focusedId)?.href || null;
}

/** A workspace already showing this page, if any. */
export function findWorkspaceShowing(state, href) {
  if (!href) return null;
  const target = pathOf(href);
  const exact = state.workspaces.find((w) => w.href === href);
  if (exact) return exact.id;
  const samePath = state.workspaces.find((w) => w.href && pathOf(w.href) === target);
  return samePath ? samePath.id : null;
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

/**
 * Per-card width choices offered in a card's options, for `count` visible cards.
 * `share` is that card's fraction of the visible width; the others split the rest.
 */
export function cardWidthChoices(count) {
  if (count < 2) return [];
  const equal = 1 / count;
  return count === 2
    ? [
        { id: "equal", label: "Equal", share: equal },
        { id: "wider", label: "Wider", share: 0.6 },
        { id: "widest", label: "Widest", share: 0.7 },
      ]
    : [
        { id: "equal", label: "Equal", share: equal },
        { id: "wider", label: "Wider", share: 0.45 },
        { id: "widest", label: "Widest", share: 0.55 },
      ];
}

/** Largest share one card can take while every other visible card keeps MIN_PANE_WIDTH. */
export function maxCardShare(count, areaWidth) {
  if (count < 2 || !(areaWidth > 0)) return 1;
  const usable = areaWidth - (count - 1) * DIVIDER_WIDTH;
  return Math.max(1 / count, 1 - ((count - 1) * MIN_PANE_WIDTH) / usable);
}

/** Give card `id` `share` of the visible width; the other visible cards share the rest evenly. */
export function applyCardWidth(state, visibleIds, id, share) {
  if (visibleIds.length < 2 || !visibleIds.includes(id)) return state;
  const clamped = Math.min(0.9, Math.max(0.1, Number(share) || 1 / visibleIds.length));
  const rest = (1 - clamped) / (visibleIds.length - 1);
  const weights = { ...state.weights };
  visibleIds.forEach((visibleId) => {
    weights[visibleId] = visibleId === id ? clamped : rest;
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

/** The workspace a link from `sourceId` should open in, or null (= add one). */
export function pickOtherWorkspace(state, sourceId) {
  if (!isMulti(state)) return null;
  const candidates = state.focusHistory.filter(
    (id) => id !== sourceId && state.workspaces.some((w) => w.id === id)
  );
  if (candidates.length) return candidates[0];
  const fallback = state.workspaces.find((w) => w.id !== sourceId);
  return fallback ? fallback.id : null;
}

// Back to the normal single page card. Layout choices the user made (the
// prompt dismissal) survive; the panes do not.
const toSingle = (state) => ({
  ...createInitialState(),
  promptDismissedCapacity: state.promptDismissedCapacity,
  hostHref: state.hostHref,
});

export function workspaceReducer(state, action) {
  switch (action.type) {
    case "restore":
      return action.state ? { ...action.state } : state;

    // Split the page-card area. `hrefs` are the pages to start with — normally
    // [the page the user is on, null (= choose a page)] or [current, link].
    // `focusIndex` picks the workspace the sidebar drives first.
    case "enter": {
      if (isMulti(state)) return state;
      const hrefs = (Array.isArray(action.hrefs) ? action.hrefs : [])
        .slice(0, MAX_WORKSPACES)
        .map((href) => href || null);
      while (hrefs.length < MIN_WORKSPACES) hrefs.push(null);
      const ids = Array.isArray(action.ids) ? action.ids : [];
      const workspaces = hrefs.map((href, index) => ({ id: ids[index] || createWorkspaceId(), href }));
      const weights = Object.fromEntries(workspaces.map((w) => [w.id, DEFAULT_WEIGHT]));
      const focusIndex = Math.min(
        workspaces.length - 1,
        Math.max(0, Number.isInteger(action.focusIndex) ? action.focusIndex : workspaces.length - 1)
      );
      const focused = workspaces[focusIndex].id;
      return {
        ...state,
        mode: "multi",
        workspaces,
        weights,
        focusedId: focused,
        focusHistory: [focused, ...workspaces.map((w) => w.id).filter((id) => id !== focused)],
        tabbedId: focused,
        hostHref: action.hostHref ?? state.hostHref,
      };
    }

    case "exit":
      return toSingle(state);

    case "add": {
      if (!isMulti(state) || state.workspaces.length >= MAX_WORKSPACES) return state;
      const id = action.id || createWorkspaceId();
      const record = { id, href: action.href || null };
      const workspaces = [...state.workspaces];
      const afterIndex = action.afterId ? workspaces.findIndex((w) => w.id === action.afterId) : -1;
      if (afterIndex >= 0) workspaces.splice(afterIndex + 1, 0, record);
      else workspaces.push(record);
      // A new pane takes an equal share of the current total, so a third lands
      // at thirds.
      const count = state.workspaces.length;
      const total = state.workspaces.reduce((sum, w) => sum + weightOf(state, w.id), 0);
      const weights = { ...state.weights, [id]: count ? total / count : DEFAULT_WEIGHT };
      const next = { ...state, workspaces, weights };
      // `focus: false` opens beside the user without taking the sidebar away
      // from where they are working (links sent to another workspace).
      if (action.focus === false) return { ...next, tabbedId: id };
      return touchFocus({ ...next, tabbedId: id }, id);
    }

    // Removes one pane. The host turns "close the second-last pane" into an
    // exit instead, so the mode never sits on a single split card.
    case "close": {
      if (!getWorkspace(state, action.id)) return state;
      const workspaces = state.workspaces.filter((w) => w.id !== action.id);
      if (!workspaces.length) return toSingle(state);
      const weights = { ...state.weights };
      delete weights[action.id];
      const history = state.focusHistory.filter((entry) => entry !== action.id);
      const focusHistory = history.length ? history : [workspaces[0].id];
      return {
        ...state,
        workspaces,
        weights,
        focusHistory,
        focusedId: state.focusedId === action.id ? focusHistory[0] : state.focusedId,
        tabbedId: state.tabbedId === action.id ? null : state.tabbedId,
      };
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

    // The page inside a workspace changed (reported by the workspace itself).
    // Never reloads anything.
    case "route": {
      const target = getWorkspace(state, action.id);
      if (!target || target.href === action.href) return state;
      return {
        ...state,
        workspaces: state.workspaces.map((w) => (w.id === action.id ? { ...w, href: action.href } : w)),
      };
    }

    case "syncHost":
      return state.hostHref === action.href ? state : { ...state, hostHref: action.href || null };

    // Reorder two workspaces on screen. Only the ORDER changes — the host keeps
    // every frame mounted in place and positions it with CSS `order`, so a swap
    // preserves both pages' state.
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

    case "cardWidth":
      return applyCardWidth(state, action.visibleIds || [], action.id, action.share);

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
// Every pane keeps its CURRENT page, so a reload restores where each one had
// got to, not where it started.
export function serializeState(state) {
  const multi = isMulti(state);
  return {
    version: STORAGE_VERSION,
    mode: multi ? "multi" : "single",
    workspaces: multi ? state.workspaces.map((w) => ({ id: w.id, href: w.href || null })) : [],
    weights: multi ? state.weights : {},
    focusedId: multi ? state.focusedId : null,
    focusHistory: multi ? state.focusHistory : [],
    promptDismissedCapacity: state.promptDismissedCapacity || 0,
    hostHref: multi ? state.hostHref || null : null,
  };
}

export function deserializeState(raw, { isValidHref } = {}) {
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;
  const promptDismissedCapacity = Number(raw.promptDismissedCapacity) || 0;
  if (raw.version !== STORAGE_VERSION) return { ...base, promptDismissedCapacity };

  const seen = new Set();
  const workspaces = (Array.isArray(raw.workspaces) ? raw.workspaces : [])
    .filter((w) => w && typeof w.id === "string" && w.id && !seen.has(w.id) && seen.add(w.id))
    .map((w) => {
      const href = typeof w.href === "string" && w.href ? w.href : null;
      const valid = !href || typeof isValidHref !== "function" || isValidHref(href);
      // A page that can no longer be shown becomes a start panel rather than
      // dropping the pane, so the layout the user built survives.
      return { id: w.id, href: valid ? href : null };
    })
    .slice(0, MAX_WORKSPACES);

  if (raw.mode !== "multi" || workspaces.length < MIN_WORKSPACES) {
    return { ...base, promptDismissedCapacity };
  }

  const ids = workspaces.map((w) => w.id);
  const weights = {};
  ids.forEach((id) => {
    const value = Number(raw.weights?.[id]);
    weights[id] = Number.isFinite(value) && value > 0 ? value : DEFAULT_WEIGHT;
  });
  const focusedId = ids.includes(raw.focusedId) ? raw.focusedId : ids[0];
  const history = (Array.isArray(raw.focusHistory) ? raw.focusHistory : []).filter((id) => ids.includes(id));
  const focusHistory = [...new Set([focusedId, ...history, ...ids])];

  return {
    ...base,
    mode: "multi",
    workspaces,
    weights,
    focusedId,
    focusHistory,
    tabbedId: focusedId,
    promptDismissedCapacity,
    hostHref: typeof raw.hostHref === "string" ? raw.hostHref : null,
  };
}
