import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { showAlert, subscribeToAlerts } from "@/lib/alertBus";

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
    const unsubscribe = subscribeToAlerts((alert) => {
      setAlerts((prev) => [...prev, alert]);
      if (alert.autoClose !== false && typeof window !== "undefined") {
        const duration = alert.duration || 5000;
        window.setTimeout(() => dismissAlert(alert.id), duration);
      }
    });
    return unsubscribe;
  }, [dismissAlert]);

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
