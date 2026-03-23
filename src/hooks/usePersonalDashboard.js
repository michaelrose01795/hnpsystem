import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { adaptWorkProfileData } from "@/lib/profile/workDataAdapter";
import { ensureWidgetDataDefaults } from "@/lib/profile/personalWidgets";

const UNLOCK_STORAGE_KEY = "hnp-personal-unlocked";

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

function mapDashboardState(personalState = {}) {
  const widgets = Array.isArray(personalState.widgets) ? personalState.widgets : [];
  const widgetDataRows = Object.values(personalState.widgetData || {}).map((entry) => ({
    id: entry?.id || null,
    widgetType: entry?.widgetType,
    data: entry?.data || {},
    updatedAt: entry?.updatedAt || null,
  }));
  return {
    widgets,
    widgetDataRows,
    transactions: Array.isArray(personalState.collections?.transactions) ? personalState.collections.transactions : [],
    bills: Array.isArray(personalState.collections?.bills) ? personalState.collections.bills : [],
    savings: personalState.collections?.savings || null,
    goals: Array.isArray(personalState.collections?.goals) ? personalState.collections.goals : [],
    notes: Array.isArray(personalState.collections?.notes) ? personalState.collections.notes : [],
    attachments: Array.isArray(personalState.collections?.attachments) ? personalState.collections.attachments : [],
  };
}

