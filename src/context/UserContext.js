// ✅ Imports converted to use absolute alias "@/"
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import { ensureDevDbUserAndGetId } from "@/lib/users/devUsers";
import { getUserActiveJobs } from "@/lib/database/jobClocking";
import { getUserById } from "@/lib/database/users";

const DEV_ROLE_COOKIE = "hnp-dev-roles";
const DEV_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const DEV_AUTH_BYPASS_ENABLED = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const CAN_USE_DEV_AUTH =
  process.env.NODE_ENV !== "production" || DEV_AUTH_BYPASS_ENABLED;
const isBrowser = () => typeof document !== "undefined";
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutBarrierUntil, setLogoutBarrierUntil] = useState(0);
  const [status, setStatus] = useState("Waiting for Job"); // default tech status
  const [dbUserId, setDbUserId] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const hasLogoutBarrier = logoutBarrierUntil > Date.now();
  const authSyncBlocked = isLoggingOut || hasLogoutBarrier;

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

  // Load dev user from localStorage
  useEffect(() => {
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

      try {
        const ensuredId = await ensureDevDbUserAndGetId(user);
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

    try {
      const active = await getUserActiveJobs(dbUserId);
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
      let resolved = null;
      const candidateId =
        userChoice?.id ?? userChoice?.user_id ?? userChoice?.identifier;
      if (
        candidateId !== undefined &&
        candidateId !== null &&
        Number.isInteger(Number(candidateId))
      ) {
        resolved = await getUserById(Number(candidateId));
      }

      const fallbackName =
        typeof userChoice === "string"
          ? userChoice
          : userChoice?.name ||
            userChoice?.displayName ||
            userChoice?.fullName ||
            userChoice?.email ||
            "Dev User";

      const finalUser = resolved
        ? {
            id: resolved.id,
            username: resolved.name,
            email: resolved.email,
            roles: [resolved.role?.toUpperCase() || role.toUpperCase()],
            authUuid: null,
            isDevLogin: true,
          }
        : {
            id: Date.now(),
            username: fallbackName,
            email: userChoice?.email || "",
            roles: [role.toUpperCase()],
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
    } catch (_) {
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
