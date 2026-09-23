// file location: src/pages/login.js
// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { getSession, signIn, useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { useRouter } from "next/router";
import BrandLogo from "@/components/BrandLogo";
import { roleCategories } from "@/config/users"; // Dev users config
import { useTheme } from "@/styles/themeProvider";
import { canShowDevLogin } from "@/lib/dev-tools/config";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LoginPageUi from "@/components/page-ui/login-ui"; // Extracted presentation layer.
import { trace, useTraceMount, useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed
import { readRememberedStaffRoute, resolveReturnRoute } from "@/lib/auth/returnRoute";
import { ALL_ACCESS_USER_ID } from "@/lib/auth/allAccessSession";
import { logFailure } from "@/lib/utils/logFailure";

const LoginDropdown = dynamic(() => import("@/components/LoginDropdown"));

const EMPTY_LOGIN_ROSTER = {
  usersByRole: {},
  usersByRoleDetailed: {},
  allUsers: [],
  isLoading: true,
};

async function fetchLoginRoster(signal) {
  const response = await fetch("/api/users/roster", { signal, credentials: "include" });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Failed to load login roster");
  }
  return payload.data || {};
}

const FIELD_MAX_WIDTH = 380;
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const AUTH_LAYOUT_ENTRANCE_STORAGE_KEY = "hnp-auth-layout-entrance";
const LOGIN_REDIRECT_IN_PROGRESS_STORAGE_KEY = "hnp-login-redirect-in-progress";
const DEFAULT_STAFF_POST_LOGIN_ROUTE = "/newsfeed";
const DEFAULT_CUSTOMER_POST_LOGIN_ROUTE = "/website/profile";
const warmStaffLandingPage = () =>
  import("@/lib/database/newsUpdates").then(({ warmNewsUpdatesCache }) => warmNewsUpdatesCache()).catch((error) => {
    logFailure("Failed to warm news feed cache:", error);
  });
const STAFF_DEV_LOGIN_HIDDEN_CATEGORIES = new Set(["customers"]);
const hasActiveLogoutBarrier = () => {
  if (typeof window === "undefined") return false;
  const raw = window.sessionStorage.getItem(LOGOUT_BARRIER_STORAGE_KEY);
  const until = Number(raw);
  if (!Number.isFinite(until) || until <= 0) return false;
  if (until <= Date.now()) {
    window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
    return false;
  }
  return true;
};

const isSafeLocalRoute = (value) =>
typeof value === "string" &&
value.startsWith("/") &&
!value.startsWith("//") &&
!value.startsWith("/api/");

const normalizeLoginLookup = (value) =>
String(value || "").
toLowerCase().
replace(/\s+/g, " ").
trim();

const getRosterUserId = (user) => user?.id ?? user?.user_id ?? user?.identifier ?? null;

