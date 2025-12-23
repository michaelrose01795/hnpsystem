const DEFAULT_SELECTOR = '[data-scrollbar-style]:not([data-scrollbar-style="native"])';
const DEFAULT_VARIANT = "glass";
const SCROLLBAR_CLASS = "scrollbar-theme";

const isElement = (target) =>
  target instanceof HTMLElement || target instanceof HTMLBodyElement || target instanceof HTMLHtmlElement;

const applyScrollbarTheme = (target = document.body, options = {}) => {
  if (typeof window === "undefined" || !isElement(target)) return null;
  if (target.dataset.scrollbarStyle === "native") return null;

  const variant = options.variant || target.dataset.scrollbarVariant || DEFAULT_VARIANT;
  target.classList.add(SCROLLBAR_CLASS, `${SCROLLBAR_CLASS}--${variant}`);
  target.dataset.scrollbarVariant = variant;

  if (!target.dataset.scrollbarStyle || target.dataset.scrollbarStyle !== "enhanced") {
    target.dataset.scrollbarStyle = "enhanced";
  }

  return target;
};

const initScrollbarStyleObserver = (config = {}) => {
  if (typeof window === "undefined") return () => {};
  const selector = config.selector || DEFAULT_SELECTOR;
  const variant = config.variant || DEFAULT_VARIANT;
  const trackedElements = new WeakSet();

  const applyVariant = (element) => {
    if (!isElement(element) || element.dataset.scrollbarStyle === "native") return;
    if (trackedElements.has(element) && element.dataset.scrollbarVariant === variant) return;
    applyScrollbarTheme(element, {
      variant: element.dataset.scrollbarVariant || variant,
    });
    trackedElements.add(element);
  };

  if (config.applyToDocument !== false) {
    applyVariant(document.documentElement);
    applyVariant(document.body);
  }

  const seed = Array.from(document.querySelectorAll(selector));
  seed.forEach(applyVariant);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!isElement(node) || node.dataset.scrollbarStyle === "native") return;
        if (node.matches?.(selector)) {
          applyVariant(node);
        }
        node.querySelectorAll?.(selector).forEach((child) => {
          applyVariant(child);
        });
      });

      if (
        mutation.type === "attributes" &&
        isElement(mutation.target) &&
        mutation.target.matches?.(selector)
      ) {
        applyVariant(mutation.target);
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-scrollbar-style", "data-scrollbar-variant"],
  });

  window.__scrollbarStyleObserver = observer;
  window.ScrollbarStyleAPI = {
    apply: applyScrollbarTheme,
    initScrollbarStyleObserver,
  };

  return () => {
    observer.disconnect();
    if (window.__scrollbarStyleObserver === observer) {
      delete window.__scrollbarStyleObserver;
    }
  };
};

export { applyScrollbarTheme, initScrollbarStyleObserver };
