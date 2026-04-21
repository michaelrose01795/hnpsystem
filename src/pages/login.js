// ✅ Connected to Supabase (frontend)
// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/login.js
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
import Button from "@/components/ui/Button";

const FIELD_MAX_WIDTH = 380;
const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const DEFAULT_STAFF_POST_LOGIN_ROUTE = "/newsfeed";
const DEFAULT_CUSTOMER_POST_LOGIN_ROUTE = "/customer";
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

const getDefaultPostLoginRoute = (activeUser) => {
  const roles = []
    .concat(activeUser?.roles || [])
    .concat(activeUser?.role ? [activeUser.role] : [])
    .map((role) => String(role).toLowerCase());
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

const LoginCard = ({
  title,
  subtitle,
  children,
  contentMaxWidth = FIELD_MAX_WIDTH,
  className = "",
}) => (
  <div
    className={["login-card", className].filter(Boolean).join(" ")}
    style={{ width: "100%", display: "flex", justifyContent: "center" }}
  >
    <div
      style={{
        borderRadius: "var(--radius-xl)",
        border: "1px solid rgba(15, 23, 42, 0.08)",
        background: "var(--surface)",
        boxShadow: "var(--shadow-xl)",
        padding: "2.25rem",
        width: "100%",
        maxWidth: contentMaxWidth + 72,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            color: "var(--text-primary)",
            fontSize: "1.5rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              color: "var(--text-secondary, #64748b)",
              fontSize: "0.95rem",
              margin: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="login-card-inner"
        style={{ maxWidth: contentMaxWidth, margin: "24px auto 0" }}
      >
        {children}
      </div>
    </div>
  </div>
);

export default function LoginPage() {
  const allowDevUserSelection = canShowDevLogin();
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
    isLoading: rosterLoading,
  } = useRoster();
  const { setTemporaryOverride } = useTheme();

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingDevUsers, setLoadingDevUsers] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStatus, setResetStatus] = useState("");
  const [resetStatusType, setResetStatusType] = useState("info");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [revertToken, setRevertToken] = useState("");
  const [showRevertPrompt, setShowRevertPrompt] = useState(false);
  const [isRevertingPassword, setIsRevertingPassword] = useState(false);
  const [showRevertResult, setShowRevertResult] = useState(false);
  const [revertResultType, setRevertResultType] = useState("success");
  const [revertResultMessage, setRevertResultMessage] = useState("");
  const [isRedirecting, setIsRedirecting] = useState(false);
  const finalizedPendingLogoutRef = useRef(false);

  useEffect(() => {
    setTemporaryOverride({ mode: "system", accent: "red" });
    return () => {
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  const loginRoleCategories = React.useMemo(() => {
    const rosterRoles = Object.keys(usersByRoleDetailed || usersByRole || {}).filter(Boolean);
    const categories = roleCategories || {};
    const seen = new Map();
    const normalizedCategory = {};

    Object.entries(categories).forEach(([category, roles]) => {
      const nextRoles = [];
      (roles || []).forEach((role) => {
        const key = String(role).toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, role);
          nextRoles.push(role);
        }
      });
      if (nextRoles.length) {
        normalizedCategory[category] = nextRoles;
      }
    });

    const missingRoles = [];
    rosterRoles.forEach((role) => {
      const key = String(role).toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, role);
        missingRoles.push(role);
      }
    });

    if (missingRoles.length) {
      normalizedCategory.Other = missingRoles.sort((a, b) => a.localeCompare(b));
    }

    return normalizedCategory;
  }, [usersByRole, usersByRoleDetailed]);

  // Developer login routes through NextAuth's credentials provider with the
  // picked user's database id. Server-side Supabase access is reliable, so the
  // session reflects exactly the user that was chosen in the dropdown.
  const handleDevLogin = async () => {
    if (!allowDevUserSelection) {
      setErrorMessage("Developer login is disabled in this environment.");
      return;
    }

    if (!selectedCategory || !selectedDepartment || !selectedUser) {
      alert("Please select an area, department, and user.");
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(LOGOUT_BARRIER_STORAGE_KEY);
    }

    const userId =
      selectedUser?.id ?? selectedUser?.user_id ?? selectedUser?.identifier ?? null;
    const numericId = Number(userId);
    const target = getPostLoginRoute(router, selectedUser);

    // Wipe any stale dev-session artefacts so the new signIn starts cleanly.
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("devUser");
      document.cookie = "hnp-dev-roles=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }

    if (Number.isFinite(numericId) && numericId > 0) {
      const result = await signIn("credentials", {
        userId: String(numericId),
        callbackUrl: target,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        setErrorMessage("Developer login failed. Session was not created.");
        return;
      }

      setIsRedirecting(true);
      // Hard navigation forces NextAuth to read the freshly-issued JWT cookie
      // and rebuilds the user/role context from the new session.
      window.location.assign(target);
      return;
    }

    // Fallback for users without a numeric DB id (e.g. roster strings).
    const result = await devLogin?.(selectedUser, selectedDepartment || selectedCategory || "WORKSHOP");
    if (!result?.success) {
      setErrorMessage("Developer login failed. Session was not created.");
      return;
    }

    setIsRedirecting(true);
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
        redirect: false,
      });

      if (result?.error) {
        setErrorMessage("User not found or incorrect password.");
        return;
      }

      if (result?.ok) {
        setIsRedirecting(true);
        await router.replace(target);
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMessage("Login failed, please try again.");
    }
  };

  const removeRevertTokenFromUrl = React.useCallback(() => {
    const { passwordResetToken, ...rest } = router.query || {};
    void passwordResetToken;
    router.replace({ pathname: "/login", query: rest }, undefined, { shallow: true });
  }, [router]);

  const openResetModal = () => {
    setResetEmail(email.trim());
    setResetPassword("");
    setResetStatus("");
    setResetStatusType("info");
    setShowResetModal(true);
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetPassword("");
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
          action: "reset",
          email: (resetEmail || email || "").trim(),
          newPassword: resetPassword,
        }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = { success: false, message: `Request failed (${response.status}).` };
      }
      if (!response.ok || !payload?.success) {
        setResetStatus(payload?.message || "Password reset failed.");
        setResetStatusType("error");
        return;
      }
      setResetStatus(payload?.message || "Password reset complete.");
      setResetStatusType(payload?.emailSent === false ? "error" : "success");
      setPassword("");
    } catch (error) {
      setResetStatus(error?.message || "Password reset failed.");
      setResetStatusType("error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handlePasswordRevertDecision = async (wasNotYou) => {
    if (!wasNotYou) {
      setShowRevertPrompt(false);
      removeRevertTokenFromUrl();
      return;
    }

    if (!revertToken) {
      setRevertResultType("error");
      setRevertResultMessage("The reset link is missing or invalid.");
      setShowRevertResult(true);
      setShowRevertPrompt(false);
      removeRevertTokenFromUrl();
      return;
    }

    setIsRevertingPassword(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revert",
          token: revertToken,
        }),
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = { success: false, message: `Request failed (${response.status}).` };
      }
      if (!response.ok || !payload?.success) {
        setErrorMessage(payload?.message || "Unable to revert password.");
        setRevertResultType("error");
        setRevertResultMessage(payload?.message || "Unable to revert password.");
        setShowRevertResult(true);
      } else {
        setErrorMessage("Password reverted to the previous password.");
        setRevertResultType("success");
        setRevertResultMessage("Password reverted successfully.");
        setShowRevertResult(true);
      }
    } catch (error) {
      setErrorMessage(error?.message || "Unable to revert password.");
      setRevertResultType("error");
      setRevertResultMessage(error?.message || "Unable to revert password.");
      setShowRevertResult(true);
    } finally {
      setIsRevertingPassword(false);
      setShowRevertPrompt(false);
      setRevertToken("");
      removeRevertTokenFromUrl();
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

    setIsRedirecting(true);

    const roles = []
      .concat(activeUser.roles || [])
      .concat(activeUser.role ? [activeUser.role] : [])
      .map((role) => String(role).toLowerCase());
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
                body: JSON.stringify({ action: "clock-in" }),
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
    router.replace(target);
  }, [user, session, sessionStatus, router, dbUserId, logoutInProgress]);

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
              body: JSON.stringify({ action: "clock-out" }),
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

  useEffect(() => {
    if (!router.isReady) return;
    const token = router.query?.passwordResetToken;
    if (!token || typeof token !== "string") return;
    setRevertToken(token);
    setShowRevertPrompt(true);
  }, [router.isReady, router.query]);

  if (isRedirecting) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="login-page-wrapper">
        <div className="login-center-stage">
          <div className="login-brand">
            <BrandLogo alt="HP Automotive" className="login-logo" />
          </div>
          <LoginCard
            className="login-card--auth"
            title="Login"
          >
            <form onSubmit={handleDbLogin} className="login-form">
              <div className="login-field">
                <label htmlFor="email" className="login-label">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="email@humphriesandpark.co.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="app-input"
                  required
                />
              </div>

              <div className="login-field">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="app-input"
                  required
                />
              </div>

              {errorMessage && (
                <p className="login-error" role="alert">
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                variant="primary"
                style={{ width: "100%" }}
              >
                Login
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={openResetModal}
                style={{ alignSelf: "center", marginTop: "8px" }}
              >
                Reset password
              </Button>
            </form>
          </LoginCard>
        </div>
        {allowDevUserSelection && (
          <div className="login-dev-panel">
            <LoginCard
              className="login-card--dev"
              title="Developer Login"
            >
              <div className="login-dev-content">
                <LoginDropdown
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  selectedDepartment={selectedDepartment}
                  setSelectedDepartment={setSelectedDepartment}
                  selectedUser={selectedUser}
                  setSelectedUser={setSelectedUser}
                  allUsers={allUsers}
                  usersByRole={usersByRole}
                  usersByRoleDetailed={usersByRoleDetailed}
                  roleCategories={loginRoleCategories}
                />

                <p
                  className={[
                    "login-loading-text",
                    !(loadingDevUsers || rosterLoading) ? "is-hidden" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  Loading database users for dev login...
                </p>


                <Button
                  type="button"
                  onClick={handleDevLogin}
                  variant="primary"
                  style={{ width: "100%" }}
                >
                  Dev Login
                </Button>
              </div>
            </LoginCard>
          </div>
        )}
      </div>
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1400,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "none",
              padding: "18px",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--text-primary)" }}>
              Reset Password
            </h3>
            <p style={{ margin: "8px 0 14px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              Enter your email and your new password.
            </p>
            <form onSubmit={handlePasswordReset} style={{ display: "grid", gap: "10px" }}>
              <input
                type="email"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
                placeholder="Email"
                required
                className="app-input"
              />
              <input
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                placeholder="New password"
                required
                className="app-input"
              />
              {resetStatus && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.8rem",
                    color:
                      resetStatusType === "error"
                        ? "var(--danger)"
                        : resetStatusType === "success"
                        ? "var(--success)"
                        : "var(--text-secondary)",
                  }}
                >
                  {resetStatus}
                </p>
              )}
              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={closeResetModal}
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showRevertPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1450,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "none",
              padding: "18px",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text-primary)" }}>
              Are you sure this wasn't you?
            </h3>
            <p style={{ margin: "8px 0 14px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              If you click "Yes, it wasn't me", your previous password will be restored.
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handlePasswordRevertDecision(false)}
                disabled={isRevertingPassword}
              >
                No, this was me
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => handlePasswordRevertDecision(true)}
                disabled={isRevertingPassword}
              >
                {isRevertingPassword ? "Reverting..." : "Yes, it wasn't me"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showRevertResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1460,
            padding: "16px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              background: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "none",
              borderTop: "4px solid #b91c1c",
              padding: "22px",
              boxShadow: "var(--shadow-xl)",
              textAlign: "center",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--text-primary)" }}>
              {revertResultType === "success" ? "Password Reverted" : "Password Revert Failed"}
            </h3>
            <p style={{ margin: "10px 0 18px", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              {revertResultMessage}
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowRevertResult(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
