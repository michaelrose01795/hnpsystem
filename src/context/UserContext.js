// ✅ Imports converted to use absolute alias "@/"
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
import useVerifiedSessionStatus from "@/hooks/useVerifiedSessionStatus";
import { SIDEBAR_ACCESS_UPDATED_EVENT } from "@/lib/sidebarAccess";
import { getShellBootstrap, invalidateShellBootstrap } from "@/lib/shell/bootstrapClient";
import { clearRememberedStaffRoute } from "@/lib/auth/returnRoute";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { getPresentationRoleByKey } from "@/config/presentationRoleAccess";
import { DEV_FULL_ACCESS_ROLES } from "@/lib/auth/roles";
import { useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed
import { logFailure } from "@/lib/utils/logFailure";

const DEV_ROLE_COOKIE = "hnp-dev-roles";
const DEV_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const DEV_AUTH_BYPASS_ENABLED = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
const PLAYWRIGHT_AUTH_ENABLED = process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST_AUTH === "1";
const NETWORK_TIMEOUT_MS = 15000;
const SIDEBAR_ACCESS_REFRESH_MS = 15000;
// How long to wait before re-asking the server who this session is after the
// lookup failed for a transient reason. Kept well under the sidebar-access poll
// because nothing else can recover from an unknown identity.
const IDENTITY_RETRY_MS = 5000;
const CAN_USE_DEV_AUTH =
  process.env.NODE_ENV !== "production" || DEV_AUTH_BYPASS_ENABLED || PLAYWRIGHT_AUTH_ENABLED;
const isBrowser = () => typeof document !== "undefined";
// The sidebar-access snapshot is re-fetched every SIDEBAR_ACCESS_REFRESH_MS. The
// endpoint returns a freshly parsed object each time, so storing it verbatim
// changed `sidebarAccess`'s identity on every poll even when the data was
// identical — which invalidated `effectiveUser`, produced a new `user` object,
// and re-fired every effect in the app that depends on `user`. Comparing the
// serialised snapshot lets us keep the previous reference when nothing changed.
// Key order is stable because both sides come from JSON.parse of the same
// endpoint's response shape.
const sameSidebarAccess = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};
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
  const { data: session, status: rawSessionStatus } = useSession(); // NextAuth session
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutBarrierUntil, setLogoutBarrierUntil] = useState(0);
  const [status, setStatus] = useState("Waiting for Job"); // default tech status
  const [dbUserId, setDbUserId] = useState(null);
  const [sidebarAccess, setSidebarAccess] = useState(null);
  // Keep navigation behind its skeleton until the saved per-user layout has
  // resolved. Rendering role defaults first causes incorrect modules to flash
  // before an administrator's persisted layout replaces them.
  const [sidebarAccessLoading, setSidebarAccessLoading] = useState(true);
  // The DB user id that owns `sidebarAccess`. A snapshot is never exposed as
  // ready until this id matches the current user, which prevents a previous
  // user's modules surviving across session changes or overlapping requests.
  const [sidebarAccessOwnerId, setSidebarAccessOwnerId] = useState(null);
  const [sidebarAccessReady, setSidebarAccessReady] = useState(false);
  const sidebarAccessOwnerIdRef = useRef(sidebarAccessOwnerId);
  const sidebarAccessReadyRef = useRef(sidebarAccessReady);
  sidebarAccessOwnerIdRef.current = sidebarAccessOwnerId;
  sidebarAccessReadyRef.current = sidebarAccessReady;
  const sidebarAccessRequestRef = useRef(0);
  // True once sidebar access has been resolved at least once for this user, so
  // the combined shell bootstrap is only consulted for the FIRST resolution and
  // every later refresh goes straight to the dedicated endpoint.
  const sidebarAccessResolvedRef = useRef(false);
  // Whether this session maps to a Supabase users row, as answered by the
  // SERVER (/api/shell/bootstrap). The browser cannot work this out for itself
  // — its Supabase client runs as the anon role, which has no permission on the
  // users table — and the difference matters: "unlinked" is a settled answer
  // (no snapshot exists, so role-derived navigation is final), while "pending"
  // and "error" mean the answer is still unknown and navigation must stay
  // fail-closed behind its skeleton.
  const [identityStatus, setIdentityStatus] = useState("pending"); // pending | linked | unlinked | error
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const [currentJob, setCurrentJob] = useState(null);
  const hasLogoutBarrier = logoutBarrierUntil > Date.now();
  const authSyncBlocked = isLoggingOut || hasLogoutBarrier;
  // NextAuth reports a FAILED /api/auth/session the same way it reports a real
  // signed-out session: status === "unauthenticated". Believing that on a cold
  // start is what strands a restored pinned tab - one failed request revoked a
  // session whose cookie the edge guard had already accepted, StaffLayout
  // bounced the route to /login, and nothing retried. This confirms an
  // unauthenticated answer with the server before acting on it, and reports
  // "loading" until it has one, which every consumer below already treats
  // fail-closed. See src/hooks/useVerifiedSessionStatus.js.
  //
  // Disabled while a logout is in flight: signing out is the one case where
  // "unauthenticated" is the intended answer, and re-confirming it there would
  // race the cookie being cleared - a probe that caught the session still alive
  // would try to restore the very session the user is leaving.
  const { status: sessionStatus, recovering: sessionRecovering } =
    useVerifiedSessionStatus(rawSessionStatus, { disabled: authSyncBlocked });
  // One cache key for every /api/shell/bootstrap read. The SESSION identity is
  // the key rather than dbUserId, because for sessions whose id is not already a
  // users.user_id the id is itself derived from that payload. RosterContext
  // already keys on the same value, so the shell consumers now share one request
  // instead of evicting each other's cache entry.
  const shellBootstrapKey = user?.id ?? null;

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
    sidebarAccessRequestRef.current += 1;
    sidebarAccessResolvedRef.current = false;
    setSidebarAccess(null);
    setSidebarAccessOwnerId(null);
    setSidebarAccessReady(true);
    setSidebarAccessLoading(false);
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
        sidebarAccessRequestRef.current += 1;
        sidebarAccessResolvedRef.current = false;
        setSidebarAccess(null);
        setSidebarAccessOwnerId(null);
        setSidebarAccessReady(false);
        setSidebarAccessLoading(true);
        setUser(finalDevUser);
        setDevRoleCookie(finalDevUser.roles || []);
      } catch (err) {
        logFailure("Failed to parse dev user from localStorage", err);
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
        id: resolvedSessionId || user?.id || Date.now(),
        username: session.user.name || "User",
        email: session.user.email || null,
        roles: (session.user.roles || [])
          .map((r) => String(r || "").trim().toUpperCase())
          .filter(Boolean),
        authUuid: resolvedSessionId || null,
        isDevLogin: Boolean(session.user.isDevLogin),
      };
      if (String(user?.id ?? "") !== String(sessionUser.id ?? "")) {
        sidebarAccessRequestRef.current += 1;
        sidebarAccessResolvedRef.current = false;
        setSidebarAccess(null);
        setSidebarAccessOwnerId(null);
        setSidebarAccessReady(false);
        setSidebarAccessLoading(true);
      }
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
  }, [session, sessionStatus, authSyncBlocked, user?.id]);

  // Resolve Supabase users.user_id when a user is set
  useEffect(() => {
    let cancelled = false;

    const resolveDbUser = async () => {
      if (!user) {
        setDbUserId(null);
        setSidebarAccessOwnerId(null);
        setSidebarAccessReady(false);
        setSidebarAccessLoading(false);
        setIdentityStatus("pending");
        setCurrentJob(null);
        return;
      }

      if (isPresentationMode()) {
        setDbUserId(1);
        setSidebarAccessReady(true);
        setIdentityStatus("linked");
        setCurrentJob(null);
        return;
      }

      if (PLAYWRIGHT_AUTH_ENABLED) {
        const numericUserId = Number(user.id);
        setDbUserId(Number.isInteger(numericUserId) && numericUserId > 0 ? numericUserId : 1);
        setSidebarAccessReady(true);
        setIdentityStatus("linked");
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
          setIdentityStatus("linked");
          return;
        }
      }

      // Everything else — dev logins, the developer-platform session, and any
      // session whose id is not already a users.user_id — asks the SERVER who it
      // is. This used to resolve the id through the browser's Supabase client,
      // which runs as the anon role and has no permission on the users table, so
      // the query could only ever fail. dbUserId then stayed null, which made
      // refreshSidebarAccess below take its early return, which left
      // sidebarAccessReady false forever — the sidebar sat behind
      // SidebarNavSkeleton permanently while /api/shell/bootstrap was returning
      // a perfectly valid snapshot for the very same session. The server
      // resolves identity from the signed session cookie (resolveSessionUserId),
      // so nothing here trusts a client-supplied id.
      try {
        const boot = await withTimeout(
          getShellBootstrap({
            userKey: shellBootstrapKey,
            force: identityAttempt > 0,
          }),
          "Workshop user id resolution"
        );
        if (cancelled) return;
        const serverUserId = Number(boot?.userId);
        if (Number.isInteger(serverUserId) && serverUserId > 0) {
          setDbUserId(serverUserId);
          setIdentityStatus("linked");
          return;
        }
        // An "unlinked" answer means the server reached the database and found
        // no users row for this session. That is settled, not pending: there is
        // no per-user snapshot to wait for, so navigation resolves to the
        // role-derived default — the same thing a linked user with no override
        // gets. Roles still come from the signed session, so this grants nothing
        // the session did not already carry. Anything else ("error", or no
        // response at all) leaves the answer unknown, so it stays fail-closed
        // and is retried.
        setDbUserId(null);
        setSidebarAccessOwnerId(null);
        setIdentityStatus(boot?.identity === "unlinked" ? "unlinked" : "error");
      } catch (err) {
        logFailure("Failed to resolve workshop user id", err?.message || err);
        if (cancelled) return;
        setDbUserId(null);
        setSidebarAccessOwnerId(null);
        setIdentityStatus("error");
      }
    };

    resolveDbUser();
    return () => {
      cancelled = true;
    };
  }, [user, identityAttempt, shellBootstrapKey]);

  // An identity lookup that failed for a transient reason has nothing else to
  // recover it: the sidebar-access poll further down is keyed on dbUserId and
  // never runs while the id is unknown, so without this the sidebar would keep
  // its skeleton until the page was reloaded.
  useEffect(() => {
    if (identityStatus !== "error" || !user) return undefined;
    const timer = setTimeout(() => setIdentityAttempt((attempt) => attempt + 1), IDENTITY_RETRY_MS);
    return () => clearTimeout(timer);
  }, [identityStatus, identityAttempt, user]);

  // Per-user sidebar-access snapshot (admin-set override). Fetched fresh once the
  // Supabase user id is known, so an admin's edit applies on the user's next page
  // load — no re-login required. A null result means "no override" → role-derived
  // navigation (the default). Presentation / Playwright / synthetic dev-platform
  // sessions have no DB row, so they keep the role-derived default.
  const refreshSidebarAccess = useCallback(async () => {
    const requestId = ++sidebarAccessRequestRef.current;
    if (!dbUserId || isPresentationMode() || PLAYWRIGHT_AUTH_ENABLED) {
      setSidebarAccess(null);
      setSidebarAccessOwnerId(null);
      // "unlinked" is the server's settled answer that this session has no users
      // row (see resolveDbUser): no row means no snapshot, so role-derived
      // navigation is the final state rather than a loading one. "pending" and
      // "error" keep the skeleton — the answer is still unknown.
      setSidebarAccessReady(
        isPresentationMode() || PLAYWRIGHT_AUTH_ENABLED || identityStatus === "unlinked"
      );
      setSidebarAccessLoading(false);
      return;
    }
    const requestedUserId = Number(dbUserId);
    const alreadyResolvedForUser =
      sidebarAccessReadyRef.current &&
      Number(sidebarAccessOwnerIdRef.current) === requestedUserId;
    if (!alreadyResolvedForUser) {
      setSidebarAccess(null);
      setSidebarAccessOwnerId(null);
      setSidebarAccessReady(false);
      setSidebarAccessLoading(true);
    }
    try {
      // First resolution comes from the combined shell bootstrap, which fetches
      // sidebar access, the roster and the unread count in ONE round trip
      // instead of three (see lib/shell/bootstrapClient.js). Refreshes — the 15s
      // poll, focus/online, and admin-edit events — keep using the dedicated
      // endpoint so this stays a head start rather than a dependency.
      if (!sidebarAccessResolvedRef.current) {
        const boot = await getShellBootstrap({ userKey: shellBootstrapKey });
        if (requestId !== sidebarAccessRequestRef.current) return;
        // A non-null bootstrap snapshot is conclusive. A null bootstrap value
        // is ambiguous because the aggregate endpoint also uses null when this
        // section fails, so confirm that case with the dedicated endpoint.
        if (
          boot &&
          Number(boot.userId) === requestedUserId &&
          boot.sidebarAccess != null
        ) {
          sidebarAccessResolvedRef.current = true;
          const next = boot.sidebarAccess;
          setSidebarAccess((prev) => (sameSidebarAccess(prev, next) ? prev : next));
          setSidebarAccessOwnerId(requestedUserId);
          setSidebarAccessReady(true);
          setSidebarAccessLoading(false);
          return;
        }
      }

      const res = await withTimeout(
        fetch(`/api/profile/sidebar-access?userId=${encodeURIComponent(dbUserId)}`, {
          credentials: "include",
        }),
        "Sidebar access fetch"
      );
      if (requestId !== sidebarAccessRequestRef.current) return;
      if (!res.ok) {
        // Retain confirmed data for this same user during a refresh failure.
        // On initial load there is no confirmed snapshot, so remain fail-closed.
        if (!alreadyResolvedForUser) {
          setSidebarAccess(null);
          setSidebarAccessOwnerId(null);
          setSidebarAccessReady(false);
        }
        setSidebarAccessLoading(false);
        return;
      }
      const json = await res.json();
      const nextSidebarAccess = json?.sidebarAccess ?? null;
      // Keep the previous object when the snapshot is unchanged (see
      // sameSidebarAccess above) so the 15s poll does not churn `user`.
      setSidebarAccess((prev) => (sameSidebarAccess(prev, nextSidebarAccess) ? prev : nextSidebarAccess));
      sidebarAccessResolvedRef.current = true;
      setSidebarAccessOwnerId(requestedUserId);
      setSidebarAccessReady(true);
      setSidebarAccessLoading(false);
    } catch (err) {
      if (requestId !== sidebarAccessRequestRef.current) return;
      logFailure("Failed to load sidebar access", err?.message || err);
      if (!alreadyResolvedForUser) {
        setSidebarAccess(null);
        setSidebarAccessOwnerId(null);
        setSidebarAccessReady(false);
      }
      setSidebarAccessLoading(false);
    }
  }, [dbUserId, identityStatus, shellBootstrapKey]);

  useEffect(() => {
    refreshSidebarAccess();
  }, [refreshSidebarAccess]);

  useEffect(() => {
    if (!dbUserId || isPresentationMode() || PLAYWRIGHT_AUTH_ENABLED) return undefined;

    const refreshIfCurrentUserChanged = (event) => {
      const changedUserIds = Array.isArray(event?.detail?.userIds)
        ? event.detail.userIds.map(Number)
        : [];
      if (changedUserIds.includes(Number(dbUserId))) {
        void refreshSidebarAccess();
      }
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === "visible") void refreshSidebarAccess();
    };

    // Refresh through the authenticated endpoint instead of subscribing the
    // sensitive users table to a public realtime feed. Local edits apply at
    // once; other devices refresh while active and immediately on focus/online.
    const refreshTimer = window.setInterval(refreshWhenActive, SIDEBAR_ACCESS_REFRESH_MS);

    window.addEventListener(SIDEBAR_ACCESS_UPDATED_EVENT, refreshIfCurrentUserChanged);
    window.addEventListener("focus", refreshWhenActive);
    window.addEventListener("online", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      window.removeEventListener(SIDEBAR_ACCESS_UPDATED_EVENT, refreshIfCurrentUserChanged);
      window.removeEventListener("focus", refreshWhenActive);
      window.removeEventListener("online", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      window.clearInterval(refreshTimer);
    };
  }, [dbUserId, refreshSidebarAccess]);

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
      const { getUserActiveJobs } = await import("@/lib/database/jobClocking");
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
      logFailure("Failed to refresh current job", err?.message || err);
      return null;
    }
  }, [dbUserId]);

  // Keep current job in sync when DB user id changes
  useEffect(() => {
    refreshCurrentJob();
  }, [refreshCurrentJob]);

  // Developer login. useCallback'd (with only stable setState/ref deps) so it
  // does not change the context value's identity on every render.
  const devLogin = useCallback(async (userChoice = {}, role = "WORKSHOP") => {
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

      sidebarAccessRequestRef.current += 1;
      sidebarAccessResolvedRef.current = false;
      setSidebarAccess(null);
      setSidebarAccessOwnerId(null);
      setSidebarAccessReady(false);
      setSidebarAccessLoading(true);
      setUser(finalUser);
      if (CAN_USE_DEV_AUTH) {
        localStorage.setItem("devUser", JSON.stringify(finalUser));
        setDevRoleCookie(finalUser.roles || []);
      }
      return { success: true };
    } catch (err) {
      logFailure("Dev login failed", err);
      return { success: false, error: err };
    }
  }, []);

  // Logout — clears both local state and NextAuth session. Same stability note
  // as devLogin above: every dependency is a stable setState or module helper.
  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    const barrierUntil = Date.now() + LOGOUT_BARRIER_MS;
    setLogoutBarrierUntil(barrierUntil);
    setLogoutBarrier(barrierUntil);
    sidebarAccessRequestRef.current += 1;
    sidebarAccessResolvedRef.current = false;
    setUser(null);
    setSidebarAccess(null);
    setSidebarAccessOwnerId(null);
    setSidebarAccessReady(false);
    setSidebarAccessLoading(false);
    setStatus("Waiting for Job"); // reset status
    setDbUserId(null);
    setCurrentJob(null);
    // Drop the cached shell payload so the next sign-in can never read the
    // previous user's sidebar access, roster or unread count.
    invalidateShellBootstrap();
    // Signing out deliberately is not "losing your place" — the next sign-in
    // should start at the role default, not be thrown back into the last page
    // of a session the user chose to end.
    clearRememberedStaffRoute();
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
  }, []);

  // Expose the signed-in user with their sidebar-access snapshot attached so the
  // sidebar (StaffSidebar) and the client route guard (_app PageAccessGuard) can
  // read user.sidebarAccess without a separate subscription. Memoised so identity
  // only changes when the user or the snapshot changes.
  const effectiveUser = useMemo(() => {
    if (!user) return user;

    // Effects update the local user after NextAuth changes. During the render
    // before that effect runs, suppress the old user entirely so their roles
    // and modules cannot be painted for the incoming session.
    if (sessionStatus === "authenticated" && session?.user) {
      const sessionUserId = session.user.id || session.user.sub || session.user.user_id || null;
      if (sessionUserId != null && String(user.id ?? "") !== String(sessionUserId)) return null;
    }

    const accessBelongsToCurrentUser =
      sidebarAccessReady &&
      (isPresentationMode() ||
        PLAYWRIGHT_AUTH_ENABLED ||
        Number(sidebarAccessOwnerId) === Number(dbUserId));
    return {
      ...user,
      sidebarAccess: accessBelongsToCurrentUser ? sidebarAccess : null,
    };
  }, [
    user,
    sessionStatus,
    session?.user,
    sidebarAccess,
    sidebarAccessOwnerId,
    sidebarAccessReady,
    dbUserId,
  ]);

  // Memoised: `useUser()` has 77 call sites across the app and UserProvider sits
  // near the root, so an unmemoised object literal here re-rendered every
  // consumer on every provider render. Every entry below is either state, a
  // stable setState, or a useCallback/useMemo result, so the identity now
  // changes only when the data actually changes.
  const contextValue = useMemo(
    () => ({
      user: effectiveUser,
      loading,
      devLogin,
      logout,
      status,
      setStatus,
      dbUserId,
      sidebarAccess,
      sidebarAccessLoading,
      sidebarAccessReady,
      refreshSidebarAccess,
      currentJob,
      setCurrentJob,
      refreshCurrentJob,
      authUserId:
        effectiveUser?.authUuid || (typeof effectiveUser?.id === "string" ? effectiveUser.id : null),
      logoutInProgress: authSyncBlocked,
      // True while an "unauthenticated" answer is being confirmed against the
      // server. Consumers that want to say "reconnecting" rather than "signed
      // out" can read this; nothing is required to.
      sessionRecovering,
    }),
    [
      effectiveUser,
      loading,
      devLogin,
      logout,
      status,
      dbUserId,
      sidebarAccess,
      sidebarAccessLoading,
      sidebarAccessReady,
      refreshSidebarAccess,
      currentJob,
      refreshCurrentJob,
      authSyncBlocked,
      sessionRecovering,
    ]
  );

  return <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>;
}

// Custom hook
export const useUser = () => useContext(UserContext);
