import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

const STORAGE_PREFIX = "hnp:drafts:v1:";

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

  return null;
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
  const controls = document.querySelectorAll("input, textarea, select, [contenteditable='true']");
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

  const controls = document.querySelectorAll("input, textarea, select, [contenteditable='true']");
  controls.forEach((node) => {
    const element = node;
    if (!isDraftableElement(element)) return;
    const elementKey = getElementKey(element);
    if (!elementKey) return;
    if (!(elementKey in values)) return;
    applyElementValue(element, values[elementKey]);
  });
};

export default function GlobalDraftPersistence() {
  const router = useRouter();
  const saveTimeoutRef = useRef(null);
  const routeKeyRef = useRef("/");

  useEffect(() => {
    routeKeyRef.current = getRouteKey(router);
  }, [router]);

  useEffect(() => {
    const routeKey = getRouteKey(router);
    routeKeyRef.current = routeKey;

    const restoreTimeout = setTimeout(() => {
      restoreRouteDraftSnapshot(routeKey);
    }, 0);

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
      queueSave();
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

    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("app:drafts:clear-route", clearRouteDraft);

    return () => {
      clearTimeout(restoreTimeout);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("app:drafts:clear-route", clearRouteDraft);
    };
  }, [router.asPath]);

  return null;
}