const getRosterUserName = (user = {}) =>
user.name ||
user.displayName ||
user.fullName ||
`${user.first_name || ""} ${user.last_name || ""}`.trim() ||
`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
"";

const getDefaultPostLoginRoute = (activeUser) => {
  const roles = [].
  concat(activeUser?.roles || []).
  concat(activeUser?.role ? [activeUser.role] : []).
  map((role) => String(role).toLowerCase());
  const isCustomer = roles.some((role) => role.includes("customer"));
  if (isCustomer) return DEFAULT_CUSTOMER_POST_LOGIN_ROUTE;
  return DEFAULT_STAFF_POST_LOGIN_ROUTE;
};

// /login is statically optimised (autoExport), so router.query starts EMPTY and
// is only filled once Next hydrates the query string. The post-login redirect can
// fire before that, which silently dropped ?redirectedFrom= and sent the user to
// the role default instead of the page they asked for. window.location is correct
// from the first render, so read that first and keep the router as the fallback
// (it is the only source during SSR).
const readRedirectedFrom = (router) => {
  if (typeof window !== "undefined") {
    const fromUrl = new URLSearchParams(window.location.search).get("redirectedFrom");
    if (fromUrl) return fromUrl;
  }
  const fromRouter = router?.query?.redirectedFrom;
  return typeof fromRouter === "string" ? fromRouter : null;
};

const getPostLoginRoute = (router, activeUser) => {
  const redirectedFrom = readRedirectedFrom(router);
  const defaultRoute = getDefaultPostLoginRoute(activeUser);

  // The customer site keeps its own simpler rule: it has no staff manifest to
  // authorise against, and its only protected surface is the profile page.
  if (defaultRoute === DEFAULT_CUSTOMER_POST_LOGIN_ROUTE) {
    return isSafeLocalRoute(redirectedFrom) ? redirectedFrom : defaultRoute;
  }

  // Staff: return the user to the page they were actually on. Precedence is
  // requested route > remembered route > role default, and EVERY candidate is
  // re-checked against this user's own permissions (see returnRoute.js), so a
  // carried-over or remembered route can never widen access. The sidebar-access
  // snapshot is not loaded yet at this point; a null snapshot resolves to the
  // role-derived set and PageAccessGuard still polices the route after landing.
  const roles = []
    .concat(activeUser?.roles || [])
    .concat(activeUser?.role ? [activeUser.role] : []);
  return resolveReturnRoute({
    redirectedFrom: typeof redirectedFrom === "string" ? redirectedFrom : null,
    remembered: readRememberedStaffRoute(activeUser?.id ?? activeUser?.user_id ?? null),
    roles,
    fallback: defaultRoute,
  });
};

const prepareAuthenticatedLayoutEntrance = (target) => {
  if (typeof window === "undefined") return;
  if (target === DEFAULT_CUSTOMER_POST_LOGIN_ROUTE || target.startsWith("/website/")) {
    window.sessionStorage.removeItem(AUTH_LAYOUT_ENTRANCE_STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(AUTH_LAYOUT_ENTRANCE_STORAGE_KEY, "1");
};

const clearAuthenticatedLayoutEntrance = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(AUTH_LAYOUT_ENTRANCE_STORAGE_KEY);
};

const warmAuthenticatedShell = (userId) =>
  import("@/lib/shell/bootstrapClient")
    .then(({ getShellBootstrap }) => getShellBootstrap({ userKey: userId ?? null }))
    .catch(() => null);

const LoginCard = ({
  title,
  subtitle,
  children,
  contentMaxWidth = FIELD_MAX_WIDTH,
  className = ""
}) =>
<div
  className={["login-card", className].filter(Boolean).join(" ")}
  style={{ width: "100%", display: "flex", justifyContent: "center" }}>
  
    <LayerSurface
    radius="var(--radius-xl)"
    padding="2.25rem"
    style={{
      boxShadow: "var(--shadow-xl)",
      width: "100%",
      maxWidth: contentMaxWidth + 72
    }}>
    
      <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        textAlign: "center"
      }}>
      
        <h2
        style={{
          color: "var(--text-1)",
          fontSize: "1.5rem",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          margin: 0
        }}>
        
          {title}
        </h2>
        {subtitle &&
      <p
        style={{
          color: "var(--text-1)",
          fontSize: "0.95rem",
          margin: 0
        }}>
        
            {subtitle}
          </p>
      }
      </div>
      <div
      className="login-card-inner"
      style={{ maxWidth: contentMaxWidth, margin: "24px auto 0" }}>
      
        {children}
      </div>
    </LayerSurface>
  </div>;


export default function LoginPage() {
  const allowDevUserSelection = !isPresentationMode() && canShowDevLogin();
  const { data: session, status: sessionStatus } = useSession();
  // Safe destructuring from context
  const userContext = useUser();
  const user = userContext?.user;
  const dbUserId = userContext?.dbUserId;
  const devLogin = userContext?.devLogin;
  const logout = userContext?.logout;
  const logoutInProgress = userContext?.logoutInProgress;
  const [rosterState, setRosterState] = useState(EMPTY_LOGIN_ROSTER);
  const {
    usersByRole,
    usersByRoleDetailed,
    allUsers,
    isLoading: rosterLoading
  } = rosterState;
  const { setTemporaryOverride, commitUserTheme } = useTheme();

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [loginFullName, setLoginFullName] = useState("");
  const [loginUserId, setLoginUserId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDevUsers, setLoadingDevUsers] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetStatusType, setResetStatusType] = useState("info");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const devLoginInProgressRef = useRef(false);
  const redirectInProgressRef = useRef(
    typeof window !== "undefined" &&
      window.sessionStorage.getItem(LOGIN_REDIRECT_IN_PROGRESS_STORAGE_KEY) === "1"
  );
  const finalizedPendingLogoutRef = useRef(false);
  const setRedirectInProgress = React.useCallback((inProgress) => {
    redirectInProgressRef.current = inProgress;
    if (typeof window === "undefined") return;
    if (inProgress) {
      window.sessionStorage.setItem(LOGIN_REDIRECT_IN_PROGRESS_STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(LOGIN_REDIRECT_IN_PROGRESS_STORAGE_KEY);
    }
  }, []);

  useTraceMount("LoginPage");
  useTraceValue("login.isRedirecting", isRedirecting);
  useTraceValue("login.sessionStatus", sessionStatus);

  useEffect(() => {
    clearAuthenticatedLayoutEntrance();
  }, []);

  useEffect(() => {
    if (!allowDevUserSelection) {
      setRosterState((current) => ({ ...current, isLoading: false }));
      return undefined;
    }

    const controller = new AbortController();
    const load = () => {
      void fetchLoginRoster(controller.signal)
        .then((data) => {
          setRosterState({
            usersByRole: data.usersByRole || {},
            usersByRoleDetailed: data.usersByRoleDetailed || {},
            allUsers: data.allUsers || [],
            isLoading: false,
          });
        })
        .catch((error) => {
          if (error.name === "AbortError") return;
          logFailure("Failed to load developer login roster", error);
          setRosterState((current) => ({ ...current, isLoading: false }));
        });
    };
    const idleId = typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(load, { timeout: 1200 })
      : null;
    const timerId = idleId === null ? window.setTimeout(load, 0) : null;

    return () => {
      controller.abort();
      if (idleId !== null) window.cancelIdleCallback(idleId);
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [allowDevUserSelection]);

  useEffect(() => {
    // Warm the default staff landing-page bundle while credentials are entered,
    // so successful login does not wait for the news-feed JavaScript chunk.
    void router.prefetch(DEFAULT_STAFF_POST_LOGIN_ROUTE);
  }, [router]);

  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => {
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  const loginRoleCategories = React.useMemo(() => {
    const categories = roleCategories || {};
    const seen = new Map();
    const normalizedCategory = {};

    Object.entries(categories).forEach(([category, roles]) => {
      if (STAFF_DEV_LOGIN_HIDDEN_CATEGORIES.has(normalizeLoginLookup(category))) {
        return;
      }

      const nextRoles = [];
      (roles || []).forEach((role) => {
        const key = String(role).toLowerCase();
        if (key.includes("customer")) return;
        if (!seen.has(key)) {
          seen.set(key, role);
          nextRoles.push(role);
        }
      });
      if (nextRoles.length) {
        normalizedCategory[category] = nextRoles;
      }
    });

    return normalizedCategory;
  }, []);

  const loginLookupUsers = React.useMemo(
    () =>
    (Array.isArray(allUsers) ? allUsers : []).
    map((rosterUser) => ({
      ...rosterUser,
      id: getRosterUserId(rosterUser),
      name: getRosterUserName(rosterUser),
      email: rosterUser.email || ""
    })),
    [allUsers]
  );

  const syncLoginIdentityFields = React.useCallback((rosterUser) => {
    setLoginFullName(rosterUser?.name || "");
    setLoginUserId(rosterUser?.id ? String(rosterUser.id) : "");
    setEmail(rosterUser?.email || "");
  }, []);

  const resolveLoginIdentityMatch = React.useCallback((field, value) => {
    const normalized = normalizeLoginLookup(value);
    if (!normalized) return null;

    return loginLookupUsers.find((rosterUser) => {
      if (field === "id") {
        return String(rosterUser.id ?? "").trim() === String(value).trim();
      }
      if (field === "email") {
        return normalizeLoginLookup(rosterUser.email) === normalized;
      }
      return normalizeLoginLookup(rosterUser.name) === normalized;
    }) || null;
  }, [loginLookupUsers]);

  const handleLoginIdentityInput = React.useCallback((field, value) => {
    if (field === "name") setLoginFullName(value);
    if (field === "id") setLoginUserId(value);
    if (field === "email") setEmail(value);

    const match = resolveLoginIdentityMatch(field, value);
    if (match) {
      syncLoginIdentityFields(match);
    }
  }, [resolveLoginIdentityMatch, syncLoginIdentityFields]);

  const handlePresentationSelect = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("presentation:returnTo", "/login");
    }
    router.push("/loginPresentation");
  }, [router]);

  // Phase 8 — Developer Platform login. Mints the strict `dev` role via the
  // NextAuth credentials provider (server-gated by isDevAuthAllowed()), then
  // lands on the /dev platform home. No user/department is chosen — the role is
  // synthetic and created in code, never assigned to a real staff member.
  const handleDevPlatformSelect = React.useCallback(async () => {
    if (!allowDevUserSelection) {
      setErrorMessage("Developer login is disabled in this environment.");
      return;
    }
    if (devLoginInProgressRef.current) return;
    devLoginInProgressRef.current = true;
    setRedirectInProgress(true);
    setIsRedirecting(true);
    setErrorMessage("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
      window.localStorage.removeItem("devUser");
      document.cookie = "hnp-dev-roles=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    const result = await signIn("credentials", {
      devPlatform: "1",
      callbackUrl: "/dev",
      redirect: false,
    });
    if (result?.error || !result?.ok) {
      setErrorMessage("Developer Platform login is disabled in this environment.");
      devLoginInProgressRef.current = false;
      setRedirectInProgress(false);
      setIsRedirecting(false);
      return;
    }
    prepareAuthenticatedLayoutEntrance("/dev");
    await warmAuthenticatedShell("dev-platform");
    const navigated = await router.replace("/dev");
    setRedirectInProgress(false);
    if (!navigated) {
      clearAuthenticatedLayoutEntrance();
      setIsRedirecting(false);
      setRedirectInProgress(false);
    }
  }, [allowDevUserSelection, router, setRedirectInProgress]);

  // "All access" demo login. Mints the synthetic `all access` role via the
  // NextAuth credentials provider (server-gated by isDevAuthAllowed()), then
  // lands on the normal staff home. No user or department is chosen — the role
  // is created in code and never assigned to a real staff member. It exists so
  // the app can be shown end to end from one login, with every module and page
  // in the sidebar, instead of signing in as a different user per department.
  const handleAllAccessLogin = React.useCallback(async () => {
    if (!allowDevUserSelection) {
      setErrorMessage("All access login is disabled in this environment.");
      return;
    }
    if (devLoginInProgressRef.current) return;
    devLoginInProgressRef.current = true;
    setRedirectInProgress(true);
    setIsRedirecting(true);
    setErrorMessage("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
      window.localStorage.removeItem("devUser");
      document.cookie = "hnp-dev-roles=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    const result = await signIn("credentials", {
      allAccess: "1",
      callbackUrl: DEFAULT_STAFF_POST_LOGIN_ROUTE,
      redirect: false,
    });
    if (result?.error || !result?.ok) {
      setErrorMessage("All access login is disabled in this environment.");
      devLoginInProgressRef.current = false;
      setRedirectInProgress(false);
      setIsRedirecting(false);
      return;
    }
    prepareAuthenticatedLayoutEntrance(DEFAULT_STAFF_POST_LOGIN_ROUTE);
    void warmStaffLandingPage();
    // The demo account has a real users row, so the session carries its numeric
    // id. Read it back and warm the same per-user caches an ordinary login does,
    // so the profile, clock and message badge are ready on arrival.
    const refreshedSession = await getSession();
    const demoUserId = refreshedSession?.user?.id ?? ALL_ACCESS_USER_ID;
    const numericDemoId = Number(demoUserId);
    await Promise.all([
      Number.isInteger(numericDemoId) && numericDemoId > 0
        ? commitUserTheme(numericDemoId)
        : Promise.resolve(),
      warmAuthenticatedShell(demoUserId),
    ]);
    const navigated = await router.replace(DEFAULT_STAFF_POST_LOGIN_ROUTE);
    setRedirectInProgress(false);
    if (!navigated) {
      clearAuthenticatedLayoutEntrance();
      setIsRedirecting(false);
      setRedirectInProgress(false);
    }
  }, [allowDevUserSelection, commitUserTheme, router, setRedirectInProgress]);

  // Developer login routes through NextAuth's credentials provider with the
  // picked user's database id. Server-side Supabase access is reliable, so the
  // session reflects exactly the user that was chosen in the dropdown.
  const handleDevLogin = async (loginTarget = {}) => {
    if (!allowDevUserSelection) {
      setErrorMessage("Developer login is disabled in this environment.");
      return;
    }

    if (devLoginInProgressRef.current) return;

    const targetCategory = loginTarget.category || selectedCategory;
    const targetDepartment = loginTarget.department || selectedDepartment;
    const targetUser = loginTarget.user || selectedUser;

    if (!targetCategory || !targetDepartment || !targetUser) {
      alert("Please select an area, department, and user.");
      return;
    }
    devLoginInProgressRef.current = true;
    setRedirectInProgress(true);
    setIsRedirecting(true);
    setErrorMessage("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
    }

    const userId =
    targetUser?.id ?? targetUser?.user_id ?? targetUser?.identifier ?? null;
    const numericId = Number(userId);
    const target = getPostLoginRoute(router, targetUser);

    // Wipe any stale dev-session artefacts so the new signIn starts cleanly.
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("devUser");
      document.cookie = "hnp-dev-roles=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    if (Number.isFinite(numericId) && numericId > 0) {
      trace("login", "devLogin: signIn start", { numericId, target });
      const result = await signIn("credentials", {
        userId: String(numericId),
        callbackUrl: target,
        redirect: false
      });

      if (result?.error || !result?.ok) {
        trace("login", "devLogin: signIn FAILED");
        setErrorMessage("Developer login failed. Session was not created.");
        devLoginInProgressRef.current = false;
        setRedirectInProgress(false);
        setIsRedirecting(false);
        return;
      }

      trace("login", "devLogin: signIn ok -> prepare authenticated layout", target);
      prepareAuthenticatedLayoutEntrance(target);
      // Resolve the destination user's saved theme and shell data while the
      // login view remains stable, so authenticated chrome can enter complete.
      void warmStaffLandingPage();
      await Promise.all([
        commitUserTheme(numericId),
        warmAuthenticatedShell(numericId),
      ]);
      // Client-side navigation keeps the app shell + providers mounted — no
      // full document reload. signIn() above already issued the JWT cookie and
      // broadcast a session update, so NextAuth's useSession picks up the new
      // user without a hard reload (same path as the email/password login).
      trace("login", "devLogin: router.replace", target);
      const navigated = await router.replace(target);
      setRedirectInProgress(false);
      if (!navigated) {
        clearAuthenticatedLayoutEntrance();
        setIsRedirecting(false);
        setRedirectInProgress(false);
      }
      return;
    }

    // Fallback for users without a numeric DB id (e.g. roster strings).
    const result = await devLogin?.(targetUser, targetDepartment || targetCategory || "WORKSHOP");
    if (!result?.success) {
      setErrorMessage("Developer login failed. Session was not created.");
      devLoginInProgressRef.current = false;
      setRedirectInProgress(false);
      setIsRedirecting(false);
      return;
    }

    trace("login", "devLogin (fallback): prepare authenticated layout", target);
    prepareAuthenticatedLayoutEntrance(target);
    void warmStaffLandingPage();
    await Promise.all([
      commitUserTheme(userId),
      warmAuthenticatedShell(userId),
    ]);
    trace("login", "devLogin (fallback): router.replace", target);
    const navigated = await router.replace(target);
    setRedirectInProgress(false);
    if (!navigated) {
      clearAuthenticatedLayoutEntrance();
      setIsRedirecting(false);
      setRedirectInProgress(false);
    }
  };

  // Email/password login — routes through NextAuth CredentialsProvider
  const handleDbLogin = async (e) => {
    e.preventDefault();
    if (redirectInProgressRef.current) return;
    setRedirectInProgress(true);
    setIsRedirecting(true);
    setErrorMessage("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
    }
    try {
      const target = getPostLoginRoute(router, null);
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: target,
        redirect: false
      });

      if (result?.error) {
        setErrorMessage("User not found or incorrect password.");
        setRedirectInProgress(false);
        setIsRedirecting(false);
        return;
      }

      if (result?.ok) {
        const refreshedSession = await getSession();
        const resolvedTarget = getPostLoginRoute(router, refreshedSession?.user || null);
        trace("login", "dbLogin: signIn ok -> prepare authenticated layout", resolvedTarget);
        prepareAuthenticatedLayoutEntrance(resolvedTarget);
        if (resolvedTarget === DEFAULT_STAFF_POST_LOGIN_ROUTE) {
          void warmStaffLandingPage();
        }
        await Promise.all([
          commitUserTheme(),
          warmAuthenticatedShell(refreshedSession?.user?.id),
        ]);
        trace("login", "dbLogin: router.replace", resolvedTarget);
        const navigated = await router.replace(resolvedTarget);
        setRedirectInProgress(false);
        if (!navigated) {
          clearAuthenticatedLayoutEntrance();
          setIsRedirecting(false);
          setRedirectInProgress(false);
        }
        return;
      }
      setRedirectInProgress(false);
      setIsRedirecting(false);
    } catch (err) {
      logFailure("Login error:", err);
      setErrorMessage("Login failed, please try again.");
      clearAuthenticatedLayoutEntrance();
      setRedirectInProgress(false);
      setIsRedirecting(false);
    }
  };

  const openResetModal = () => {
    setResetEmail(email.trim());
    setResetStatus("");
    setResetStatusType("info");
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetStatus("");
    setResetStatusType("info");
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setResetStatus("");
    setResetStatusType("info");
    setIsResettingPassword(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          email: (resetEmail || email || "").trim()
        })
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = { success: false, message: `Request failed (${response.status}).` };
      }
      if (!response.ok || !payload?.success) {
        setResetStatus(payload?.message || "Password reset request failed.");
        setResetStatusType("error");
        return;
      }
      setResetStatus(payload?.message || "If an account exists, a reset link has been sent.");
      setResetStatusType("success");
    } catch (error) {
      setResetStatus(error?.message || "Password reset request failed.");
      setResetStatusType("error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Redirect once user is logged in (via NextAuth session or UserContext) + auto clock-in.
  // The login view stays mounted during the hand-off; the authenticated shell
  // only appears once its identity and saved navigation are ready.
  useEffect(() => {
    // The /login screen is also one of the Presentation deck slides. There the
    // synthetic demo user is always present, so this post-login redirect must
    // not fire — it would bounce the slide out of the presentation deck.
    if (isPresentationMode()) return;
    if (logoutInProgress || hasActiveLogoutBarrier()) return;
    const activeUser =
    user || (sessionStatus === "authenticated" && session?.user ? session.user : null);
    if (!activeUser) return;
    if (redirectInProgressRef.current) return;
    setRedirectInProgress(true);

    trace("login", "auto-redirect: active user detected", {
      username: activeUser.username,
      id: activeUser.id,
    });
    setIsRedirecting(true);

    const roles = [].
    concat(activeUser.roles || []).
    concat(activeUser.role ? [activeUser.role] : []).
    map((role) => String(role).toLowerCase());
    const isCustomer = roles.some((role) => role.includes("customer"));

    if (!isCustomer) {
      const clockIn = async () => {
        try {
          const userId = dbUserId || activeUser.id;
          const url = userId ? `/api/profile/clock?userId=${userId}` : "/api/profile/clock";
          const statusRes = await fetch(url, { credentials: "include" });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData?.data?.isClockedIn) {
              await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ action: "clock-in" })
              });
            }
          }
        } catch (err) {
          logFailure("Auto clock-in failed:", err);
        }
      };
      clockIn();
    }

    const target = getPostLoginRoute(router, activeUser);
    trace("login", "auto-redirect: commit theme, then router.replace", target);
    prepareAuthenticatedLayoutEntrance(target);
    if (!isCustomer) {
      void warmStaffLandingPage();
    }
    Promise.all([
      commitUserTheme(activeUser.id),
      isCustomer ? Promise.resolve(null) : warmAuthenticatedShell(activeUser.id),
    ]).finally(() => {
      trace("login", "auto-redirect: router.replace now", target);
      router.replace(target).then((navigated) => {
        setRedirectInProgress(false);
        if (navigated) return;
        clearAuthenticatedLayoutEntrance();
        setIsRedirecting(false);
        setRedirectInProgress(false);
      });
    });
  }, [user, session, sessionStatus, router, dbUserId, logoutInProgress, commitUserTheme, setRedirectInProgress]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (finalizedPendingLogoutRef.current) return;
    if (window.sessionStorage.getItem(PENDING_LOGOUT_STORAGE_KEY) !== "1") return;
    finalizedPendingLogoutRef.current = true;
    window.sessionStorage.removeItem(PENDING_LOGOUT_STORAGE_KEY);

    void (async () => {
      try {
        const url = dbUserId ? `/api/profile/clock?userId=${dbUserId}` : "/api/profile/clock";
        const statusRes = await fetch(url, { credentials: "include" });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData?.data?.isClockedIn) {
            await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ action: "clock-out" })
            });
          }
        }
      } catch (err) {
        logFailure("Auto clock-out on logout failed:", err);
      }
      await logout?.();
    })();
  }, [dbUserId, logout]);

  useEffect(() => {
    // ⚠️ Mock data found — replacing with Supabase query
    // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
    if (!rosterLoading) {
      setLoadingDevUsers(false);
    }
  }, [rosterLoading]);

  return <LoginPageUi view="section2" allowDevUserSelection={allowDevUserSelection} allUsers={allUsers} BrandLogo={BrandLogo} handleAllAccessLogin={handleAllAccessLogin} Button={Button} closeResetModal={closeResetModal} email={email} errorMessage={errorMessage} handleDbLogin={handleDbLogin} handleDevLogin={handleDevLogin} handleDevPlatformSelect={handleDevPlatformSelect} handleLoginIdentityInput={handleLoginIdentityInput} handlePasswordReset={handlePasswordReset} handlePresentationSelect={handlePresentationSelect} isRedirecting={isRedirecting} isResettingPassword={isResettingPassword} loadingDevUsers={loadingDevUsers} loginFullName={loginFullName} LoginCard={LoginCard} LoginDropdown={LoginDropdown} loginRoleCategories={loginRoleCategories} loginUserId={loginUserId} openResetModal={openResetModal} password={password} resetEmail={resetEmail} resetStatus={resetStatus} resetStatusType={resetStatusType} rosterLoading={rosterLoading} selectedCategory={selectedCategory} selectedDepartment={selectedDepartment} selectedUser={selectedUser} setPassword={setPassword} setResetEmail={setResetEmail} setSelectedCategory={setSelectedCategory} setSelectedDepartment={setSelectedDepartment} setSelectedUser={setSelectedUser} showResetModal={showResetModal} usersByRole={usersByRole} usersByRoleDetailed={usersByRoleDetailed} />;










































































































































































































































































































}

LoginPage.lightweightApp = true;
LoginPage.enableDevLogin = canShowDevLogin();
