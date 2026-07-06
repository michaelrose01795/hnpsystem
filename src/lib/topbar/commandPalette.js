// file location: src/lib/topbar/commandPalette.js
//
// Universal command palette (Phase 3.1) — PURE command assembly + ranking.
// No React, no storage, no window: deterministic and unit-testable. The hook
// (src/hooks/useCommandPalette.js) owns open/close + keyboard; the component
// (src/components/topbar/CommandPalette.js) renders whatever this returns.
//
// A "command" is the single normalised shape every source is mapped onto, so the
// palette can list pages, records, favourites, recent items, contextual
// suggestions and pure actions side by side and rank them together:
//
//   { id, title, subtitle, section, kind, href?, run?, keywords[], icon?,
//     shortcut?, priority }
//
// kind ∈ page | action | record | favourite | recent | suggestion
// Exactly one of `href` (navigate) or `run` (invoke) drives execution.

// Section ordering in the rendered list. Lower = higher up. Sources not listed
// fall to the end in insertion order.
const SECTION_ORDER = [
  "Suggested",
  "Favourites",
  "Recent",
  "Actions",
  "Pages",
];

// Per-kind base priority — nudges the most useful kinds up when scores tie.
const KIND_PRIORITY = {
  suggestion: 5,
  favourite: 4,
  recent: 3,
  action: 2,
  page: 1,
  record: 1,
};

const KIND_ICON = {
  page: "→",
  action: "⚡",
  record: "•",
  favourite: "★",
  recent: "↻",
  suggestion: "✨",
};

function normaliseKeywords(list) {
  return Array.from(
    new Set(
      (Array.isArray(list) ? list : [])
        .map((k) => String(k || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

// Turn a title into its constituent words for keyword matching.
function wordsOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

// Normalise any source item into a command. Returns null for unusable input
// (no title, or neither href nor run) so callers can filter defensively.
export function toCommand(raw, { kind = "page", section } = {}) {
  if (!raw) return null;
  const title = String(raw.title || raw.label || "").trim();
  const href = raw.href || null;
  const run = typeof raw.run === "function" ? raw.run : null;
  if (!title) return null;
  if (!href && !run) return null;

  const resolvedSection =
    section ||
    raw.section ||
    (kind === "suggestion"
      ? "Suggested"
      : kind === "favourite"
        ? "Favourites"
        : kind === "recent"
          ? "Recent"
          : kind === "action"
            ? "Actions"
            : "Pages");

  return {
    id: raw.id || `${kind}:${href || title}`,
    title,
    subtitle: raw.subtitle || raw.description || raw.type || "",
    section: resolvedSection,
    kind,
    href,
    run,
    keywords: normaliseKeywords([...(raw.keywords || []), ...wordsOf(title)]),
    icon: raw.icon || KIND_ICON[kind] || "→",
    shortcut: raw.shortcut || null,
    priority: raw.priority != null ? raw.priority : KIND_PRIORITY[kind] || 0,
  };
}

// Assemble the full command list from every source. De-duplicates by execution
// target (href, or id for run-commands) keeping the highest-priority kind, so a
// page that is also a favourite surfaces once (as the favourite).
export function buildCommands({
  pages = [],
  actions = [],
  records = [],
  favourites = [],
  recent = [],
  suggestions = [],
} = {}) {
  const sources = [
    ...suggestions.map((r) => toCommand(r, { kind: "suggestion" })),
    ...favourites.map((r) => toCommand(r, { kind: "favourite" })),
    ...recent.map((r) => toCommand(r, { kind: "recent" })),
    ...actions.map((r) => toCommand(r, { kind: "action" })),
    ...records.map((r) => toCommand(r, { kind: "record" })),
    ...pages.map((r) => toCommand(r, { kind: "page" })),
  ].filter(Boolean);

  const byTarget = new Map();
  for (const cmd of sources) {
    const target = cmd.href || cmd.id;
    const existing = byTarget.get(target);
    if (!existing || cmd.priority > existing.priority) {
      byTarget.set(target, cmd);
    }
  }
  return Array.from(byTarget.values());
}

// Score a single command against a lower-cased query. Higher is better; 0 means
// no match (filtered out). Combines match quality with the command's base
// priority so, on an empty query, the most useful items lead.
export function scoreCommand(command, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return command.priority + 1; // empty query → priority-ordered browse
  const title = command.title.toLowerCase();

  let score = 0;
  if (title === q) score = 100;
  else if (title.startsWith(q)) score = 80;
  else if (command.keywords.some((k) => k === q)) score = 70;
  else if (command.keywords.some((k) => k.startsWith(q))) score = 55;
  else if (title.includes(q)) score = 40;
  else if (command.keywords.some((k) => k.includes(q))) score = 25;
  else if (subsequenceMatch(title, q)) score = 12; // fuzzy fallback
  else return 0;

  return score + command.priority;
}

// Lightweight fuzzy match: are all of `q`'s chars present in order in `text`?
function subsequenceMatch(text, q) {
  let i = 0;
  for (let c = 0; c < text.length && i < q.length; c += 1) {
    if (text[c] === q[i]) i += 1;
  }
  return i === q.length;
}

// Filter + rank the command list for a query. Returns a flat array sorted best-
// first, capped to `limit`. Stable for equal scores (falls back to title).
export function filterCommands(commands, query, { limit = 40 } = {}) {
  const scored = [];
  for (const command of commands) {
    const score = scoreCommand(command, query);
    if (score > 0) scored.push({ command, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title)
  );
  return scored.slice(0, limit).map((s) => s.command);
}

// Group a ranked (already-sorted) command list into sections for rendering,
// preserving each section's internal rank order and ordering sections by
// SECTION_ORDER then first-appearance.
export function groupCommands(commands) {
  const groups = new Map();
  for (const command of commands) {
    if (!groups.has(command.section)) groups.set(command.section, []);
    groups.get(command.section).push(command);
  }
  return Array.from(groups.entries())
    .map(([section, items]) => ({ section, items }))
    .sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a.section);
      const bi = SECTION_ORDER.indexOf(b.section);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}

export const __test__ = { SECTION_ORDER, KIND_PRIORITY, subsequenceMatch };
