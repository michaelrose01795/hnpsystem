// ✅ Imports converted to use absolute alias "@/"
// file location: src/hooks/useHrData.js
import { useEffect, useState } from "react"; // React primitives for managing stateful hooks

export function useHrOperationsData() {
  const [state, setState] = useState({
    data: null, // aggregated HR payload returned from the API
    isLoading: true, // loading indicator for consumers
    error: null, // store any thrown error for debugging and UI messaging
  });

  useEffect(() => {
    let isMounted = true; // track component mount status to prevent state updates after unmount
    const controller = new AbortController(); // allow cancellation when component unmounts

    const load = async () => {
      try {
        const response = await fetch("/api/hr/operations", {
          signal: controller.signal,
          credentials: "include",
        }); // call aggregated HR endpoint

        if (!response.ok) {
          throw new Error(`Failed to load HR data (status ${response.status})`); // bubble HTTP errors for error boundary
        }

        const payload = await response.json(); // parse JSON body
        if (!payload?.success || !payload?.data) {
          throw new Error(payload?.message || "HR data payload malformed"); // ensure shape is as expected
        }

        if (!isMounted) return; // guard against state updates after unmount
        setState({ data: payload.data, isLoading: false, error: null }); // hydrate hook consumers with Supabase data
      } catch (error) {
        if (error.name === "AbortError") return; // ignore abort signals triggered on unmount
        if (!isMounted) return; // bail if component already unmounted
        setState({ data: null, isLoading: false, error });
      }
    };

    load(); // kick off data load immediately

    return () => {
      isMounted = false; // mark hook as unmounted
      controller.abort(); // cancel pending fetch to avoid unnecessary work
    };
  }, []);

  return state; // expose aggregated state to consumers
}

/**
 * Real attendance data hook backed by Supabase via /api/hr/attendance.
 */
export function useHrAttendanceData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/attendance", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch attendance (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Attendance payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}

/**
 * Hook for the HR dashboard overview.
 */
export function useHrDashboardData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/dashboard", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch HR dashboard (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "HR dashboard payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}

/**
 * Hook for employee directory.
 */
export function useHrEmployeesData() {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/hr/employees", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch employee directory (${response.status})`);
        }

        const payload = await response.json();
        if (!payload?.success) {
          throw new Error(payload?.message || "Employee directory payload malformed");
        }

        setState({
          data: payload.data,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        setState({
          data: null,
          isLoading: false,
          error,
        });
      }
    };

    load();
    return () => controller.abort();
  }, []);

  return state;
}
