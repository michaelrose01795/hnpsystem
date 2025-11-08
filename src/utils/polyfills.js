// file location: src/utils/polyfills.js

/**
 * Safari < 15.4 (including many still-used iPads) does not expose `structuredClone`.
 * Next.js' router and other libraries rely on it, so client-side navigation breaks
 * as soon as those code paths execute. We provide a lightweight polyfill that
 * handles the plain objects, arrays, Maps/Sets, Dates, RegExps and typed arrays
 * our app passes through the router. This restores navigation on older browsers.
 */
(() => {
  if (typeof globalThis.structuredClone === "function") {
    return;
  }

  const clone = (value, seen = new WeakMap()) => {
    if (value === null || typeof value !== "object") {
      return value;
    }

    if (value instanceof Date) {
      return new Date(value.getTime());
    }

    if (value instanceof RegExp) {
      return new RegExp(value.source, value.flags);
    }

    if (value instanceof Map) {
      const next = new Map();
      value.forEach((v, k) => {
        next.set(clone(k, seen), clone(v, seen));
      });
      return next;
    }

    if (value instanceof Set) {
      const next = new Set();
      value.forEach((v) => next.add(clone(v, seen)));
      return next;
    }

    if (ArrayBuffer.isView(value)) {
      return value.slice(0);
    }

    if (value instanceof ArrayBuffer) {
      return value.slice(0);
    }

    if (seen.has(value)) {
      return seen.get(value);
    }

    const next = Array.isArray(value) ? [] : {};
    seen.set(value, next);

    Object.keys(value).forEach((key) => {
      next[key] = clone(value[key], seen);
    });

    return next;
  };

  globalThis.structuredClone = function structuredClonePolyfill(value) {
    return clone(value);
  };
})();
