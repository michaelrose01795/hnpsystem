// file location: src/lib/ui/tableStacking.js
//
// Mobile stacked-card tables — the DOM half of the .app-data-table--stack mode
// defined in src/styles/families/tables.css.
//
// Below the MOBILE breakpoint each table row is rendered as a label/value card
// instead of a row, because a real table is unreadable at the 375px floor and
// this app deliberately never scrolls tables sideways (scrollbar chrome is
// hidden app-wide, so a sideways scroll hides columns behind an invisible
// scrollbar). Each cell therefore has to carry its own column heading. CSS
// cannot do that — a stylesheet has no way to read thead text into a tbody
// cell — so the label is stamped onto the cell as data-label here and rendered
// by the CSS via attr().
//
// Doing this against the live DOM rather than by cloning React children is
// deliberate: rows are nearly always produced by .map() inside fragments, so
// cloning would mean walking an arbitrary element tree to find the cells, and
// would still miss any table built by a component that renders its own rows.

import { MEDIA } from "@/styles/breakpoints";

/**
 * Opt a table out with data-app-table-stack="off".
 *
 * Checked on the table AND on its ancestors, because DataTableShell puts the
 * attribute on the wrapper it renders — it has no handle on the table element,
 * which is an arbitrary child passed in as its children prop.
 */
export function isStackDisabled(table) {
  if (!table) return false;
  if (table.dataset?.appTableStack === "off") return true;
  return Boolean(table.closest?.('[data-app-table-stack="off"]'));
}

/**
 * Stamp data-label onto every body cell of a table, taken from the header cell
 * in the same column. Idempotent — safe to call on every mutation.
 *
 * A cell that already has an explicit data-label is never overwritten, so a
 * page can set data-label="" to opt a checkbox or actions column out of
 * labelling, or supply its own wording where the visible heading is an icon.
 */
export function applyStackLabels(table) {
  const headerRow = table?.tHead?.rows?.[table.tHead.rows.length - 1];
  if (!headerRow) return;

  // colSpan-aware: a header spanning two columns labels both, so the column
  // index advances by the span rather than by one. Getting this wrong shifts
  // every label after the first spanned header into the wrong column.
  const labels = [];
  for (const th of headerRow.cells) {
    const text = (th.textContent || "").trim();
    for (let i = 0; i < (th.colSpan || 1); i += 1) labels.push(text);
  }

  for (const body of table.tBodies) {
    for (const row of body.rows) {
      let column = 0;
      for (const cell of row.cells) {
        if (!cell.hasAttribute("data-label")) {
          // An empty heading (actions / checkbox column) stamps "", which the
          // CSS reads as "no label" and drops the label gutter for.
          cell.setAttribute("data-label", labels[column] || "");
        }
        column += cell.colSpan || 1;
      }
    }
  }
}

/**
 * Whether this table should be in stacked-card mode right now.
 *
 * Width is evaluated in JS as well as in CSS because the two halves do
 * different jobs: the CSS media query performs the layout, while this decides
 * whether the table keeps its desktop table chrome at all — see the note in
 * GlobalTableShells about .app-table-shell. Returns false during SSR, where
 * there is no width to measure.
 */
export function shouldStack(table) {
  if (isStackDisabled(table)) return false;
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MEDIA.mobile).matches;
}

/**
 * Put a table into stacked-card mode, or take it out. Returns the new state.
 *
 * The CSS keys off a class on the table element itself, so that the many raw
 * table call sites behave identically to ones wrapped in DataTableShell.
 */
export function applyStacking(table) {
  if (!table || !table.classList) return false;
  const stacked = shouldStack(table);
  table.classList.toggle("app-data-table--stack", stacked);
  // Label even when not currently stacked, so a desktop-to-mobile resize does
  // not flash a stack of unlabelled values before the next mutation lands.
  if (!isStackDisabled(table)) applyStackLabels(table);
  return stacked;
}