export default function usePersonalDashboard({ enabled = true } = {}) {
  const [state, setState] = useState({
    isInitialising: true,
    isLoading: false,
    isSetup: false,
    isUnlocked: false,
    widgets: [],
    widgetDataRows: [],
    transactions: [],
    bills: [],
    savings: null,
    goals: [],
    notes: [],
    attachments: [],
    workProfile: null,
    error: null,
  });

  const requestJson = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    return parseJsonResponse(response);
  }, []);

  const requestMultipart = useCallback(async (url, formData) => {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return parseJsonResponse(response);
  }, []);

  const refreshDashboard = useCallback(async () => {
    if (!enabled) {
      setState((current) => ({ ...current, isInitialising: false, isLoading: false }));
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const security = await requestJson("/api/personal/security", { method: "GET" });

      if (!security?.isSetup || !security?.isUnlocked) {
        startTransition(() => {
          setState((current) => ({
            ...current,
            isInitialising: false,
            isLoading: false,
            isSetup: Boolean(security?.isSetup),
            isUnlocked: Boolean(security?.isUnlocked),
            widgets: [],
            widgetDataRows: [],
            transactions: [],
            bills: [],
            savings: null,
            goals: [],
            notes: [],
            attachments: [],
            workProfile: null,
            error: null,
          }));
        });
        return;
      }

      const [personalState, workProfile] = await Promise.all([
        requestJson("/api/personal/state", { method: "GET" }),
        requestJson("/api/profile/me", { method: "GET" }).catch(() => null),
      ]);

      const mapped = mapDashboardState(personalState);

      startTransition(() => {
        setState({
          isInitialising: false,
          isLoading: false,
          isSetup: true,
          isUnlocked: true,
          ...mapped,
          workProfile: workProfile || null,
          error: null,
        });
      });
    } catch (error) {
      startTransition(() => {
        setState((current) => ({
          ...current,
          isInitialising: false,
          isLoading: false,
          error,
          isUnlocked: error?.statusCode === 423 || error?.statusCode === 428 ? false : current.isUnlocked,
        }));
      });
    }
  }, [enabled, requestJson]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const widgetDataMap = useMemo(() => {
    const existingMap = state.widgetDataRows.reduce((accumulator, row) => {
      if (!row?.widgetType) return accumulator;
      accumulator[row.widgetType] = {
        id: row.id,
        widgetType: row.widgetType,
        data: row.data || {},
        updatedAt: row.updatedAt || null,
      };
      return accumulator;
    }, {});
    return ensureWidgetDataDefaults(
      state.widgets.map((widget) => widget.widgetType),
      existingMap
    );
  }, [state.widgetDataRows, state.widgets]);

  const workData = useMemo(() => adaptWorkProfileData(state.workProfile || {}), [state.workProfile]);

  const setupPasscode = useCallback(
    async ({ passcode, confirmPasscode }) => {
      await requestJson("/api/personal/security", {
        method: "POST",
        body: JSON.stringify({ action: "setup", passcode, confirmPasscode }),
      });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      await refreshDashboard();
    },
    [refreshDashboard, requestJson]
  );

  const unlock = useCallback(
    async ({ passcode }) => {
      await requestJson("/api/personal/security", {
        method: "POST",
        body: JSON.stringify({ action: "unlock", passcode }),
      });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      await refreshDashboard();
    },
    [refreshDashboard, requestJson]
  );

  const lock = useCallback(async () => {
    await requestJson("/api/personal/security", { method: "POST", body: JSON.stringify({ action: "lock" }) });
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    await refreshDashboard();
  }, [refreshDashboard, requestJson]);

  const resetPasscode = useCallback(async () => {
    await requestJson("/api/personal/security", { method: "POST", body: JSON.stringify({ action: "reset" }) });
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    await refreshDashboard();
  }, [refreshDashboard, requestJson]);

  const addWidget = useCallback(
    async (widgetType) => {
      const widget = await requestJson("/api/personal/widgets", { method: "POST", body: JSON.stringify({ widgetType }) });
      await refreshDashboard();
      return widget;
    },
    [refreshDashboard, requestJson]
  );

  const updateWidget = useCallback(
    async (id, changes) => {
      const widget = await requestJson("/api/personal/widgets", { method: "PATCH", body: JSON.stringify({ id, ...changes }) });
      await refreshDashboard();
      return widget;
    },
    [refreshDashboard, requestJson]
  );

  const saveWidgets = useCallback(
    async (widgets) => {
      const savedWidgets = await requestJson("/api/personal/widgets", { method: "PUT", body: JSON.stringify({ widgets }) });
      await refreshDashboard();
      return savedWidgets;
    },
    [refreshDashboard, requestJson]
  );

  const removeWidget = useCallback(
    async (id) => {
      await requestJson("/api/personal/widgets", { method: "DELETE", body: JSON.stringify({ id }) });
      await refreshDashboard();
    },
    [refreshDashboard, requestJson]
  );

  const saveWidgetData = useCallback(
    async (widgetType, data) => {
      const savedRow = await requestJson("/api/personal/widget-data", { method: "PUT", body: JSON.stringify({ widgetType, data }) });
      await refreshDashboard();
      return savedRow;
    },
    [refreshDashboard, requestJson]
  );

  const mutateCollection = useCallback(
    async ({ url, method, payload }) => {
      const data = await requestJson(url, { method, body: method === "GET" ? undefined : JSON.stringify(payload || {}) });
      await refreshDashboard();
      return data;
    },
    [refreshDashboard, requestJson]
  );

  const uploadAttachment = useCallback(
    async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      const data = await requestMultipart("/api/personal/upload", formData);
      await refreshDashboard();
      return data;
    },
    [refreshDashboard, requestMultipart]
  );

  return {
    ...state,
    widgetDataMap,
    workData,
    refreshDashboard,
    setupPasscode,
    unlock,
    lock,
    resetPasscode,
    addWidget,
    updateWidget,
    saveWidgets,
    removeWidget,
    saveWidgetData,
    uploadAttachment,
    createTransaction: (payload) => mutateCollection({ url: "/api/personal/transactions", method: "POST", payload }),
    updateTransaction: (payload) => mutateCollection({ url: "/api/personal/transactions", method: "PUT", payload }),
    deleteTransaction: (id) => mutateCollection({ url: "/api/personal/transactions", method: "DELETE", payload: { id } }),
    createBill: (payload) => mutateCollection({ url: "/api/personal/bills", method: "POST", payload }),
    updateBill: (payload) => mutateCollection({ url: "/api/personal/bills", method: "PUT", payload }),
    deleteBill: (id) => mutateCollection({ url: "/api/personal/bills", method: "DELETE", payload: { id } }),
    saveSavings: (payload) => mutateCollection({ url: "/api/personal/savings", method: "PUT", payload }),
    clearSavings: () => mutateCollection({ url: "/api/personal/savings", method: "DELETE", payload: {} }),
    createGoal: (payload) => mutateCollection({ url: "/api/personal/goals", method: "POST", payload }),
    updateGoal: (payload) => mutateCollection({ url: "/api/personal/goals", method: "PUT", payload }),
    deleteGoal: (id) => mutateCollection({ url: "/api/personal/goals", method: "DELETE", payload: { id } }),
    createNote: (payload) => mutateCollection({ url: "/api/personal/notes", method: "POST", payload }),
    updateNote: (payload) => mutateCollection({ url: "/api/personal/notes", method: "PUT", payload }),
    deleteNote: (id) => mutateCollection({ url: "/api/personal/notes", method: "DELETE", payload: { id } }),
    deleteAttachment: (id) => mutateCollection({ url: "/api/personal/attachments", method: "DELETE", payload: { id } }),
  };
}
