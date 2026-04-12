import { useEffect } from "react";

const TABLE_SELECTOR = "table";
const HEADING_SELECTOR = "thead";
const BODY_SELECTOR = "tbody";
const WRAPPER_SELECTOR = [
  "[data-app-table-shell-scroll]",
  ".app-table-shell-scroll",
  ".app-table-shell-wrap",
].join(", ");

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
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return null;
}
