// Utility to auto-apply the rounded dropdown theme across native <select> elements
const DEFAULT_SELECTOR = 'select:not([data-dropdown-style="native"])';
const DEFAULT_VARIANT = "glass";

const transferMarginsToWrapper = (select, wrapper) => {
  if (typeof window === "undefined") return;
  const computed = window.getComputedStyle(select);
  if (!computed) return;
  const hasMargin =
    computed.marginTop !== "0px" ||
    computed.marginRight !== "0px" ||
    computed.marginBottom !== "0px" ||
    computed.marginLeft !== "0px";
  if (!hasMargin) return;
  wrapper.style.marginTop = computed.marginTop;
  wrapper.style.marginRight = computed.marginRight;
  wrapper.style.marginBottom = computed.marginBottom;
  wrapper.style.marginLeft = computed.marginLeft;
  select.style.marginTop = "0px";
  select.style.marginRight = "0px";
  select.style.marginBottom = "0px";
  select.style.marginLeft = "0px";
};

const wrapSelectElement = (select, variantClass) => {
  let wrapper = select.closest(".dropdown-theme");
  if (wrapper) {
    wrapper.classList.add(variantClass);
    return wrapper;
  }
  wrapper = document.createElement("div");
  wrapper.className = `dropdown-theme ${variantClass}`.trim();
  const parent = select.parentNode;
  if (parent) {
    parent.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    transferMarginsToWrapper(select, wrapper);
  }
  return wrapper;
};

export const applyDropdownTheme = (select, options = {}) => {
  if (typeof window === "undefined" || !(select instanceof HTMLSelectElement)) return null;
  if (select.dataset.dropdownStyle === "native") return null;
  const variant = options.variant || select.dataset.dropdownVariant || DEFAULT_VARIANT;
  const variantClass = `dropdown-theme--${variant}`;
  wrapSelectElement(select, variantClass);
  select.classList.add("dropdown-theme__select", `dropdown-theme__select--${variant}`);
  select.dataset.dropdownVariant = variant;
  if (!select.dataset.dropdownStyle || select.dataset.dropdownStyle !== "enhanced") {
    select.dataset.dropdownStyle = "enhanced";
  }
  return select;
};

export const initDropdownStyleObserver = (config = {}) => {
  if (typeof window === "undefined") return () => {};
  const selector = config.selector || DEFAULT_SELECTOR;
  const variant = config.variant || DEFAULT_VARIANT;
  const applyVariant = (element) => applyDropdownTheme(element, { variant });

  const seed = Array.from(document.querySelectorAll(selector));
  seed.forEach(applyVariant);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLSelectElement) {
          if (node.matches(selector)) applyVariant(node);
        } else if (node instanceof HTMLElement) {
          const nested = node.querySelectorAll(selector);
          nested.forEach(applyVariant);
        }
      });
      if (mutation.type === "attributes" && mutation.target instanceof HTMLSelectElement) {
        const target = mutation.target;
        if (target.matches(selector)) {
          applyVariant(target);
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-dropdown-variant", "data-dropdown-style"],
  });

  window.__dropdownStyleObserver = observer;
  window.DropdownStyleAPI = {
    apply: applyDropdownTheme,
    initDropdownStyleObserver,
  };

  return () => {
    observer.disconnect();
    if (window.__dropdownStyleObserver === observer) {
      delete window.__dropdownStyleObserver;
    }
  };
};
