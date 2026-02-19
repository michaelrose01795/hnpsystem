// file location: src/hooks/usePolling.js
// Shared polling hook that respects browser tab visibility.
// Stops polling when the tab is hidden, immediately fetches when it becomes visible again.
import { useEffect, useRef } from "react";

export function usePolling(fetchFn, intervalMs = 30000, enabled = true) {
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    if (!enabled) return;

    let timerId = null;

    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const tick = () => {
      if (isVisible()) {
        fetchRef.current();
      }
    };

    const startPolling = () => {
      if (timerId) clearInterval(timerId);
      tick();
      timerId = setInterval(tick, intervalMs);
    };

    const stopPolling = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (isVisible()) {
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    if (isVisible()) {
      startPolling();
    }

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, enabled]);
}
