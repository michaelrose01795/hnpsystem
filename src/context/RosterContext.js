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
import { buildCiRoster } from "@/lib/api/ciMocks";

const NETWORK_TIMEOUT_MS = 4000;
const PLAYWRIGHT_AUTH_ENABLED = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_AUTH === "1";

const initialState = {
  usersByRole: {},
  usersByRoleDetailed: {},
  allUsers: [],
  isLoading: true,
  error: null,
};

const RosterContext = createContext(initialState);

async function fetchRoster(signal) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS) : null;
  const abortFromParent = () => controller?.abort();

  if (signal && controller) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    const response = await fetch("/api/users/roster", {
      signal: controller?.signal || signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.message || "Failed to load roster");
    }
    return payload.data || {};
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (signal && controller) signal.removeEventListener("abort", abortFromParent);
  }
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
      if (PLAYWRIGHT_AUTH_ENABLED) {
        const data = buildCiRoster();
        setState({
          usersByRole: data.usersByRole || {},
          usersByRoleDetailed: data.usersByRoleDetailed || {},
          allUsers: data.allUsers || [],
          isLoading: false,
          error: null,
        });
        hasLoadedRef.current = true;
        return;
      }
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
        if (PLAYWRIGHT_AUTH_ENABLED) {
          const data = buildCiRoster();
          setState({
            usersByRole: data.usersByRole || {},
            usersByRoleDetailed: data.usersByRoleDetailed || {},
            allUsers: data.allUsers || [],
            isLoading: false,
            error: null,
          });
          hasLoadedRef.current = true;
          return;
        }
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
