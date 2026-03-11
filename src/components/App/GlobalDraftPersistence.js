import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

const STORAGE_PREFIX = "hnp:drafts:v1:";
const DRAFTABLE_SELECTOR = "input, textarea, select, [contenteditable]";

const buildStorageKey = (routeKey = "") => `${STORAGE_PREFIX}${routeKey}`;

const getRouteKey = (router) => {
  const asPath = router?.asPath || "";
  const [path] = asPath.split("#");
  return path || "/";
};

const isDraftableElement = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest("[data-draft-ignore='true']")) return false;
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "").toLowerCase();
    if (
      type === "password" ||
      type === "file" ||
      type === "hidden" ||
      type === "submit" ||
      type === "button" ||
      type === "reset"
    ) {
      return false;
    }
  }
  if (element.hasAttribute("disabled")) return false;
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element.isContentEditable
  );
};

const isLikelyAppApiUrl = (url) => {
  try {
    if (!url) return false;
    const parsed = new URL(String(url), window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/");
  } catch (_error) {
    return false;
  }
};

const getElementDomPathKey = (element) => {
  if (!(element instanceof HTMLElement)) return null;
  const segments = [];
  let current = element;
  while (current && current !== document.body && segments.length < 8) {
    const parent = current.parentElement;
    if (!parent) break;
    const tag = current.tagName.toLowerCase();
    const siblingIndex = Array.from(parent.children)
      .filter((node) => node.tagName === current.tagName)
      .indexOf(current);
    segments.push(`${tag}:${siblingIndex}`);
    current = parent;
  }
  if (!segments.length) return null;
  return `path:${segments.reverse().join(">")}`;
};

const getElementKey = (element) => {
  if (!(element instanceof HTMLElement)) return null;

  const explicitKey = element.getAttribute("data-draft-key");
  if (explicitKey) return `data:${explicitKey}`;

  if (element.id) return `id:${element.id}`;

  if ("name" in element && element.name) {
    if (
      element instanceof HTMLInputElement &&
      (element.type === "radio" || element.type === "checkbox")
    ) {
      return `name:${element.name}:${element.value || "value"}`;
    }
    return `name:${element.name}`;
  }

  return getElementDomPathKey(element);
};

const readElementValue = (element) => {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return { kind: "checked", value: element.checked };
    }
    return { kind: "value", value: element.value };
  }

  if (element instanceof HTMLTextAreaElement) {
    return { kind: "value", value: element.value };
  }

  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      return {
        kind: "multi",
        value: Array.from(element.selectedOptions).map((option) => option.value),
      };
    }
    return { kind: "value", value: element.value };
  }

  if (element.isContentEditable) {
    return { kind: "html", value: element.innerHTML };
  }

  return null;
};

