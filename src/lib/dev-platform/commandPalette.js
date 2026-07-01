// file location: src/lib/dev-platform/commandPalette.js
//
// Phase 10 — PURE command-palette model: the list of commands (navigation +
// quick actions) and a small fuzzy matcher/ranker. No React, no I/O — the
// overlay UI (CommandPalette.js) renders whatever searchCommands() returns and
// invokes the chosen command's `run`. node-testable.

import { DEV_PLATFORM_NAV } from "@/components/dev-platform/devPlatformNav";

const arr = (v) => (Array.isArray(v) ? v : []);

// Subsequence fuzzy score: every query char must appear in order. Rewards
// contiguous runs, word-boundary starts, and a prefix match. Returns -1 for no
// match, else a score (higher = better).
export function fuzzyScore(query, text) {
  const q = String(query || "").toLowerCase();
  const t = String(text || "").toLowerCase();
  if (!q) return 0;
  if (!t) return -1;
  let qi = 0;
  let score = 0;
  let run = 0;
  let prevMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      let bonus = 1;
      if (prevMatchIdx === ti - 1) {
        run += 1;
        bonus += run * 2; // contiguous run
      } else {
        run = 0;
      }
      if (ti === 0 || /[\s/\-_.]/.test(t[ti - 1])) bonus += 3; // word boundary
      score += bonus;
      prevMatchIdx = ti;
      qi += 1;
    }
  }
  if (qi < q.length) return -1; // not all query chars matched, in order
  if (t.startsWith(q)) score += 5;
  score -= Math.max(0, t.length - q.length) * 0.05; // slight brevity preference
  return score;
}

/**
 * Build the default command set. Navigation commands come from DEV_PLATFORM_NAV
 * (so a new platform area is automatically a palette command); action commands
 * are supplied by the caller (they close over router/hooks in the UI layer).
 *
 * @param {{ navigate?: (href:string)=>void, actions?: object[] }} [ctx]
 * @returns {Array<{ id, title, subtitle?, group, keywords?, run?, href? }>}
 */
export function buildDefaultCommands(ctx = {}) {
  const navigate = typeof ctx.navigate === "function" ? ctx.navigate : () => {};
  const navCommands = arr(DEV_PLATFORM_NAV).map((item) => ({
    id: `nav:${item.key}`,
    title: `Go to ${item.label}`,
    subtitle: item.description,
    group: "Navigate",
    icon: item.icon,
    href: item.href,
    keywords: [item.key, item.label, "open", "go"],
    run: () => navigate(item.href),
  }));
  return [...navCommands, ...arr(ctx.actions)];
}

/**
 * Filter + rank commands for a query. Empty query → the commands unchanged
 * (grouped order preserved). Searches title + subtitle + keywords.
 *
 * @param {object[]} commands
 * @param {string} query
 * @param {{ limit?: number }} [opts]
 * @returns {object[]} ranked matches
 */
export function searchCommands(commands = [], query = "", opts = {}) {
  const cmds = arr(commands);
  const q = String(query || "").trim();
  if (!q) return opts.limit ? cmds.slice(0, opts.limit) : cmds;

  const scored = [];
  for (const cmd of cmds) {
    const haystacks = [cmd.title, cmd.subtitle, ...arr(cmd.keywords)].filter(Boolean);
    let best = -1;
    for (const h of haystacks) best = Math.max(best, fuzzyScore(q, h));
    if (best >= 0) scored.push({ cmd, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  const ranked = scored.map((s) => s.cmd);
  return opts.limit ? ranked.slice(0, opts.limit) : ranked;
}

/** Group a command list by its `group` field, preserving first-seen order. */
export function groupCommands(commands = []) {
  const groups = [];
  const index = new Map();
  for (const cmd of arr(commands)) {
    const key = cmd.group || "Actions";
    if (!index.has(key)) {
      index.set(key, { group: key, commands: [] });
      groups.push(index.get(key));
    }
    index.get(key).commands.push(cmd);
  }
  return groups;
}
