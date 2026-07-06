// file location: src/lib/topbar/favourites.js
//
// Cross-department favourites (Phase 3.3) — PURE normalisation + mapping. A
// favourite is a permanently kept page, record or report the user marks so it's
// always one keystroke away regardless of which department they're in.
//
// Distinct from pinned shortcuts (Phase 2.5): pins render as chips in the bar and
// are capped/ordered for that strip; favourites are an unbounded, cross-cutting
// library surfaced in the command palette and the productivity panel.
//
// No React/storage/window — deterministic and unit-testable.

import { classifyRoute } from "@/lib/topbar/recentActivity";

export const FAVOURITE_KINDS = { page: "Page", record: "Record", report: "Report" };

function titleFromHref(href) {
  const base = String(href || "").split("?")[0].split("#")[0];
  const segs = base.split("/").filter(Boolean);
  const last = segs[segs.length - 1] || "home";
  return last
    .replace(/\[|\]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Normalise arbitrary input into a stored favourite, or null if it has no href.
// `kind` is inferred from the route (records/reports via classifyRoute) unless
// explicitly provided.
export function normaliseFavourite(input, ts = 0) {
  if (!input) return null;
  const href = (input.href || "").split("#")[0];
  if (!href) return null;

  const classified = classifyRoute(href);
  const kind =
    input.kind ||
    (classified
      ? classified.category === "report"
        ? "report"
        : "record"
      : "page");

  return {
    href,
    kind,
    label: input.label || classified?.label || titleFromHref(href),
    subtitle:
      input.subtitle ||
      classified?.subtitle ||
      (kind === "page" ? "Page" : FAVOURITE_KINDS[kind] || ""),
    category: classified?.category || input.category || "page",
    icon: input.icon || classified?.icon || "★",
    ts,
  };
}

// Map a favourite onto a command-palette command source.
export function favouriteToCommandSource(fav) {
  if (!fav?.href) return null;
  return {
    id: `favourite:${fav.href}`,
    title: fav.label,
    subtitle: fav.subtitle,
    href: fav.href,
    keywords: [fav.category, fav.kind, "favourite", "starred"].filter(Boolean),
    icon: "★",
  };
}

// True when two favourites (or a favourite + href) point at the same target.
export function isSameFavourite(a, b) {
  const ha = (typeof a === "string" ? a : a?.href || "").split("#")[0];
  const hb = (typeof b === "string" ? b : b?.href || "").split("#")[0];
  return Boolean(ha) && ha === hb;
}
