// file location: src/hooks/useWorkspacePreferences.js
//
// User-level workspace personalisation (Phase 3.7). Persists the small prefs blob
// (productivity-widget visibility + order, hidden quick actions) per user and
// exposes typed reducers. Reactive across tabs; disabled in the demo (defaults
// only, no writes).

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import {
  buildKey,
  readJSON,
  writeJSON,
  removeKey,
  subscribe,
} from "@/lib/topbar/workspaceStorage";
import {
  defaultPreferences,
  mergePreferences,
  setWidgetVisible,
  moveWidget,
  toggleQuickActionHidden,
} from "@/lib/topbar/workspacePreferences";

const FEATURE = "preferences";

export function useWorkspacePreferences({ enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [prefs, setPrefs] = useState(() =>
    enabled ? mergePreferences(readJSON(key, null)) : defaultPreferences()
  );

  useEffect(() => {
    setPrefs(enabled ? mergePreferences(readJSON(key, null)) : defaultPreferences());
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setPrefs(mergePreferences(value)));
  }, [key, enabled]);

  // Apply a pure reducer + persist. No-op (defaults only) when disabled.
  const apply = useCallback(
    (reducer) => {
      if (!enabled) return;
      setPrefs((current) => {
        const next = reducer(current);
        writeJSON(key, next);
        return next;
      });
    },
    [key, enabled]
  );

  const setWidget = useCallback(
    (widgetId, visible) => apply((p) => setWidgetVisible(p, widgetId, visible)),
    [apply]
  );
  const reorderWidget = useCallback(
    (widgetId, direction) => apply((p) => moveWidget(p, widgetId, direction)),
    [apply]
  );
  const toggleQuickAction = useCallback(
    (href) => apply((p) => toggleQuickActionHidden(p, href)),
    [apply]
  );
  const reset = useCallback(() => {
    if (!enabled) return;
    removeKey(key);
    setPrefs(defaultPreferences());
  }, [key, enabled]);

  return { prefs, setWidget, reorderWidget, toggleQuickAction, reset, canPersonalise: enabled };
}

export default useWorkspacePreferences;