const applyElementValue = (element, entry) => {
  if (!entry || typeof entry !== "object") return;

  if (element instanceof HTMLInputElement) {
    const type = (element.type || "").toLowerCase();
    if ((type === "checkbox" || type === "radio") && entry.kind === "checked") {
      element.checked = Boolean(entry.value);
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (entry.kind === "value") {
      element.value = String(entry.value ?? "");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return;
  }

  if (element instanceof HTMLTextAreaElement && entry.kind === "value") {
    element.value = String(entry.value ?? "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  if (element instanceof HTMLSelectElement) {
    if (entry.kind === "multi" && Array.isArray(entry.value)) {
      const selected = new Set(entry.value.map((value) => String(value)));
      Array.from(element.options).forEach((option) => {
        option.selected = selected.has(option.value);
      });
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (entry.kind === "value") {
      element.value = String(entry.value ?? "");
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }

  if (element.isContentEditable && entry.kind === "html") {
    element.innerHTML = String(entry.value ?? "");
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const collectRouteDraftSnapshot = () => {
  const entries = {};
  const controls = document.querySelectorAll(DRAFTABLE_SELECTOR);
  controls.forEach((node) => {
    const element = node;
    if (!isDraftableElement(element)) return;
    const key = getElementKey(element);
    if (!key) return;
    const payload = readElementValue(element);
    if (!payload) return;
    entries[key] = payload;
  });
  return entries;
};

const persistRouteDraftSnapshot = (routeKey) => {
  const key = buildStorageKey(routeKey);
  const payload = {
    updatedAt: Date.now(),
    values: collectRouteDraftSnapshot(),
  };
  localStorage.setItem(key, JSON.stringify(payload));
};

const restoreRouteDraftSnapshot = (routeKey) => {
  const key = buildStorageKey(routeKey);
  const raw = localStorage.getItem(key);
  if (!raw) return;

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    return;
  }

  const values = parsed?.values;
  if (!values || typeof values !== "object") return;

  const controls = document.querySelectorAll(DRAFTABLE_SELECTOR);
  let restoredCount = 0;
  controls.forEach((node) => {
    const element = node;
    if (!isDraftableElement(element)) return;
    const elementKey = getElementKey(element);
    if (!elementKey) return;
    if (!(elementKey in values)) return;
    applyElementValue(element, values[elementKey]);
    restoredCount += 1;
  });
  return restoredCount;
};

export default function GlobalDraftPersistence() {
  const router = useRouter();
  const saveTimeoutRef = useRef(null);
  const restoreTimerRef = useRef(null);
  const restoreObserverRef = useRef(null);
  const fetchRestoreRef = useRef(null);
  const lastInputAtRef = useRef(0);
  const pendingSubmitRouteRef = useRef(null);
  const pendingSubmitUntilRef = useRef(0);
  const routeKeyRef = useRef("/");

  useEffect(() => {
    routeKeyRef.current = getRouteKey(router);
  }, [router]);

  useEffect(() => {
    const routeKey = getRouteKey(router);
    routeKeyRef.current = routeKey;

    const runRestore = () => {
      restoreRouteDraftSnapshot(routeKeyRef.current);
    };
    runRestore();

    // Some pages render form fields after async data/loaders.
    // Retry restore for a short window so late-mount controls also recover draft text.
    let restoreAttempts = 0;
    restoreTimerRef.current = setInterval(() => {
      restoreAttempts += 1;
      runRestore();
      if (restoreAttempts >= 12) {
        clearInterval(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
    }, 400);

    const observer = new MutationObserver((mutations) => {
      const hasPotentialDraftableNode = mutations.some((mutation) =>
        Array.from(mutation.addedNodes || []).some((addedNode) => {
          if (!(addedNode instanceof Element)) return false;
          if (addedNode.matches?.(DRAFTABLE_SELECTOR)) return true;
          return Boolean(addedNode.querySelector?.(DRAFTABLE_SELECTOR));
        })
      );
      if (hasPotentialDraftableNode) {
        runRestore();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    restoreObserverRef.current = observer;

    const queueSave = () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        persistRouteDraftSnapshot(routeKeyRef.current);
      }, 180);
    };

    const handleInput = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!isDraftableElement(target)) return;
      lastInputAtRef.current = Date.now();
      queueSave();
    };

    const handleFormSubmit = () => {
      pendingSubmitRouteRef.current = routeKeyRef.current;
      pendingSubmitUntilRef.current = Date.now() + 15000;
      persistRouteDraftSnapshot(routeKeyRef.current);
    };

    const handleBeforeUnload = () => {
      persistRouteDraftSnapshot(routeKeyRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persistRouteDraftSnapshot(routeKeyRef.current);
      }
    };

    const clearRouteDraft = (event) => {
      const detailRoute = event?.detail?.routeKey;
      const targetRoute = detailRoute || routeKeyRef.current;
      localStorage.removeItem(buildStorageKey(targetRoute));
    };

    if (typeof window !== "undefined" && !fetchRestoreRef.current) {
      const originalFetch = window.fetch.bind(window);
      const wrappedFetch = async (...args) => {
        const [resource, init] = args;
        const method = String(init?.method || "GET").toUpperCase();
        const isMutation = method !== "GET" && method !== "HEAD";
        const url = typeof resource === "string" ? resource : resource?.url;
        const relevantApiCall = isMutation && isLikelyAppApiUrl(url);
        const routeAtCall = routeKeyRef.current;
        let response;
        try {
          response = await originalFetch(...args);
        } catch (error) {
          throw error;
        }

        const withinSubmitWindow = Date.now() <= pendingSubmitUntilRef.current;
        const matchingRoute = pendingSubmitRouteRef.current === routeAtCall;
        const userStoppedTyping = Date.now() - lastInputAtRef.current > 900;
        if (relevantApiCall && response?.ok && withinSubmitWindow && matchingRoute && userStoppedTyping) {
          localStorage.removeItem(buildStorageKey(routeAtCall));
          pendingSubmitRouteRef.current = null;
          pendingSubmitUntilRef.current = 0;
        }
        return response;
      };

      window.fetch = wrappedFetch;
      fetchRestoreRef.current = originalFetch;
    }

    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    document.addEventListener("submit", handleFormSubmit, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("app:drafts:clear-route", clearRouteDraft);
    router.events?.on("routeChangeStart", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      if (restoreTimerRef.current) {
        clearInterval(restoreTimerRef.current);
        restoreTimerRef.current = null;
      }
      if (restoreObserverRef.current) {
        restoreObserverRef.current.disconnect();
        restoreObserverRef.current = null;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
      document.removeEventListener("submit", handleFormSubmit, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("app:drafts:clear-route", clearRouteDraft);
      router.events?.off("routeChangeStart", handleBeforeUnload);
    };
  }, [router.asPath, router.events]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && fetchRestoreRef.current) {
        window.fetch = fetchRestoreRef.current;
        fetchRestoreRef.current = null;
      }
    };
  }, []);

  return null;
}
