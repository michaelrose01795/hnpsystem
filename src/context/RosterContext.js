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
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";

const NETWORK_TIMEOUT_MS = 4000;
const PLAYWRIGHT_AUTH_ENABLED = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_AUTH === "1";

const initialState = {
  usersByRole: {},
  usersByRoleDetailed: {},
  allUsers: [],
  isLoading: true,
  error: null,
};

const hasRosterData = (data) =>
  Boolean(
    data &&
      (
        (Array.isArray(data.allUsers) && data.allUsers.length > 0) ||
        Object.keys(data.usersByRoleDetailed || {}).length > 0 ||
        Object.keys(data.usersByRole || {}).length > 0
      )
  );

const stateFromInitialRoster = (initialRosterData) =>
  hasRosterData(initialRosterData)
    ? {
        usersByRole: initialRosterData.usersByRole || {},
        usersByRoleDetailed: initialRosterData.usersByRoleDetailed || {},
        allUsers: initialRosterData.allUsers || [],
        isLoading: false,
        error: null,
      }
    : initialState;

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

export function RosterProvider({ children, initialRosterData = null, deferLoad = false }) {
  const router = useRouter();
  const { user, loading: userLoading } = useUser() || {};
  const [state, setState] = useState(() => stateFromInitialRoster(initialRosterData));
  const hasLoadedRef = useRef(hasRosterData(initialRosterData));
  const isPresentationRoute = router?.pathname === "/presentation";
  const isPublicPresentation = isPresentationRoute && !userLoading && !user;

  useEffect(() => {
    if (!hasRosterData(initialRosterData)) return;
    if (hasLoadedRef.current && hasRosterData(state)) return;
    setState(stateFromInitialRoster(initialRosterData));
    hasLoadedRef.current = true;
  }, [initialRosterData, state]);

  const loadRoster = useCallback(async () => {
    if (isPublicPresentation) {
      setState({ ...initialState, isLoading: false });
      return;
    }

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
        const { buildCiRoster } = await import("@/lib/api/ciMocks");
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
  }, [isPublicPresentation]);

  useEffect(() => {
    if (isPresentationRoute && userLoading) return undefined;
    if (isPublicPresentation) {
      setState({ ...initialState, isLoading: false });
      hasLoadedRef.current = true;
      return undefined;
    }
    if (hasLoadedRef.current) return undefined;

    const controller = new AbortController();
    let idleId = null;
    let timerId = null;
    const startLoad = () => fetchRoster(controller.signal)
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
      .catch(async (error) => {
        if (error.name === "AbortError") return;
        if (PLAYWRIGHT_AUTH_ENABLED) {
          const { buildCiRoster } = await import("@/lib/api/ciMocks");
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

    if (deferLoad && typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(startLoad, { timeout: 1200 });
    } else if (deferLoad) {
      timerId = window.setTimeout(startLoad, 0);
    } else {
      void startLoad();
    }

    return () => {
      controller.abort();
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [deferLoad, isPresentationRoute, isPublicPresentation, userLoading]);

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
