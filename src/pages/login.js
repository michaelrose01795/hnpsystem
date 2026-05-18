// file location: src/pages/login.js
// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
import React, { useState, useEffect, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import { useRouter } from "next/router";
import LoginDropdown from "@/components/LoginDropdown";
import BrandLogo from "@/components/BrandLogo";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { roleCategories } from "@/config/users"; // Dev users config
import { useTheme } from "@/styles/themeProvider";
import { canShowDevLogin } from "@/lib/dev-tools/config";
import { isPresentationMode } from "@/features/presentation/runtime/presentationMode";
import { buildRosterPayload, EMPTY_ROSTER_PAYLOAD } from "@/lib/users/rosterPayload";
import Button from "@/components/ui/Button";
import LayerSurface from "@/components/ui/LayerSurface";
import LoginPageUi from "@/components/page-ui/login-ui"; // Extracted presentation layer.
import { trace, useTraceMount, useTraceValue } from "@/utils/loadTrace"; // TEMP diagnostic tracer — remove after load flicker is fixed

const FIELD_MAX_WIDTH = 380;
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const LOGIN_SHELL_LOADING_EVENT = "hnp:login-shell-loading";
const LOGIN_SHELL_LOADING_STORAGE_KEY = "hnp-login-shell-loading";
const DEFAULT_STAFF_POST_LOGIN_ROUTE = "/newsfeed";
const DEFAULT_CUSTOMER_POST_LOGIN_ROUTE = "/customer";
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
  return isCustomer ? DEFAULT_CUSTOMER_POST_LOGIN_ROUTE : DEFAULT_STAFF_POST_LOGIN_ROUTE;
};

const getPostLoginRoute = (router, activeUser) => {
  const redirectedFrom = router?.query?.redirectedFrom;
  if (isSafeLocalRoute(redirectedFrom)) {
    return redirectedFrom;
  }
  return getDefaultPostLoginRoute(activeUser);
};

const showAppShellLoading = () => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LOGIN_SHELL_LOADING_STORAGE_KEY, "1");
  window.dispatchEvent(new Event(LOGIN_SHELL_LOADING_EVENT));
};

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
          color: "var(--text-1, #64748b)",
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
  const {
    usersByRole,
    usersByRoleDetailed,
    allUsers,
    isLoading: rosterLoading
  } = useRoster();
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
  const finalizedPendingLogoutRef = useRef(false);

  useTraceMount("LoginPage");
  useTraceValue("login.isRedirecting", isRedirecting);
  useTraceValue("login.sessionStatus", sessionStatus);

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
        return;
      }

      trace("login", "devLogin: signIn ok -> show shell loading");
      showAppShellLoading();
      setIsRedirecting(true);
      // Resolve + lock the destination user's saved theme while the loading
      // screen is showing, so the next page boots straight into it instead of
      // changing colour again once /newsfeed has mounted.
      await commitUserTheme(numericId);
      // Hard navigation forces NextAuth to read the freshly-issued JWT cookie
      // and rebuilds the user/role context from the new session.
      trace("login", "devLogin: hard navigation (window.location.assign)", target);
      window.location.assign(target);
      return;
    }

    // Fallback for users without a numeric DB id (e.g. roster strings).
    const result = await devLogin?.(targetUser, targetDepartment || targetCategory || "WORKSHOP");
    if (!result?.success) {
      setErrorMessage("Developer login failed. Session was not created.");
      devLoginInProgressRef.current = false;
      return;
    }

    trace("login", "devLogin (fallback): ok -> show shell loading", target);
    showAppShellLoading();
    setIsRedirecting(true);
    // Lock the destination user's saved theme in before navigating so the
    // colour settles once, on the loading screen.
    await commitUserTheme(userId);
    trace("login", "devLogin (fallback): router.replace", target);
    await router.replace(target);
  };

  // Email/password login — routes through NextAuth CredentialsProvider
  const handleDbLogin = async (e) => {
    e.preventDefault();
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
        return;
      }

      if (result?.ok) {
        trace("login", "dbLogin: signIn ok -> show shell loading", target);
        showAppShellLoading();
        setIsRedirecting(true);
        // Lock the destination user's saved theme in before navigating so the
        // colour settles once, on the loading screen.
        await commitUserTheme();
        trace("login", "dbLogin: router.replace", target);
        await router.replace(target);
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Login failed, please try again.");
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
  // While the redirect is in flight, the login page swaps in PageLoadingSkeleton so
  // the user sees the global loading style instead of a flash of the login form.
  useEffect(() => {
    if (logoutInProgress || hasActiveLogoutBarrier()) return;
    const activeUser =
    user || (sessionStatus === "authenticated" && session?.user ? session.user : null);
    if (!activeUser) return;

    trace("login", "auto-redirect: active user detected", {
      username: activeUser.username,
      id: activeUser.id,
    });
    showAppShellLoading();
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
          console.error("Auto clock-in failed:", err);
        }
      };
      clockIn();
    }

    const target = getPostLoginRoute(router, activeUser);
    trace("login", "auto-redirect: commit theme, then router.replace", target);
    // Lock the destination theme in before navigating so the colour settles
    // once, on the loading screen, instead of after the next page mounts.
    commitUserTheme(activeUser.id).finally(() => {
      trace("login", "auto-redirect: router.replace now", target);
      router.replace(target);
    });
  }, [user, session, sessionStatus, router, dbUserId, logoutInProgress, commitUserTheme]);

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
        console.error("Auto clock-out on logout failed:", err);
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

  if (isRedirecting) {
    return <LoginPageUi view="section1" PageSkeleton={PageSkeleton} />;
  }

  return <LoginPageUi view="section2" allowDevUserSelection={allowDevUserSelection} allUsers={allUsers} BrandLogo={BrandLogo} Button={Button} closeResetModal={closeResetModal} email={email} errorMessage={errorMessage} handleDbLogin={handleDbLogin} handleDevLogin={handleDevLogin} handleLoginIdentityInput={handleLoginIdentityInput} handlePasswordReset={handlePasswordReset} handlePresentationSelect={handlePresentationSelect} isResettingPassword={isResettingPassword} loadingDevUsers={loadingDevUsers} loginFullName={loginFullName} LoginCard={LoginCard} LoginDropdown={LoginDropdown} loginRoleCategories={loginRoleCategories} loginUserId={loginUserId} openResetModal={openResetModal} password={password} resetEmail={resetEmail} resetStatus={resetStatus} resetStatusType={resetStatusType} rosterLoading={rosterLoading} selectedCategory={selectedCategory} selectedDepartment={selectedDepartment} selectedUser={selectedUser} setPassword={setPassword} setResetEmail={setResetEmail} setSelectedCategory={setSelectedCategory} setSelectedDepartment={setSelectedDepartment} setSelectedUser={setSelectedUser} showResetModal={showResetModal} usersByRole={usersByRole} usersByRoleDetailed={usersByRoleDetailed} />;










































































































































































































































































































}

export async function getServerSideProps() {
  if (!canShowDevLogin()) {
    return { props: {} };
  }

  try {
    return {
      props: {
        initialRosterData: await buildRosterPayload(),
      },
    };
  } catch (error) {
    console.error("Failed to preload dev login roster", error);
    return {
      props: {
        initialRosterData: EMPTY_ROSTER_PAYLOAD,
      },
    };
  }
}
