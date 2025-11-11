// file location: src/context/RosterContext.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const initialState = {
  usersByRole: {},
  usersByRoleDetailed: {},
  allUsers: [],
  isLoading: true,
  error: null,
};

const RosterContext = createContext(initialState);

async function fetchRoster(signal) {
  const response = await fetch("/api/users/roster", { signal });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to load roster");
  }
  return payload.data || {};
}

export function RosterProvider({ children }) {
  const [state, setState] = useState(initialState);
  const hasLoadedRef = useRef(false);

  const loadRoster = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const data = await fetchRoster();
      setState({
        usersByRole: data.usersByRole || {},
        usersByRoleDetailed: data.usersByRoleDetailed || {},
        allUsers: data.allUsers || [],
        isLoading: false,
        error: null,
      });
      hasLoadedRef.current = true;
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false, error }));
    }
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) return undefined;
    const controller = new AbortController();
    fetchRoster(controller.signal)
      .then((data) => {
        setState({
          usersByRole: data.usersByRole || {},
          usersByRoleDetailed: data.usersByRoleDetailed || {},
          allUsers: data.allUsers || [],
          isLoading: false,
          error: null,
        });
        hasLoadedRef.current = true;
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setState((prev) => ({ ...prev, isLoading: false, error }));
      });

    return () => controller.abort();
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      refreshRoster: loadRoster,
    }),
    [state, loadRoster]
  );

  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>;
}

export const useRoster = () => useContext(RosterContext);
