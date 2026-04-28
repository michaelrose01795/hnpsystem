// file location: src/hooks/usePersonalLock.js
// Lightweight client hook around /api/personal/security used by the Profile
// Payslips card. Reuses the same passcode endpoints / cookie / sessionStorage
// flag as usePersonalDashboard so unlocking once unlocks everything for the
// session — the Payslips card never owns its own PIN.

import { useCallback, useEffect, useState } from "react";

const UNLOCK_STORAGE_KEY = "hnp-personal-unlocked";

async function postSecurity(action, payload = {}) {
  const response = await fetch("/api/personal/security", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success === false) {
    const error = new Error(json?.message || `Request failed with status ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return json?.data || null;
}

export default function usePersonalLock({ enabled = true } = {}) {
  const [state, setState] = useState(() => {
    const cachedUnlocked = typeof window !== "undefined" && window.sessionStorage.getItem(UNLOCK_STORAGE_KEY) === "1";
    return {
      isLoading: enabled,
      isSetup: cachedUnlocked,
      isUnlocked: cachedUnlocked,
      error: null,
    };
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const response = await fetch("/api/personal/security", {
        method: "GET",
        credentials: "include",
      });
      const json = await response.json().catch(() => null);
      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || `Request failed with status ${response.status}`);
      }
      const data = json?.data || {};
      if (typeof window !== "undefined") {
        if (data.isUnlocked) window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
        else window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
      }
      setState({
        isLoading: false,
        isSetup: Boolean(data.isSetup),
        isUnlocked: Boolean(data.isUnlocked),
        error: null,
      });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const unlock = useCallback(
    async ({ passcode }) => {
      await postSecurity("unlock", { passcode });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      setState((prev) => ({ ...prev, isLoading: false, isSetup: true, isUnlocked: true, error: null }));
    },
    []
  );

  const setupPasscode = useCallback(
    async ({ passcode, confirmPasscode }) => {
      await postSecurity("setup", { passcode, confirmPasscode });
      if (typeof window !== "undefined") window.sessionStorage.setItem(UNLOCK_STORAGE_KEY, "1");
      setState((prev) => ({ ...prev, isLoading: false, isSetup: true, isUnlocked: true, error: null }));
    },
    []
  );

  const lock = useCallback(async () => {
    await postSecurity("lock");
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    setState((prev) => ({ ...prev, isUnlocked: false }));
  }, []);

  const resetPasscode = useCallback(async () => {
    await postSecurity("reset");
    if (typeof window !== "undefined") window.sessionStorage.removeItem(UNLOCK_STORAGE_KEY);
    setState((prev) => ({ ...prev, isSetup: false, isUnlocked: false }));
  }, []);

  return {
    ...state,
    refresh,
    unlock,
    setupPasscode,
    lock,
    resetPasscode,
  };
}
