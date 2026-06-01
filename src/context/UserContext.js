// ✅ Imports converted to use absolute alias "@/"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { ensureDevDbUserAndGetId } from "@/lib/users/devUsers";
import { getUserActiveJobs } from "@/lib/database/jobClocking";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";
import { DEV_FULL_ACCESS_ROLES } from "@/lib/auth/roles";
import { useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed

const DEV_ROLE_COOKIE = "hnp-dev-roles";
const DEV_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const DEV_AUTH_BYPASS_ENABLED = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const PLAYWRIGHT_AUTH_ENABLED = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_AUTH === "1";
const NETWORK_TIMEOUT_MS = 15000;
const CAN_USE_DEV_AUTH =
  process.env.NODE_ENV !== "production" || DEV_AUTH_BYPASS_ENABLED || PLAYWRIGHT_AUTH_ENABLED;
const isBrowser = () => typeof document !== "undefined";
const withTimeout = (promise, label, timeoutMs = NETWORK_TIMEOUT_MS) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
};
const readLogoutBarrierUntil = () => {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(LOGOUT_BARRIER_STORAGE_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const setLogoutBarrier = (untilTs) => {
  if (typeof window === "undefined") return;
  if (untilTs > 0) {
    window.sessionStorage.setItem(LOGOUT_BARRIER_STORAGE_KEY, String(untilTs));
    return;
  }
  window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
};
const clearDevRoleCookie = () => {
  if (!isBrowser()) return;
  document.cookie = `${DEV_ROLE_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
};
const serializeRolesForCookie = (roles = []) =>
  roles
    .filter(Boolean)
    .map((role) => role.toLowerCase())
    .join("|");
const setDevRoleCookie = (roles = []) => {
  if (!isBrowser()) return;
  const payload = serializeRolesForCookie(roles);
  if (!payload) {
    clearDevRoleCookie();
    return;
  }
  document.cookie = `${DEV_ROLE_COOKIE}=${encodeURIComponent(payload)}; path=/; max-age=${DEV_COOKIE_MAX_AGE}`;
};

const UserContext = createContext();

export function UserProvider({ children }) {
  const { data: session, status: sessionStatus } = useSession(); // NextAuth session
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutBarrierUntil, setLogoutBarrierUntil] = useState(0);
  const [status, setStatus] = useState("Waiting for Job"); // default tech status
  const [dbUserId, setDbUserId] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const hasLogoutBarrier = logoutBarrierUntil > Date.now();
  const authSyncBlocked = isLoggingOut || hasLogoutBarrier;

  // TEMP diagnostic: auth state churn is a prime suspect for the page flicker
  // (user briefly null -> Layout swaps in a skeleton / redirects to /login).
  useTraceValue("user.sessionStatus", sessionStatus);
  useTraceValue("user.identity", user ? `${user.username}#${user.id}` : "null");
  useTraceValue("user.loading", loading);
  useTraceValue("user.dbUserId", dbUserId);
  useTraceValue("user.logoutInProgress", authSyncBlocked);

  useEffect(() => {
    const nextBarrierUntil = readLogoutBarrierUntil();
    if (nextBarrierUntil > Date.now()) {
      setLogoutBarrierUntil(nextBarrierUntil);
    } else {
      setLogoutBarrierUntil(0);
      setLogoutBarrier(0);
    }
  }, []);

  useEffect(() => {
    if (!logoutBarrierUntil) {
      setLogoutBarrier(0);
      return;
    }
    setLogoutBarrier(logoutBarrierUntil);
    const remainingMs = logoutBarrierUntil - Date.now();
    if (remainingMs <= 0) {
      setLogoutBarrierUntil(0);
      return;
    }
    const timer = setTimeout(() => setLogoutBarrierUntil(0), remainingMs);
    return () => clearTimeout(timer);
  }, [logoutBarrierUntil]);

  useEffect(() => {
    if (sessionStatus === "unauthenticated" && logoutBarrierUntil) {
      setLogoutBarrierUntil(0);
    }
  }, [sessionStatus, logoutBarrierUntil]);

  // Presentation mode: synthesise a user from the active demo role so the rest
  // of the app (role-gated UI, sidebars, dashboards) renders without ever
  // hitting NextAuth or the dev-login flow.
  //
  // This effect keys on `router.asPath` so it re-runs on every route change —
  // including *client-side* navigation into a /presentation/* deck (e.g.
  // picking a tile on /loginPresentation). Keying it only on `sessionStatus`
  // meant the demo user was never created when entering a deck via a Next
  // <Link> (sessionStatus doesn't change during a client navigation), so
  // role-gated pages such as /messages fell back to their "please log in"
  // state. The route segment itself is the authoritative role source.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isPresentationMode()) {
      // Left the presentation deck — drop the synthetic demo user so the real
      // auth effects below can take over again.
      setUser((prev) =>
        prev && typeof prev.id === "string" && prev.id.startsWith("demo-") ? null : prev
      );
      return;
    }
    const pathRoleKey = window.location.pathname.match(/^\/presentation\/([^/]+)/)?.[1] || null;
    const key = pathRoleKey || window.sessionStorage.getItem("presentation:activeRoleKey");
    const role = getPresentationRoleByKey(key);
    if (!role) return;
    window.sessionStorage.setItem("presentation:activeRoleKey", role.key);
    // Presentation decks mount the real, role-gated pages with mock data only.
    // Those pages run their own in-page role checks (separate from
    // ProtectedRoute, which already no-ops in presentation mode) and would
    // otherwise render a "you do not have permission" panel whenever the picked
    // demo role doesn't match a page's expected role(s). Presentation mode is
    // read-only mock data with no working actions, so the demo user carries
    // every known role — this lets every page in every deck render its full
    // content. The picked tile's role is listed first so any page that reads a
    // "primary" role still reflects the chosen presentation role.
    const roleAliases = new Set([
      String(role.roleId || role.key).toUpperCase(),
      ...DEV_FULL_ACCESS_ROLES.map((r) => String(r).toUpperCase()),
    ]);
    if (role.key === "mobile-technician") roleAliases.add("TECHS");
    const demoUser = {
      id: `demo-${role.key}`,
      username: role.demoName || "Demo User",
      email: `${role.key}@demo.hnp.example`,
      roles: Array.from(roleAliases),
      authUuid: null,
      isDevLogin: false,
      impersonatedRole: role.roleId || role.key,
    };
    // Keep the existing object reference when the role hasn't changed so a
    // slide/step hash navigation inside the same deck doesn't churn renders.
    setUser((prev) => (prev && prev.id === demoUser.id ? prev : demoUser));
    setDbUserId(1);
    setLoading(false);
  }, [sessionStatus, router.asPath]);

  // Load dev user from localStorage
  useEffect(() => {
    if (isPresentationMode()) {
      return;
    }

    if (authSyncBlocked) {
      return;
    }

    if (sessionStatus === "loading") {
      return;
    }

    if (!CAN_USE_DEV_AUTH) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("devUser");
      }
      clearDevRoleCookie();
      setLoading(false);
      return;
    }

    if (sessionStatus === "authenticated" && session?.user) {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("devUser");
      }
      clearDevRoleCookie();
      return;
    }

    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("devUser") : null;
    if (stored && !(sessionStatus === "authenticated" && session?.user)) {
      try {
        const parsed = JSON.parse(stored);
        const finalDevUser = { ...parsed, id: parsed.id || Date.now() };
        setUser(finalDevUser);
        setDevRoleCookie(finalDevUser.roles || []);
      } catch (err) {
        console.error("Failed to parse dev user from localStorage", err);
      }
    }
    if (!stored) {
      setUser(null);
    }
    setLoading(false);
  }, [session, sessionStatus, authSyncBlocked]);

  // Set user from NextAuth session (works for both Keycloak and Credentials providers)
  useEffect(() => {
    if (isPresentationMode()) {
      return;
    }

    if (authSyncBlocked) {
      return;
    }

    if (sessionStatus === "authenticated" && session?.user) {
      const resolvedSessionId =
        session.user.id || session.user.sub || session.user.user_id || null;
      const sessionUser = {
        id: resolvedSessionId || Date.now(),
        username: session.user.name || "User",
        email: session.user.email || null,
        roles: (session.user.roles || [])
          .map((r) => String(r || "").trim().toUpperCase())
          .filter(Boolean),
        authUuid: resolvedSessionId || null,
        isDevLogin: Boolean(session.user.isDevLogin),
      };
      setUser(sessionUser);
      setLoading(false);
      if (CAN_USE_DEV_AUTH) {
        localStorage.removeItem("devUser");
      }
      clearDevRoleCookie();
      return;
    }

    if (sessionStatus === "unauthenticated" && !CAN_USE_DEV_AUTH) {
      setUser(null);
      setLoading(false);
    }
  }, [session, sessionStatus, authSyncBlocked]);

  // Resolve Supabase users.user_id when a user is set
  useEffect(() => {
    let cancelled = false;

    const resolveDbUser = async () => {
      if (!user) {
        setDbUserId(null);
        setCurrentJob(null);
        return;
      }

      if (isPresentationMode()) {
        setDbUserId(1);
        setCurrentJob(null);
        return;
      }

      if (PLAYWRIGHT_AUTH_ENABLED) {
        const numericUserId = Number(user.id);
        setDbUserId(Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : 1);
        setCurrentJob(null);
        return;
      }

      // Fast path: a real (non-dev) NextAuth session already carries the
      // Supabase users.user_id as user.id (set from session.user.id in the
      // auth effect above). When that id is a trusted positive integer we can
      // use it directly and skip the extra `select user_id … maybeSingle()`
      // round-trip — this removes ~hundreds of ms from every authenticated load.
      // Dev logins (synthetic ids), presentation, and Playwright are handled
      // above / fall through to the lookup, so their behaviour is unchanged.
      if (!user.isDevLogin) {
        const numericUserId = Number(user.id);
        if (Number.isInteger(numericUserId) && numericUserId > 0) {
          setDbUserId(numericUserId);
          return;
        }
      }

      try {
        const ensuredId = await withTimeout(
          ensureDevDbUserAndGetId(user),
          "Workshop user id resolution"
        );
        if (!cancelled) {
          setDbUserId(ensuredId || null);
        }
      } catch (err) {
        console.error("Failed to resolve workshop user id", err?.message || err);
        if (!cancelled) {
          setDbUserId(null);
        }
      }
    };

    resolveDbUser();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Helper to refresh the technician's active job from job_clocking table
  const refreshCurrentJob = useCallback(async () => {
    if (!dbUserId) {
      setCurrentJob(null);
      return null;
    }

    if (PLAYWRIGHT_AUTH_ENABLED) {
      setCurrentJob(null);
      return null;
    }

    try {
      const active = await withTimeout(
        getUserActiveJobs(dbUserId),
        "Active job refresh"
      );
      if (active.success && Array.isArray(active.data) && active.data.length > 0) {
        const nextJob = active.data[0];
        setCurrentJob(nextJob);
        return nextJob;
      } else {
        setCurrentJob(null);
        return null;
      }
    } catch (err) {
      console.error("Failed to refresh current job", err?.message || err);
      return null;
    }
  }, [dbUserId]);

  // Keep current job in sync when DB user id changes
  useEffect(() => {
    refreshCurrentJob();
  }, [refreshCurrentJob]);

  // Developer login
  const devLogin = async (userChoice = {}, role = "WORKSHOP") => {
    if (!CAN_USE_DEV_AUTH) {
      return { success: false, error: new Error("Developer login is disabled in production.") };
    }

    try {
      const choice = typeof userChoice === "string" ? { name: userChoice } : (userChoice || {});
      const candidateId = choice.id ?? choice.user_id ?? choice.identifier;
      const numericId = Number(candidateId);
      const resolvedId = Number.isFinite(numericId) && numericId > 0 ? numericId : Date.now();

      const resolvedName =
        choice.name ||
        choice.displayName ||
        choice.fullName ||
        [choice.first_name || choice.firstName, choice.last_name || choice.lastName]
          .filter(Boolean)
          .join(" ").trim() ||
        choice.email ||
        "Dev User";

      const resolvedRole = choice.role || role || "";
      const finalUser = {
        id: resolvedId,
        username: resolvedName,
        email: choice.email || "",
        roles: resolvedRole ? [String(resolvedRole).toUpperCase()] : [],
        impersonatedRole: resolvedRole,
        department: choice.department || "",
        customerId: choice.customerId || choice.customer_id || null,
        authUuid: null,
        isDevLogin: true,
      };

      setUser(finalUser);
      if (CAN_USE_DEV_AUTH) {
        localStorage.setItem("devUser", JSON.stringify(finalUser));
        setDevRoleCookie(finalUser.roles || []);
      }
      return { success: true };
    } catch (err) {
      console.error("Dev login failed", err);
      return { success: false, error: err };
    }
  };

  // Logout — clears both local state and NextAuth session
  const logout = async () => {
    setIsLoggingOut(true);
    const barrierUntil = Date.now() + LOGOUT_BARRIER_MS;
    setLogoutBarrierUntil(barrierUntil);
    setLogoutBarrier(barrierUntil);
    setUser(null);
    setStatus("Waiting for Job"); // reset status
    setDbUserId(null);
    setCurrentJob(null);
    if (CAN_USE_DEV_AUTH) {
      localStorage.removeItem("devUser");
    }
    clearDevRoleCookie();
    // Clear NextAuth session cookie (no-op if no session exists)
    try {
      await nextAuthSignOut({ redirect: false });
    } catch {
      // Ignore errors — session might not exist
    } finally {
      setIsLoggingOut(false);
    }
  };

  const contextValue = {
    user,
    loading,
    devLogin,
    logout,
    status,
    setStatus,
    dbUserId,
    currentJob,
    setCurrentJob,
    refreshCurrentJob,
    authUserId: user?.authUuid || (typeof user?.id === "string" ? user.id : null),
    logoutInProgress: authSyncBlocked,
  };

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

// Custom hook
export const useUser = () => useContext(UserContext);
