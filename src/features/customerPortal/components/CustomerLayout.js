// ✅ Imports converted to use absolute alias "@/"
// file location: src/features/customerPortal/components/CustomerLayout.js
import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import CustomerSidebar from "@/features/customerPortal/components/CustomerSidebar";
import { PageContentSkeleton } from "@/components/ui/LoadingSkeleton";
import { useLoadingState } from "@/context/LoadingStateContext";
import { captureLayoutFingerprint, setLayoutFingerprint } from "@/lib/loading/layoutFingerprint";

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];

export default function CustomerLayout({ children }) {
  const router = useRouter();
  const { user, loading: userLoading, logout } = useUser();
  const { isLoading: isGlobalLoading } = useLoadingState();
  const contentRef = useRef(null);

  const roleList = []
    .concat(user?.roles || [])
    .concat(user?.role ? [user.role] : [])
    .map((role) => (role || "").toString().toUpperCase());
  const isCustomer = roleList.some((role) => CUSTOMER_ROLE_ALLOWLIST.includes(role));
  const isContentLoading = isGlobalLoading || userLoading || !user;

  // Same fingerprint capture pattern as Layout.js so the customer portal also
  // gets a skeleton that mirrors its real per-page grid on subsequent visits.
  useEffect(() => {
    if (isContentLoading) return undefined;
    if (typeof window === "undefined") return undefined;
    const el = contentRef.current;
    if (!el) return undefined;

    const route = router.asPath || router.pathname;
    let timeoutId = null;
    const rafId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        const fingerprint = captureLayoutFingerprint(el);
        if (fingerprint) setLayoutFingerprint(route, fingerprint);
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [isContentLoading, router.asPath, router.pathname]);

  if (!user) {
    return (
      <div className="customer-portal-shell flex items-center justify-center">
        <div className="customer-portal-card text-center" style={{ maxWidth: "32rem" }}>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Customer Portal</h1>
            <p className="text-[var(--text-secondary)]">
              Please log in with the email you used when booking your vehicle in.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2 font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isCustomer) {
    return (
      <div className="customer-portal-shell flex items-center justify-center px-4">
        <div className="customer-portal-card text-center" style={{ maxWidth: "32rem" }}>
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Restricted area</h1>
            <p className="text-[var(--text-secondary)]">
              This part of the platform is dedicated to customers only. Switch to a customer user
              through the developer login to preview the experience.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full bg-[var(--primary)] px-5 py-2 font-semibold text-white hover:bg-[var(--primary-dark)]"
            >
              Switch user
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const portalUrl =
    process.env.NEXT_PUBLIC_CUSTOMER_PORTAL_URL || "https://www.hpautomotive.co.uk";

  const handleLogout = async () => {
    await logout?.();
    router.replace("/login");
  };

  return (
    <div className="customer-portal-shell">
      <div className="customer-portal-layout">
        <CustomerSidebar />

        <div className="customer-portal-stack">
          <header className="customer-portal-card">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="customer-portal-card--muted">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                  Signed in
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                  {user.username || "Customer"}
                </p>
              </div>
              <div className="customer-portal-card--muted">
                <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                  Portal link
                </p>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex text-sm font-semibold text-[var(--primary-dark)] underline"
                >
                  Open website
                </a>
              </div>
              <div className="customer-portal-card--muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.65rem] uppercase tracking-[0.25em] text-[var(--primary)]">
                    Session
                  </p>
                  <span className="rounded-full border border-[var(--surface-light)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--danger)]">
                    VHC linked
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Active</p>
                  <button
                    onClick={handleLogout}
                    className="rounded-full bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-dark)]"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="customer-portal-stack" ref={contentRef}>
            {isContentLoading ? (
              <PageContentSkeleton route={router.asPath || router.pathname} />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
