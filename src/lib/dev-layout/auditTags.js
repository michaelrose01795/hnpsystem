// file location: src/lib/dev-layout/auditTags.js
//
// localStorage-backed store for UI-audit classification tags. Each tag
// describes how a given element on a given route should be classified —
// which UI family it belongs to, which approved variant it uses, whether
// it is standards-compliant, and any free-text reviewer notes.
//
// Tags are keyed by a stable element signature (see buildAuditKey) that
// survives minor DOM reshuffles: route + stable section key (if present)
// + DOM path + text hash. The goal is to re-find the same element across
// reloads without requiring stable IDs on every DOM node.
//
// Storage shape (JSON in STORAGE_KEY):
//   {
//     "<route>|<signature>": {
//       family: "button",
//       variant: "primary",
//       status: "approved" | "needs-review" | "custom-only" | "hardcoded",
//       notes: "free text",
//       updatedAt: 1711234567890,
//     },
//     ...
//   }

const STORAGE_KEY = "hnp-ui-audit-tags";

const isBrowser = () => typeof window !== "undefined";

const readAll = () => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeAll = (data) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota or privacy-mode — silently drop
  }
};

// Short, stable hash of a string — enough to disambiguate siblings without
// exposing anything from the content in logs.
const hashString = (input) => {
  const str = String(input || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
};

// Build a stable path from a DOM node. Prefers stable keys when present,
// falls back to tag + class + nth-of-type descriptors. Stops at the nearest
// registered dev-section-key (or document body, whichever is first).
const buildDomPath = (node) => {
  if (!node || typeof node !== "object") return "";
  const parts = [];
  let current = node;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 8) {
    const tag = String(current.tagName || "").toLowerCase();
    const sectionKey = current.getAttribute?.("data-dev-section-key");
    if (sectionKey) {
      parts.unshift(`#${sectionKey}`);
      break;
    }
    const id = current.id ? `#${current.id}` : "";
    const cls = String(current.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    const parent = current.parentElement;
    let nth = "";
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === current.tagName
      );
      if (siblings.length > 1) {
        nth = `:nth(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(`${tag}${id}${cls ? `.${cls}` : ""}${nth}`);
    current = parent;
    depth += 1;
  }
  return parts.join(" > ");
};

export const buildAuditKey = ({ route, node }) => {
  if (!node) return "";
  const path = buildDomPath(node);
  const text = String(node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const signature = `${path}::${hashString(text)}`;
  return `${route || ""}|${signature}`;
};

export const getAuditTag = (key) => {
  if (!key) return null;
  const all = readAll();
  return all[key] || null;
};

export const setAuditTag = (key, patch) => {
  if (!key) return null;
  const all = readAll();
  const current = all[key] || {};
  const next = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  all[key] = next;
  writeAll(all);
  return next;
};

export const clearAuditTag = (key) => {
  if (!key) return;
  const all = readAll();
  if (all[key]) {
    delete all[key];
    writeAll(all);
  }
};

export const getAllAuditTags = () => readAll();

export const getAuditTagsForRoute = (route) => {
  if (!route) return {};
  const all = readAll();
  const prefix = `${route}|`;
  return Object.keys(all).reduce((acc, key) => {
    if (key.startsWith(prefix)) acc[key] = all[key];
    return acc;
  }, {});
};

export const exportAuditTagsJson = () => {
  const all = readAll();
  return JSON.stringify(all, null, 2);
};
