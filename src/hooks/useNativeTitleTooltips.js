// file location: src/hooks/useNativeTitleTooltips.js
// App-wide replacement of native browser title= tooltips on <button> elements
// with the shared staffglobal styled tooltip (.app-hover-tooltip / data-tooltip,
// defined in src/styles/staffglobal.css). Mounted once from the global Layout.
import { useEffect } from "react";

const TOOLTIP_CLASS = "app-hover-tooltip";

// Move a button's native title= onto the styled-tooltip mechanism:
//  - title text  -> data-tooltip   (rendered by the .app-hover-tooltip ::after)
//  - add the .app-hover-tooltip class so the styled bubble is wired up
//  - strip title  so the browser's native tooltip bubble no longer appears
const convertButton = (button) => {
  if (!button || button.tagName !== "BUTTON") return;
  const title = button.getAttribute("title");
  if (!title) return;
  const text = title.trim();
  if (!text) return;

  button.setAttribute("data-tooltip", text);
  button.classList.add(TOOLTIP_CLASS);

  // Preserve the accessible name for icon-only buttons — title= was their only
  // label, and data-tooltip is not exposed to assistive tech. Buttons that
  // already have visible text or an aria label keep their existing name.
  const hasAccessibleName =
    button.getAttribute("aria-label") ||
    button.getAttribute("aria-labelledby") ||
    button.textContent.trim();
  if (!hasAccessibleName) {
    button.setAttribute("aria-label", text);
  }

  button.removeAttribute("title");
};

/**
 * Converts every <button title="…"> in the app into the staffglobal styled
 * tooltip. A MutationObserver keeps dynamically rendered and re-rendered
 * buttons converted (e.g. a title that changes on state, like "Copy" ->
 * "Copied!"). Only runs while the staff style scope (html.staff-scope) is
 * active, since the .app-hover-tooltip CSS lives in staffglobal.css.
 */
export function useNativeTitleTooltips() {
  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return undefined;
    }

    const inStaffScope = () =>
      document.documentElement.classList.contains("staff-scope");

    const convertWithin = (root) => {
      if (!root || root.nodeType !== 1) return; // element nodes only
      if (root.tagName === "BUTTON") convertButton(root);
      if (typeof root.querySelectorAll === "function") {
        root.querySelectorAll("button[title]").forEach(convertButton);
      }
    };

    // Initial sweep of everything already mounted.
    if (inStaffScope()) convertWithin(document.body);

    // Mutations are queued and drained once per frame rather than converted
    // inline. A single interaction can produce hundreds of them — collapsing the
    // sidebar swaps every nav label for an icon and sets a title on each button —
    // and running a querySelectorAll sweep per mutation landed all of that work
    // on the first frame of the animation. Draining in one rAF pass, with the
    // nodes de-duplicated, keeps that off the critical frame.
    let pendingNodes = new Set();
    let pendingAttrTargets = new Set();
    let drainFrame = 0;

    const drain = () => {
      drainFrame = 0;
      const nodes = pendingNodes;
      const attrTargets = pendingAttrTargets;
      pendingNodes = new Set();
      pendingAttrTargets = new Set();
      if (!inStaffScope()) return;
      nodes.forEach((node) => {
        // Nodes removed again before the drain no longer need converting.
        if (node.isConnected) convertWithin(node);
      });
      attrTargets.forEach((node) => {
        if (node.isConnected) convertButton(node);
      });
    };

    const scheduleDrain = () => {
      if (drainFrame) return;
      drainFrame =
        typeof window.requestAnimationFrame === "function"
          ? window.requestAnimationFrame(drain)
          : window.setTimeout(drain, 16);
    };

    const observer = new MutationObserver((mutations) => {
      if (!inStaffScope()) return;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) pendingNodes.add(node);
          });
        } else if (mutation.type === "attributes") {
          // A re-render (re)set the title — re-sync it. An empty/removed title
          // is ignored, so the removeAttribute("title") inside convertButton
          // cannot trigger a conversion loop.
          pendingAttrTargets.add(mutation.target);
        }
      });
      if (pendingNodes.size || pendingAttrTargets.size) scheduleDrain();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    return () => {
      observer.disconnect();
      if (drainFrame) {
        if (typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(drainFrame);
        } else {
          window.clearTimeout(drainFrame);
        }
      }
    };
  }, []);
}

export default useNativeTitleTooltips;
