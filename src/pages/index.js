// file location: src/pages/index.js
import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import BrandLogo from "@/components/BrandLogo";

export default function HomeRedirect() {
  const router = useRouter(); // get the Next.js router
  const { user, loading } = useUser();

  const redirectTarget = useMemo(() => {
    if (!user) return "/login";
    const roles = []
      .concat(user.roles || [])
      .concat(user.role ? [user.role] : [])
      .map((role) => String(role).toLowerCase());
    return roles.some((role) => role.includes("customer")) ? "/customer" : "/newsfeed";
  }, [user]);

  useEffect(() => {
    if (loading) return;
    router.replace(redirectTarget);
  }, [router, redirectTarget, loading]);

  // Optional loading screen while redirecting
  return (
    <div className="redirect-screen" role="status" aria-live="polite">
      <div className="redirect-card">
        <div className="login-brand redirect-brand" aria-hidden="true">
          <BrandLogo alt="" className="login-logo" />
        </div>
        <div className="redirect-spinner" aria-hidden="true"></div>
        <div className="redirect-copy">
          <p className="redirect-kicker">
            {loading ? "Checking session" : "Signing you in"}
          </p>
          <h2 className="redirect-title">
            {loading
              ? "Loading your account..."
              : redirectTarget === "/login"
              ? "Redirecting to login..."
              : ""}
          </h2>
          <p className="redirect-sub">Just a moment while we get things ready.</p>
        </div>
        <div className="redirect-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  );
}
