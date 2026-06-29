import { useEffect } from "react";

const TABLE_SELECTOR = "table";
const HEADING_SELECTOR = "thead";
const BODY_SELECTOR = "tbody";
const WRAPPER_SELECTOR = [
  "[data-app-table-shell-scroll]",
  ".app-table-shell-scroll",
  ".app-table-shell-wrap",
].join(", ");
const REPORT_TABLE_PAN_SELECTOR = "[data-report-table-pan]";
const TABLE_HEADER_SELECTOR = "thead, thead *";
const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, summary, [role='button'], [tabindex]:not([tabindex='-1'])";

function classifyTable(table) {
  if (!(table instanceof HTMLTableElement)) return;

  if (table.dataset.appTableShell === "off") {
    table.classList.remove("app-table-shell", "app-table-shell--with-headings", "app-table-shell--rows-only");
    return;
  }

  const hasBody = Boolean(table.tBodies?.length || table.querySelector(BODY_SELECTOR));
  if (!hasBody) return;

  const hasHeadings = Boolean(table.tHead || table.querySelector(HEADING_SELECTOR));
  table.classList.add("app-table-shell");
  table.classList.toggle("app-table-shell--with-headings", hasHeadings);
  table.classList.toggle("app-table-shell--rows-only", !hasHeadings);

  const wrapper = table.closest(WRAPPER_SELECTOR) || table.parentElement;
  if (wrapper instanceof HTMLElement && wrapper.dataset.appTableShell !== "off") {
    wrapper.classList.add("app-table-shell-wrap");
    if (wrapper.scrollWidth > wrapper.clientWidth || /auto|scroll/i.test(window.getComputedStyle(wrapper).overflowX)) {
      wrapper.classList.add("app-table-shell-scroll");
    } else {
      wrapper.classList.remove("app-table-shell-scroll");
    }
  }
}

function classifyTables(root) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll(TABLE_SELECTOR).forEach(classifyTable);
  if (root instanceof HTMLTableElement) classifyTable(root);
}

// Column-edge offsets (in the wrapper's scroll coordinate space) for the
// table inside a report-pan wrapper. edges[i] = left offset of column i;
// `last` = right offset of the final column. Measured from live geometry so
// it stays correct regardless of table-layout, padding, or sticky headers.
function getColumnEdges(wrapper) {
  const table = wrapper.querySelector(TABLE_SELECTOR);
  const headRow = table?.tHead?.rows?.[0];
  if (!headRow || !headRow.cells.length) return null;

  const wrapperLeft = wrapper.getBoundingClientRect().left;
  const base = wrapper.scrollLeft;
  const cells = Array.from(headRow.cells);
  const edges = cells.map((c) => c.getBoundingClientRect().left - wrapperLeft + base);
  const lastCell = cells[cells.length - 1].getBoundingClientRect();
  return { edges, last: lastCell.right - wrapperLeft + base };
}

// Page the table by whole columns. Clicking the right edge brings the first
// column that is currently clipped on the right fully into view as the new
// left-most column; clicking the left edge does the mirror, landing the
// previous block of columns so the current left-most column sits at the right.
function nextColumnScroll(wrapper, direction, viewport, current, fallbackStep) {
  const cols = getColumnEdges(wrapper);
  const TOL = 1;
  if (!cols || cols.edges.length <= 1) return current + direction * fallbackStep;

  if (direction === 1) {
    const visibleRight = current + viewport;
    let target = null;
    for (let i = 0; i < cols.edges.length; i += 1) {
      const right = i + 1 < cols.edges.length ? cols.edges[i + 1] : cols.last;
      if (right > visibleRight + TOL) {
        target = cols.edges[i];
        break;
      }
    }
    // Snap forward to the clipped column's left edge; if no whole-column step
    // is possible (e.g. a single column wider than the viewport) page by width.
    return target != null && target > current + TOL ? target : current + fallbackStep;
  }

  // direction === -1: the current left-most column becomes the new right edge.
  const minLeft = current - viewport;
  let target = 0;
  for (let i = 0; i < cols.edges.length; i += 1) {
    if (cols.edges[i] >= minLeft - TOL) {
      target = cols.edges[i];
      break;
    }
  }
  return target < current - TOL ? target : current - fallbackStep;
}

