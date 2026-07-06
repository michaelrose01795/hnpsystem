// file location: src/hooks/useReminders.js
//
// Personal reminders (Phase 3.6). A tiny per-user to-do list surfaced in the
// productivity panel — add a note, tick it off, remove it. Per-user, on-device,
// reactive across tabs (workspaceStorage). Disabled in the presentation shell.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import {
  buildKey,
  readJSON,
  writeJSON,
  removeKey,
  subscribe,
} from "@/lib/topbar/workspaceStorage";
import {
  buildReminder,
  normaliseReminders,
  sortReminders,
  countOutstanding,
} from "@/lib/topbar/reminders";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

const FEATURE = "reminders";
const MAX = WORKSPACE_LIMITS.reminders;

export function useReminders({ enabled = true } = {}) {
  const { user, dbUserId } = useUser() || {};
  const userId = dbUserId || user?.id || user?.username || null;
  const key = buildKey(FEATURE, userId);

  const [reminders, setReminders] = useState(() =>
    enabled ? normaliseReminders(readJSON(key, [])) : []
  );

  useEffect(() => {
    setReminders(enabled ? normaliseReminders(readJSON(key, [])) : []);
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe(key, (value) => setReminders(normaliseReminders(value)));
  }, [key, enabled]);

  const persist = useCallback(
    (next) => {
      const capped = next.slice(0, MAX);
      setReminders(capped);
      writeJSON(key, capped);
    },
    [key]
  );

  const addReminder = useCallback(
    (text) => {
      if (!enabled) return;
      const entry = buildReminder(text, Date.now(), reminders.length);
      if (!entry) return;
      persist([entry, ...reminders]);
    },
    [reminders, enabled, persist]
  );

  const toggleReminder = useCallback(
    (id) => {
      if (!enabled) return;
      persist(reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
    },
    [reminders, enabled, persist]
  );

  const removeReminder = useCallback(
    (id) => {
      if (!enabled) return;
      persist(reminders.filter((r) => r.id !== id));
    },
    [reminders, enabled, persist]
  );

  const clearDone = useCallback(() => {
    if (!enabled) return;
    persist(reminders.filter((r) => !r.done));
  }, [reminders, enabled, persist]);

  const clear = useCallback(() => {
    removeKey(key);
    setReminders([]);
  }, [key]);

  const sorted = useMemo(() => sortReminders(reminders), [reminders]);
  const outstanding = useMemo(() => countOutstanding(reminders), [reminders]);

  return {
    reminders: sorted,
    outstanding,
    addReminder,
    toggleReminder,
    removeReminder,
    clearDone,
    clear,
  };
}

export default useReminders;
