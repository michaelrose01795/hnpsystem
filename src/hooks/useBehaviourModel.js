// file location: src/hooks/useBehaviourModel.js
//
// Behaviour learning (Phase 5.7). Records which pages the user actually opens —
// per-user, on-device (workspaceStorage), reactive across tabs, disabled in the
// presentation shell — and exposes the recency-weighted "you use this often" top
// actions that personalise the predictive recommendations (5.1) and the
// assistant. Fully resettable, so personalisation stays under the user's control.
//
// It reuses the SAME route signal Phase 3.2 records (the current asPath) — it adds
// no tracking of its own beyond a capped, decaying local count.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/context/UserContext";
import { buildKey, readJSON, writeJSON, removeKey, subscribe } from "@/lib/topbar/workspaceStorage";
import {
  emptyModel,
  normaliseModel,
  recordVisit,
  rankActions,
  trackedCount,
} from "@/config/topbar/behaviourModel";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const FEATURE = "behaviour";

function titleCase(segment) {
  return String(segment || "")
    .replace(/\[|\]/g, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// A readable label for a base path: prefer the matching navigation item's label,
// else a title-cased last segment.
function labelForPath(base, navByHref) {
  if (navByHref.has(base)) return navByHref.get(base);
  const segs = base.split("/").filter(Boolean);
  return titleCase(segs[segs.length - 1] || base);
}

// `record` (default true): when false the hook is READ-ONLY — it rehydrates and
// stays in sync with the shared store and still exposes `topActions`, but does not
// itself count the current visit. This lets a second consumer (e.g. the topbar's
// "most used pages" buttons) read the model that WorkspaceCommandCenter already
// records, without double-counting each navigation into the shared per-user store.
export function useBehaviourModel({ currentAsPath = "", navigationItems = [], enabled = true, record = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [model, setModel] = useState(() => (enabled ? normaliseModel(readJSON(key, null)) : emptyModel()));
  const lastPathRef = useRef(null);

  const navByHref = useMemo(() => {
    const map = new Map();
    for (const item of navigationItems || []) {
      if (item?.href) map.set(item.href, item.label || titleCase(item.href));
    }
    return map;
  }, [navigationItems]);

  // Rehydrate on user change; stay in sync across tabs.
  useEffect(() => {
    setModel(enabled ? normaliseModel(readJSON(key, null)) : emptyModel());
    lastPathRef.current = null;
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setModel(normaliseModel(value)));
  }, [key, enabled]);

  // Record the current page once per navigation (skip root + repeats). Skipped
  // entirely for read-only consumers (record: false).
  useEffect(() => {
    if (!enabled || !record) return;
    const base = (currentAsPath || "").split("?")[0].split("#")[0];
    if (!base || base === "/") return;
    if (base === lastPathRef.current) return;
    lastPathRef.current = base;

    setModel((current) => {
      const next = recordVisit(
        current,
        { href: base, label: labelForPath(base, navByHref), ts: Date.now() },
        { max: WORKSPACE_LIMITS.behaviourTracked, halfLifeMs: WORKSPACE_LIMITS.behaviourHalfLifeMs }
      );
      writeJSON(key, next);
      return next;
    });
  }, [currentAsPath, enabled, record, key, navByHref]);

  const reset = useCallback(() => {
    removeKey(key);
    setModel(emptyModel());
    lastPathRef.current = null;
  }, [key]);

  // Recency-weighted top actions. Recomputed on model change (now advances slowly,
  // so ranking is stable between renders).
  const topActions = useMemo(
    () =>
      rankActions(model, {
        now: Date.now(),
        halfLifeMs: WORKSPACE_LIMITS.behaviourHalfLifeMs,
        limit: WORKSPACE_LIMITS.behaviourTopActions,
      }),
    [model]
  );

  return {
    model,
    topActions,
    tracked: trackedCount(model),
    reset,
    canLearn: enabled,
  };
}

export default useBehaviourModel;
