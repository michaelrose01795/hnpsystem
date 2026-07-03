import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { showAlert, subscribeToAlerts } from "@/lib/notifications/alertBus";

const AlertContext = createContext({
  alerts: [],
  pushAlert: () => {},
  dismissAlert: () => {},
});

export function AlertProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  useEffect(() => {
    // Auto-dismiss timing now lives in the renderer (TopbarAlerts) so it can be
    // paused on hover/focus — see Phase 2, Frontend Feedback & Error System.
    // The context is purely the alert store: it appends and removes by id.
    const unsubscribe = subscribeToAlerts((alert) => {
      setAlerts((prev) => [...prev, alert]);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      alerts,
      dismissAlert,
      pushAlert: showAlert,
    }),
    [alerts, dismissAlert]
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export const useAlerts = () => useContext(AlertContext);
