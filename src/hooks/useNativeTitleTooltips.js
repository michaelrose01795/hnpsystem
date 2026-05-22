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

    const observer = new MutationObserver((mutations) => {
      if (!inStaffScope()) return;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => convertWithin(node));
        } else if (mutation.type === "attributes") {
          // A re-render (re)set the title — re-sync it. An empty/removed title
          // is ignored, so the removeAttribute("title") inside convertButton
          // cannot trigger a conversion loop.
          convertButton(mutation.target);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });

    return () => observer.disconnect();
  }, []);
}

export default useNativeTitleTooltips;