// Resolve the report-pan wrapper an event points at (cursor over its header,
// not over an interactive control), or null.
function panWrapperFromEvent(target) {
  if (!(target instanceof Element)) return null;
  if (target.closest(INTERACTIVE_SELECTOR)) return null;
  const header = target.closest(TABLE_HEADER_SELECTOR);
  if (!header) return null;
  const wrapper = target.closest(REPORT_TABLE_PAN_SELECTOR);
  if (!(wrapper instanceof HTMLElement) || !wrapper.contains(header)) return null;
  return wrapper;
}

// "left" | "right" | "" — the live pan zone under clientX. Returns "" when the
// table doesn't overflow or that side is already fully scrolled, so the cursor
// affordance and the click action only fire when panning will actually move.
function resolvePanEdge(wrapper, clientX) {
  const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
  if (maxScroll <= 0) return "";
  const rect = wrapper.getBoundingClientRect();
  const x = clientX - rect.left;
  const edgeSize = Math.max(56, Math.min(160, rect.width * 0.22));
  if (x >= rect.width - edgeSize && wrapper.scrollLeft < maxScroll - 1) return "right";
  if (x <= edgeSize && wrapper.scrollLeft > 1) return "left";
  return "";
}

// Tracks which wrapper currently carries the data-pan-hot affordance so it can
// be cleared when the cursor moves away or the scroll position changes.
let hotWrapper = null;
let pendingMoveEvent = null;
let moveFrame = 0;

function clearPanHot() {
  if (hotWrapper) {
    delete hotWrapper.dataset.panHot;
    hotWrapper = null;
  }
}

function applyPanHotFromMove(event) {
  const wrapper = panWrapperFromEvent(event.target);
  const edge = wrapper ? resolvePanEdge(wrapper, event.clientX) : "";
  if (!wrapper || !edge) {
    clearPanHot();
    return;
  }
  if (hotWrapper && hotWrapper !== wrapper) delete hotWrapper.dataset.panHot;
  wrapper.dataset.panHot = edge;
  hotWrapper = wrapper;
}

// Throttle the per-move layout reads to one per animation frame.
function onPanPointerMove(event) {
  pendingMoveEvent = event;
  if (moveFrame) return;
  moveFrame = window.requestAnimationFrame(() => {
    moveFrame = 0;
    if (pendingMoveEvent) applyPanHotFromMove(pendingMoveEvent);
  });
}

function panReportTableFromHeaderClick(event) {
  const wrapper = panWrapperFromEvent(event.target);
  if (!wrapper) return;

  const edge = resolvePanEdge(wrapper, event.clientX);
  if (!edge) return;

  event.preventDefault();
  const direction = edge === "right" ? 1 : -1;
  const rect = wrapper.getBoundingClientRect();
  const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;
  const fallbackStep = Math.max(160, rect.width * 0.72);
  const rawNext = nextColumnScroll(wrapper, direction, wrapper.clientWidth, wrapper.scrollLeft, fallbackStep);
  const nextLeft = Math.max(0, Math.min(maxScroll, rawNext));
  wrapper.scrollTo({ left: nextLeft, behavior: "smooth" });
  // Paging changes which sides are still pannable — drop the hint and let the
  // next pointer move re-evaluate against the new scroll position.
  clearPanHot();
}

export default function GlobalTableShells() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    classifyTables(document);
    const handleResize = () => classifyTables(document);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLTableElement) {
          classifyTable(mutation.target);
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) classifyTables(node);
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-app-table-shell"],
    });

    window.addEventListener("resize", handleResize);
    document.addEventListener("click", panReportTableFromHeaderClick);
    document.addEventListener("mousemove", onPanPointerMove);
    document.addEventListener("mouseleave", clearPanHot);
    // Scroll (incl. the smooth pan itself) changes which edges are still live.
    window.addEventListener("scroll", clearPanHot, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("click", panReportTableFromHeaderClick);
      document.removeEventListener("mousemove", onPanPointerMove);
      document.removeEventListener("mouseleave", clearPanHot);
      window.removeEventListener("scroll", clearPanHot, true);
      if (moveFrame) window.cancelAnimationFrame(moveFrame);
      clearPanHot();
    };
  }, []);

  return null;
}
