// file location: src/lib/support/providers/uiStateProvider.js
//
// Built-in diagnostic provider — captures non-sensitive UI state at report time:
// the active tab, modal state, filter selections, and which form fields exist /
// are filled. It deliberately NEVER reads form values (no names, no free text the
// user typed) — only field identity (name/label/type) and a boolean "filled".
// Anything it does return is still run through the shared sanitiser downstream.
//
// All DOM access goes through the injected `doc` so the function stays pure and
// node-testable (tests pass a tiny document stub).

const text = (el) => (el?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);

// Selector for "this is a modal" that EXCLUDES our own support popup so we report
// the underlying app's modal state, not the report dialog.
const MODAL_SELECTOR = "[aria-modal='true']:not([aria-label='Report a problem']), [data-modal-portal='true']";

const fieldLabel = (el, doc) => {
  const aria = el.getAttribute?.("aria-label");
  if (aria) return aria.slice(0, 60);
  const id = el.getAttribute?.("id");
  if (id && doc?.querySelector) {
    const lbl = doc.querySelector(`label[for="${id}"]`);
    if (lbl) return text(lbl).slice(0, 60);
  }
  return el.getAttribute?.("name") || el.getAttribute?.("placeholder") || el.getAttribute?.("type") || "field";
};

const isFilled = (el) => {
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input") {
    const type = (el.getAttribute?.("type") || "text").toLowerCase();
    if (type === "checkbox" || type === "radio") return Boolean(el.checked);
    return Boolean(el.value);
  }
  if (tag === "select" || tag === "textarea") return Boolean(el.value);
  return false;
};

/**
 * @param {{ doc?: Document }} context
 * @returns {object}
 */
export function collectUiState({ doc } = {}) {
  if (!doc || typeof doc.querySelector !== "function") return {};
  const out = {};

  // Active tab — prefer the dev-layout hint, fall back to ARIA / active class.
  const activeTabEl =
    doc.querySelector("[data-dev-active-tab-label]") ||
    doc.querySelector("[role='tab'][aria-selected='true']") ||
    doc.querySelector(".tab-api__item.is-active");
  const activeTab =
    activeTabEl?.getAttribute?.("data-dev-active-tab-label") || (activeTabEl ? text(activeTabEl) : null);
  if (activeTab) out.activeTab = activeTab;

  // Modal state (underlying app, not the support popup).
  const modals = doc.querySelectorAll ? Array.from(doc.querySelectorAll(MODAL_SELECTOR)) : [];
  if (modals.length) {
    out.modal = {
      open: true,
      count: modals.length,
      label: modals[0]?.getAttribute?.("aria-label") || text(modals[0]) || undefined,
    };
  }

  // Filter selections — selected option LABELS for selects/dropdowns inside a
  // filter region. Values here are UI choices (status, range), not free text, but
  // they are still sanitised downstream.
  const filterScopes = doc.querySelectorAll
    ? Array.from(doc.querySelectorAll("[data-filter-bar] select, .filter-bar select, [role='combobox'][aria-label]"))
    : [];
  const filters = filterScopes
    .map((el) => {
      const name = el.getAttribute?.("name") || el.getAttribute?.("aria-label") || "filter";
      const selected =
        el.tagName?.toLowerCase() === "select"
          ? text(el.options?.[el.selectedIndex])
          : el.getAttribute?.("data-value") || el.getAttribute?.("aria-activedescendant") || "";
      return { name: String(name).slice(0, 60), value: String(selected || "").slice(0, 60) };
    })
    .filter((f) => f.value);
  if (filters.length) out.filters = filters.slice(0, 12);

  // Form fields — identity + filled boolean only, NEVER the value.
  const fields = doc.querySelectorAll ? Array.from(doc.querySelectorAll("input, select, textarea")) : [];
  const forms = fields
    .filter((el) => {
      const type = (el.getAttribute?.("type") || "").toLowerCase();
      return type !== "hidden" && type !== "submit" && type !== "button";
    })
    .slice(0, 40)
    .map((el) => ({
      field: String(fieldLabel(el, doc)).slice(0, 60),
      type: (el.getAttribute?.("type") || el.tagName || "").toString().toLowerCase().slice(0, 20),
      filled: isFilled(el),
    }));
  if (forms.length) out.formFields = forms;

  return out;
}

export const uiStateProvider = {
  id: "ui-state",
  label: "UI state",
  devOnly: false,
  collect: collectUiState,
};

export default uiStateProvider;
