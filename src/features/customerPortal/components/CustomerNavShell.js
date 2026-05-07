// file location: src/features/customerPortal/components/CustomerNavShell.js
// Responsive nav shell for the /customer pages ONLY. Separate from
// src/components/Sidebar.js so the customer portal's drawer/rail behaviour can
// evolve independently of the staff app shell.
//
// CSS-driven responsiveness (no JS gating of the visible sidebar):
//   - .customer-portal-nav-desktop  visible at >= 1024px, hidden below
//   - .customer-portal-nav-mobile   visible below 1024px, hidden at >= 1024px
// This way the desktop left-rail appears on first paint with no hydration
// flicker. The drawer open/close state is JS-only and applies on mobile.
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import CustomerSidebar from "@/features/customerPortal/components/CustomerSidebar";

export default function CustomerNavShell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleRouteChange = () => setIsOpen(false);
    router.events.on("routeChangeStart", handleRouteChange);
    return () => router.events.off("routeChangeStart", handleRouteChange);
  }, [router.events]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <>
      {/* Desktop: inline sticky left rail. Hidden on viewports below 1024px. */}
      <div className="customer-portal-nav-desktop">
        <CustomerSidebar />
      </div>

      {/* Mobile / tablet: full-width Menu button + slide-in drawer. */}
      <div className="customer-portal-nav-mobile">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="app-btn app-btn--primary"
          aria-expanded={isOpen}
          aria-controls="customer-portal-nav-drawer"
          style={{
            width: "100%",
            minHeight: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M2 4h12" />
            <path d="M2 8h12" />
            <path d="M2 12h12" />
          </svg>
          <span>Menu</span>
        </button>

        {isOpen && (
          <div
            id="customer-portal-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Customer portal navigation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 3500,
              display: "flex",
              alignItems: "stretch",
              justifyContent: "flex-start",
            }}
          >
            <div
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(var(--text-1-rgb, 0 0 0), 0.65)",
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                maxWidth: "min(100%, 360px)",
                height: "100%",
                background: "var(--page-shell-bg)",
                padding: "16px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="app-btn app-btn--secondary"
                  aria-label="Close navigation"
                  style={{ minHeight: "36px" }}
                >
                  Close
                </button>
              </div>
              <CustomerSidebar />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
