// file location: src/pages/index.js
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function HomeRedirect() {
  const router = useRouter(); // get the Next.js router

  useEffect(() => {
    router.replace("/login"); // immediately redirect to /login when page loads
  }, [router]);

  // Optional loading screen while redirecting
  return (
    <div className="redirect-screen" role="status" aria-live="polite">
      <div className="redirect-card">
        <div className="login-brand redirect-brand" aria-hidden="true">
          <img
            src="/images/logo/LightLogo.png"
            alt=""
            className="login-logo login-logo-light"
          />
          <img
            src="/images/logo/DarkLogo.png"
            alt=""
            className="login-logo login-logo-dark"
          />
        </div>
        <div className="redirect-spinner" aria-hidden="true"></div>
        <div className="redirect-copy">
          <p className="redirect-kicker">Signing you in</p>
          <h2 className="redirect-title">Redirecting to login...</h2>
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
