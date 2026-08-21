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
import { getShellBootstrap } from "@/lib/shell/bootstrapClient";

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
    // Wait for a signed-in user before requesting the staff roster.
    //
    // This provider is mounted on every route, including the public customer
    // website, the customer portal and the public VHC report links. It used to
    // call /api/users/roster regardless of auth state, so an anonymous visitor
    // paid a full request round-trip for a response that could only ever be a
    // 401. Staff routes are unaffected: `user` is resolved before the shell
    // renders anything that reads the roster.
    if (userLoading) return undefined;
    if (!user) {
      setState((prev) => (prev.isLoading ? { ...prev, isLoading: false } : prev));
      return undefined;
    }
    if (hasLoadedRef.current) return undefined;

    const controller = new AbortController();
    let idleId = null;
    let timerId = null;
    const applyRoster = (data) => {
      setState({
        usersByRole: data.usersByRole || {},
        usersByRoleDetailed: data.usersByRoleDetailed || {},
        allUsers: data.allUsers || [],
        isLoading: false,
        error: null,
      });
      hasLoadedRef.current = true;
    };

    const startLoad = async () => {
      // Prefer the combined shell bootstrap: it already carries the roster, so a
      // fresh boot costs one shared round trip instead of a dedicated one here.
      // It resolves to null on any failure, in which case this falls through to
      // /api/users/roster exactly as before.
      try {
        const boot = await getShellBootstrap({ userKey: user?.id ?? null });
        if (boot?.roster) {
          applyRoster(boot.roster);
          return;
        }
      } catch {
        // fall through to the dedicated endpoint
      }

      try {
        applyRoster(await fetchRoster(controller.signal));
      } catch (error) {
        if (error.name === "AbortError") return;
        if (PLAYWRIGHT_AUTH_ENABLED) {
          const { buildCiRoster } = await import("@/lib/api/ciMocks");
          applyRoster(buildCiRoster());
          return;
        }
        setState((prev) => ({ ...prev, isLoading: false, error }));
      }
    };

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
  }, [deferLoad, isPresentationRoute, isPublicPresentation, userLoading, user]);

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
