import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptWorkProfileData } from "@/lib/profile/personalFinance";
import {
  buildDefaultWidgetConfig,
  ensureWidgetDataDefaults,
  getNextWidgetPlacement,
  normaliseWidgetRecord,
  sanitiseWidgetLayout,
  sortWidgetsForDisplay,
} from "@/lib/profile/personalWidgets";

const UNLOCK_STORAGE_KEY = "hnp-personal-unlocked";
const DASHBOARD_CACHE_KEY = "hnp-personal-dashboard-cache-v3";
const SAVE_DEBOUNCE_MS = 500;

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const error = new Error(payload?.message || `Request failed with status ${response.status}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload?.data;
}

function sortWidgets(widgets = []) {
  return [...widgets].sort(
    (a, b) =>
      Number(a?.positionY ?? 0) - Number(b?.positionY ?? 0) ||
      Number(a?.positionX ?? 0) - Number(b?.positionX ?? 0)
  );
}

// --- Session cache ---

function readCachedState() {
  if (typeof window === "undefined") return null;
  try {
    if (window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) !== "1") return null;
    const raw = window.sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.cacheVersion !== 1 || !parsed.personalState) return null;
    return { personalState: parsed.personalState, workProfile: parsed.workProfile || null };
  } catch (_error) {
    return null;
  }
}

function writeCachedState(personalState, workProfile) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({ cacheVersion: 1, savedAt: Date.now(), personalState, workProfile })
    );
  } catch (_error) {
    // Ignore cache write failures.
  }
}

function clearCachedState() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch (_error) {
    // Ignore cache clear failures.
  }
}

function removeById(list = [], id) {
  if (!id) return list;
  return list.filter((entry) => String(entry?.id) !== String(id));
}

// ============================================================
// Main hook
// ============================================================

export default function usePersonalDashboard({ enabled = true } = {}) {
  const cached = readCachedState();

  // Core state: the full personal state blob from the server
  const [personalState, setPersonalState] = useState(cached?.personalState || null);
  const [workProfile, setWorkProfile] = useState(cached?.workProfile || null);
  const [meta, setMeta] = useState(() => ({
    isInitialising: enabled && !cached,
    isLoading: enabled && Boolean(cached),
    isSetup: Boolean(cached),
    isUnlocked: Boolean(cached),
    error: null,
  }));

  // --- Save management ---
  const personalStateRef = useRef(personalState);
  const saveTimerRef = useRef(null);
  const hasPendingRef = useRef(false);
  const isSavingRef = useRef(false);
  const skipNextSaveRef = useRef(true); // skip save on initial load

  useEffect(() => {
    personalStateRef.current = personalState;
  }, [personalState]);

  // --- Request helpers ---

  const requestJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    return parseJsonResponse(response);
  }, []);

  const requestMultipart = useCallback(async (url, formData) => {
    const response = await fetch(url, { method: "POST", credentials: "include", body: formData });
    return parseJsonResponse(response);
  }, []);

  // --- Save to server ---

  const saveToServer = useCallback(async () => {
    const state = personalStateRef.current;
    if (!state || isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await requestJson("/api/personal/state", {
        method: "PUT",
        body: JSON.stringify({ state }),
      });
      hasPendingRef.current = false;
    } catch (_error) {
      // Will retry on next state change.
    } finally {
      isSavingRef.current = false;
    }
  }, [requestJson]);

  // Debounced save: every time personalState changes (and we're unlocked),
  // schedule a save. Skip the very first update (which is the server load).
  useEffect(() => {
    if (!personalState || !meta.isUnlocked) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    hasPendingRef.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveToServer();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [personalState, meta.isUnlocked, saveToServer]);

  // beforeunload: warn user if there are unsaved changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e) => {
      if (hasPendingRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Unmount: best-effort save via sendBeacon (POST to /api/personal/state)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (hasPendingRef.current && personalStateRef.current) {
        try {
          const blob = new Blob(
            [JSON.stringify({ state: personalStateRef.current })],
            { type: "application/json" }
          );
          navigator.sendBeacon("/api/personal/state", blob);
        } catch (_error) {
          // Best-effort only.
        }
      }
    };
  }, []);

  // Flush: cancel timer and save immediately
  const flush = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (hasPendingRef.current) {
      await saveToServer();
    }
  }, [saveToServer]);

  // --- Refresh from server ---

  const refreshDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!enabled) {
        setMeta((current) => ({ ...current, isInitialising: false, isLoading: false }));
        return;
      }
      if (!silent) {
        setMeta((current) => ({ ...current, isLoading: true, error: null }));
      }
      try {
        const security = await requestJson("/api/personal/security", { method: "GET" });

        if (!security?.isSetup || !security?.isUnlocked) {
          clearCachedState();
          startTransition(() => {
            setPersonalState(null);
            setMeta({
              isInitialising: false,
              isLoading: false,
              isSetup: Boolean(security?.isSetup),
              isUnlocked: Boolean(security?.isUnlocked),
              error: null,
            });
          });
          return;
        }

        const [serverState, serverWorkProfile] = await Promise.all([
          requestJson("/api/personal/state", { method: "GET" }),
          requestJson("/api/profile/me", { method: "GET" }).catch(() => null),
        ]);

        skipNextSaveRef.current = true;
        startTransition(() => {
          setPersonalState(serverState || null);
          setWorkProfile(serverWorkProfile || null);
          setMeta({
            isInitialising: false,
            isLoading: false,
            isSetup: true,
            isUnlocked: true,
            error: null,
          });
        });
      } catch (error) {
        const isLocked = error?.statusCode === 423 || error?.statusCode === 428;
        if (isLocked) clearCachedState();
        startTransition(() => {
          if (isLocked) setPersonalState(null);
          setMeta((current) => ({
            ...current,
            isInitialising: false,
            isLoading: false,
            error,
            isUnlocked: isLocked ? false : current.isUnlocked,
          }));
        });
      }
    },
    [enabled, requestJson]
  );

  // Initial load
  useEffect(() => {
    void refreshDashboard({ silent: Boolean(cached) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshDashboard]);

  // Focus / visibility: flush pending changes then refresh
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onVisibilityOrFocus = async () => {
      if (document.visibilityState === "visible") {
        await flush();
        void refreshDashboard({ silent: true });
      }
    };
    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, [enabled, flush, refreshDashboard]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onStaffVehiclePayrollUpdated = () => {
      void refreshDashboard({ silent: true });
    };
    window.addEventListener("staff-vehicle-payroll-updated", onStaffVehiclePayrollUpdated);
    return () => {
      window.removeEventListener("staff-vehicle-payroll-updated", onStaffVehiclePayrollUpdated);
    };
  }, [enabled, refreshDashboard]);

  // Session cache: write whenever unlocked state changes
  useEffect(() => {
    if (!meta.isUnlocked || !personalState) return;
    writeCachedState(personalState, workProfile);
  }, [meta.isUnlocked, personalState, workProfile]);

  // ============================================================
  // Core state updater — every mutation flows through here
  // ============================================================

  const updateState = useCallback((updater) => {
    setPersonalState((current) => {
      if (!current) return current;
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  // ============================================================
  // Derived views
  // ============================================================

  const widgets = useMemo(
    () => sortWidgets(personalState?.widgets || []),
    [personalState?.widgets]
  );

  const widgetDataMap = useMemo(() => {
    const raw = personalState?.widgetData || {};
    return ensureWidgetDataDefaults(
      (personalState?.widgets || []).map((w) => w.widgetType),
      raw
    );
  }, [personalState?.widgetData, personalState?.widgets]);

  const workData = useMemo(
    () => adaptWorkProfileData(workProfile || {}),
    [workProfile]
  );

  const transactions = personalState?.collections?.transactions || [];
  const bills = personalState?.collections?.bills || [];
  const savings = personalState?.collections?.savings || null;
  const goals = personalState?.collections?.goals || [];
  const notes = personalState?.collections?.notes || [];
  const attachments = personalState?.collections?.attachments || [];
  const financeState = personalState?.financeState || null;

  // ============================================================
  // Auth (these still use the security API endpoint)
  // ============================================================

  const setupPasscode = useCallback(
    async ({ passcode, confirmPasscode }) => {
      const security = await requestJson("/api/personal/security", {
        method: "POST",
        body: JSON.stringify({ action: "setup", passcode, confirmPasscode }),
      });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      if (security?.isUnlocked) {
        skipNextSaveRef.current = true;
        startTransition(() => {
          setPersonalState(security.personalState || null);
          setMeta((current) => ({
            ...current,
            isInitialising: false,
            isLoading: false,
            isSetup: true,
            isUnlocked: true,
            error: null,
          }));
        });
      }
      const nextWorkProfile = await requestJson("/api/profile/me", { method: "GET" }).catch(() => null);
      if (nextWorkProfile) {
        startTransition(() => {
          setWorkProfile(nextWorkProfile);
        });
      }
    },
    [requestJson]
  );

  const unlock = useCallback(
    async ({ passcode }) => {
      const security = await requestJson("/api/personal/security", {
        method: "POST",
        body: JSON.stringify({ action: "unlock", passcode }),
      });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      if (security?.isUnlocked) {
        skipNextSaveRef.current = true;
        startTransition(() => {
          setPersonalState(security.personalState || null);
          setMeta((current) => ({
            ...current,
            isInitialising: false,
            isLoading: false,
            isSetup: true,
            isUnlocked: true,
            error: null,
          }));
        });
      }
      const nextWorkProfile = await requestJson("/api/profile/me", { method: "GET" }).catch(() => null);
      if (nextWorkProfile) {
        startTransition(() => {
          setWorkProfile(nextWorkProfile);
        });
      }
    },
    [requestJson]
  );

  const lock = useCallback(async () => {
    await flush();
    await requestJson("/api/personal/security", {
      method: "POST",
      body: JSON.stringify({ action: "lock" }),
    });
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    clearCachedState();
    skipNextSaveRef.current = true;
    setPersonalState(null);
    setMeta((current) => ({ ...current, isSetup: true, isUnlocked: false }));
  }, [flush, requestJson]);

  const resetPasscode = useCallback(async () => {
    await flush();
    await requestJson("/api/personal/security", {
      method: "POST",
      body: JSON.stringify({ action: "reset" }),
    });
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    clearCachedState();
    skipNextSaveRef.current = true;
    setPersonalState(null);
    setMeta((current) => ({ ...current, isSetup: false, isUnlocked: false }));
  }, [flush, requestJson]);

  // ============================================================
  // Widget mutations (all update local state only — debounce saves)
  // ============================================================

  const addWidget = useCallback(
    (widgetType) => {
      updateState((current) => {
        const currentWidgets = current.widgets || [];
        const existing = currentWidgets.find((w) => w.widgetType === widgetType);
        const allowMultiple = widgetType === "custom";

        if (!allowMultiple && existing?.id && existing.isVisible !== false) {
          return current;
        }

        let nextWidgets;
        if (!allowMultiple && existing?.id) {
          const placement = getNextWidgetPlacement(currentWidgets);
          nextWidgets = currentWidgets.map((w) =>
            w.id === existing.id ? { ...w, isVisible: true, ...placement } : w
          );
        } else {
          const placement = getNextWidgetPlacement(currentWidgets);
          const customCount = currentWidgets.filter((w) => w.widgetType === "custom").length;
          const newWidget = normaliseWidgetRecord({
            id: generateId(),
            widget_type: widgetType,
            is_visible: true,
            position_x: placement.positionX,
            position_y: placement.positionY,
            width: placement.width,
            height: placement.height,
            config_json:
              widgetType === "custom"
                ? { ...buildDefaultWidgetConfig(widgetType), title: `Custom widget ${customCount + 1}` }
                : buildDefaultWidgetConfig(widgetType),
            updated_at: new Date().toISOString(),
          });
          nextWidgets = [...currentWidgets, newWidget];
        }

        return { ...current, widgets: sortWidgetsForDisplay(sanitiseWidgetLayout(nextWidgets)) };
      });
    },
    [updateState]
  );

  const removeWidget = useCallback(
    (id) => {
      updateState((current) => ({
        ...current,
        widgets: (current.widgets || []).map((w) =>
          String(w.id) === String(id) ? { ...w, isVisible: false } : w
        ),
      }));
    },
    [updateState]
  );

  const updateWidget = useCallback(
    (id, changes) => {
      updateState((current) => ({
        ...current,
        widgets: (current.widgets || []).map((w) =>
          String(w.id) === String(id)
            ? normaliseWidgetRecord({ ...w, ...changes, updatedAt: new Date().toISOString() })
            : w
        ),
      }));
    },
    [updateState]
  );

  const saveWidgets = useCallback(
    (nextWidgets) => {
      updateState((current) => ({
        ...current,
        widgets: sortWidgetsForDisplay(
          sanitiseWidgetLayout(nextWidgets.map((w, i) => normaliseWidgetRecord(w, i)))
        ),
      }));
    },
    [updateState]
  );

  // ============================================================
  // Widget data mutations
  // ============================================================

  const saveWidgetData = useCallback(
    (widgetType, data) => {
      updateState((current) => ({
        ...current,
        widgetData: {
          ...(current.widgetData || {}),
          [widgetType]: {
            ...(current.widgetData?.[widgetType] || {}),
            widgetType,
            data: data && typeof data === "object" ? data : {},
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },
    [updateState]
  );

  // ============================================================
  // Finance state mutation
  // ============================================================

  const updateFinanceState = useCallback(
    (updater) => {
      updateState((current) => ({
        ...current,
        financeState: typeof updater === "function" ? updater(current.financeState) : updater,
      }));
    },
    [updateState]
  );

  // ============================================================
  // Collection mutations
  // ============================================================

  const updateCollections = useCallback(
    (updater) => {
      updateState((current) => ({
        ...current,
        collections: typeof updater === "function" ? updater(current.collections || {}) : updater,
      }));
    },
    [updateState]
  );

  const createTransaction = useCallback(
    (payload) => {
      const item = {
        id: generateId(),
        type: "expense",
        category: "General",
        amount: 0,
        date: new Date().toISOString().split("T")[0],
        isRecurring: false,
        notes: "",
        ...payload,
      };
      updateCollections((c) => ({ ...c, transactions: [item, ...(c.transactions || [])] }));
      return item;
    },
    [updateCollections]
  );

  const updateTransaction = useCallback(
    (payload) => {
      if (!payload?.id) return;
      updateCollections((c) => ({
        ...c,
        transactions: (c.transactions || []).map((t) =>
          String(t.id) === String(payload.id) ? { ...t, ...payload } : t
        ),
      }));
    },
    [updateCollections]
  );

  const deleteTransaction = useCallback(
    (id) => {
      updateCollections((c) => ({ ...c, transactions: removeById(c.transactions, id) }));
    },
    [updateCollections]
  );

  const createBill = useCallback(
    (payload) => {
      const item = {
        id: generateId(),
        name: "Bill",
        amount: 0,
        dueDay: 1,
        isRecurring: true,
        ...payload,
      };
      updateCollections((c) => ({ ...c, bills: [...(c.bills || []), item] }));
      return item;
    },
    [updateCollections]
  );

  const updateBill = useCallback(
    (payload) => {
      if (!payload?.id) return;
      updateCollections((c) => ({
        ...c,
        bills: (c.bills || []).map((b) =>
          String(b.id) === String(payload.id) ? { ...b, ...payload } : b
        ),
      }));
    },
    [updateCollections]
  );

  const deleteBill = useCallback(
    (id) => {
      updateCollections((c) => ({ ...c, bills: removeById(c.bills, id) }));
    },
    [updateCollections]
  );

  const saveSavings = useCallback(
    (payload) => {
      updateCollections((c) => ({ ...c, savings: { ...(c.savings || {}), ...payload } }));
    },
    [updateCollections]
  );

  const clearSavings = useCallback(() => {
    updateCollections((c) => ({ ...c, savings: null }));
  }, [updateCollections]);

  const createGoal = useCallback(
    (payload) => {
      const item = { id: generateId(), type: "custom", target: 0, current: 0, deadline: null, ...payload };
      updateCollections((c) => ({ ...c, goals: [...(c.goals || []), item] }));
      return item;
    },
    [updateCollections]
  );

  const updateGoal = useCallback(
    (payload) => {
      if (!payload?.id) return;
      updateCollections((c) => ({
        ...c,
        goals: (c.goals || []).map((g) =>
          String(g.id) === String(payload.id) ? { ...g, ...payload } : g
        ),
      }));
    },
    [updateCollections]
  );

  const deleteGoal = useCallback(
    (id) => {
      updateCollections((c) => ({ ...c, goals: removeById(c.goals, id) }));
    },
    [updateCollections]
  );

  const createNote = useCallback(
    (payload) => {
      const item = { id: generateId(), content: "", createdAt: new Date().toISOString(), ...payload };
      updateCollections((c) => ({ ...c, notes: [item, ...(c.notes || [])] }));
      return item;
    },
    [updateCollections]
  );

  const updateNote = useCallback(
    (payload) => {
      if (!payload?.id) return;
      updateCollections((c) => ({
        ...c,
        notes: (c.notes || []).map((n) =>
          String(n.id) === String(payload.id)
            ? { ...n, ...payload, updatedAt: new Date().toISOString() }
            : n
        ),
      }));
    },
    [updateCollections]
  );

  const deleteNote = useCallback(
    (id) => {
      updateCollections((c) => ({ ...c, notes: removeById(c.notes, id) }));
    },
    [updateCollections]
  );

  // ============================================================
  // File operations (still use server endpoints for file I/O)
  // Flush pending state first to avoid race conditions, then
  // let the endpoint update the state blob, then refresh.
  // ============================================================

  const uploadAttachment = useCallback(
    async (file) => {
      await flush();
      const formData = new FormData();
      formData.append("file", file);
      const data = await requestMultipart("/api/personal/upload", formData);
      skipNextSaveRef.current = true;
      await refreshDashboard({ silent: true });
      return data;
    },
    [flush, requestMultipart, refreshDashboard]
  );

  const deleteAttachment = useCallback(
    async (id) => {
      await flush();
      await requestJson("/api/personal/attachments", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      skipNextSaveRef.current = true;
      await refreshDashboard({ silent: true });
    },
    [flush, requestJson, refreshDashboard]
  );

  // ============================================================
  // Return
  // ============================================================

  return {
    isInitialising: meta.isInitialising,
    isLoading: meta.isLoading,
    isSetup: meta.isSetup,
    isUnlocked: meta.isUnlocked,
    error: meta.error,

    widgets,
    widgetDataMap,
    workData,
    transactions,
    bills,
    savings,
    goals,
    notes,
    attachments,
    financeState,

    refreshDashboard,
    flush,

    setupPasscode,
    unlock,
    lock,
    resetPasscode,

    addWidget,
    removeWidget,
    updateWidget,
    saveWidgets,
    saveWidgetData,

    updateFinanceState,

    createTransaction,
    updateTransaction,
    deleteTransaction,
    createBill,
    updateBill,
    deleteBill,
    saveSavings,
    clearSavings,
    createGoal,
    updateGoal,
    deleteGoal,
    createNote,
    updateNote,
    deleteNote,
    uploadAttachment,
    deleteAttachment,
  };
}
