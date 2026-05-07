// file location: src/features/customerPortal/components/CustomerLayout.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import CustomerSidebar from "@/features/customerPortal/components/CustomerSidebar";
import CustomerNavShell from "@/features/customerPortal/components/CustomerNavShell";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";

const CUSTOMER_ROLE_ALLOWLIST = ["CUSTOMER"];

function PortalShell({ children }) {
  return (
    <DevLayoutSection
      sectionKey="customer-portal-shell"
      sectionType="page-shell"
      shell
      backgroundToken="customer-portal-shell"
      className="app-page-shell"
      style={{
        minHeight: "100dvh",
        background: "var(--page-shell-bg)",
        padding: "var(--page-gutter-y) var(--page-gutter-x)",
        boxSizing: "border-box",
      }}
    >
      <DevLayoutSection
        sectionKey="customer-portal-content-width"
        parentKey="customer-portal-shell"
        sectionType="section-shell"
        backgroundToken="customer-portal-content-width"
        style={{
          width: "min(100%, var(--page-width-content, 1280px))",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--page-stack-gap)",
        }}
      >
        {children}
      </DevLayoutSection>
    </DevLayoutSection>
  );
}

function PortalCenteredCard({ children }) {
  return (
    <PortalShell>
      <div
        style={{
          flex: 1,
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
        }}
      >
        <LayerSurface
          radius="var(--page-card-radius)"
          padding="var(--page-card-padding)"
          style={{ width: "100%", maxWidth: "32rem", textAlign: "center" }}
        >
          {children}
        </LayerSurface>
      </div>
    </PortalShell>
  );
}

export default function CustomerLayout({ children }) {
  const router = useRouter();
  const { user, loading: userLoading, logout } = useUser();

  const roleList = []
    .concat(user?.roles || [])
    .concat(user?.role ? [user.role] : [])
    .map((role) => (role || "").toString().toUpperCase());
  const isCustomer = roleList.some((role) => CUSTOMER_ROLE_ALLOWLIST.includes(role));

  if (userLoading) {
    return (
      <PortalShell>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--page-stack-gap)",
            width: "100%",
          }}
        >
          <CustomerSidebar />
          <div style={{ width: "100%" }}>
            <PageSkeleton />
          </div>
        </div>
      </PortalShell>
    );
  }

  if (!user) {
    return (
      <PortalCenteredCard>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "var(--text-1)",
              margin: 0,
            }}
          >
            Customer Portal
          </h1>
          <p style={{ color: "var(--text-1)", margin: 0 }}>
            Please log in with the email you used when booking your vehicle in.
          </p>
          <div>
            <Link
              href="/login"
              className="app-btn app-btn--primary"
              style={{ display: "inline-flex" }}
            >
              Go to login
            </Link>
          </div>
        </div>
      </PortalCenteredCard>
    );
  }

  if (!isCustomer) {
    return (
      <PortalCenteredCard>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "var(--text-1)",
              margin: 0,
            }}
          >
            Restricted area
          </h1>
          <p style={{ color: "var(--text-1)", margin: 0 }}>
            This part of the platform is dedicated to customers only. Switch to a customer user
            through the developer login to preview the experience.
          </p>
          <div>
            <Link
              href="/login"
              className="app-btn app-btn--primary"
              style={{ display: "inline-flex" }}
            >
              Switch user
            </Link>
          </div>
        </div>
      </PortalCenteredCard>
    );
  }

  const portalUrl = "https://www.humphriesandparks.net/";

  const handleLogout = async () => {
    await logout?.();
    router.replace("/login");
  };

  // Layout pattern follows the canonical hierarchy:
  //   .app-page-shell → LayerSurface (page card) → app-page-stack → LayerTheme (section card)
  // CustomerNavShell renders a left-rail sidebar on lg+ and a Menu/drawer on
  // smaller screens; the main column owns whatever width is left over.
  return (
    <PortalShell>
      <DevLayoutSection
        sectionKey="customer-portal-layout-grid"
        parentKey="customer-portal-content-width"
        sectionType="section-shell"
        backgroundToken="customer-portal-layout-grid"
        className="customer-portal-layout-grid"
      >
        <CustomerNavShell />

        <LayerSurface
          sectionKey="customer-portal-page-card"
          parentKey="customer-portal-layout-grid"
          sectionType="content-card"
          radius="var(--page-card-radius)"
          padding="var(--page-card-padding)"
          gap="var(--page-stack-gap)"
          style={{ flex: 1, minWidth: 0 }}
        >
          <LayerTheme
            sectionKey="customer-portal-header"
            parentKey="customer-portal-page-card"
            sectionType="content-card"
            radius="var(--section-card-radius)"
            padding="var(--section-card-padding)"
          >
            <div
              style={{
                display: "grid",
                gap: "var(--space-4)",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <LayerSurface
                sectionKey="customer-portal-header-signed-in"
                parentKey="customer-portal-header"
                sectionType="content-card"
                radius="var(--radius-md)"
                padding="var(--space-4)"
                gap="var(--space-1)"
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.25em",
                    color: "var(--text-accent)",
                    margin: 0,
                  }}
                >
                  Signed in
                </p>
                <p
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--text-1)",
                    margin: 0,
                    wordBreak: "break-word",
                  }}
                >
                  {user.username || "Customer"}
                </p>
              </LayerSurface>

              <LayerSurface
                sectionKey="customer-portal-header-link"
                parentKey="customer-portal-header"
                sectionType="content-card"
                radius="var(--radius-md)"
                padding="var(--space-4)"
                gap="var(--space-2)"
              >
                <p
                  style={{
                    fontSize: "0.65rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.25em",
                    color: "var(--text-accent)",
                    margin: 0,
                  }}
                >
                  Portal link
                </p>
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="app-btn app-btn--secondary"
                  style={{ alignSelf: "flex-start" }}
                >
                  Open website
                </a>
              </LayerSurface>

              <LayerSurface
                sectionKey="customer-portal-header-session"
                parentKey="customer-portal-header"
                sectionType="content-card"
                radius="var(--radius-md)"
                padding="var(--space-4)"
                gap="var(--space-2)"
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.65rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.25em",
                      color: "var(--text-accent)",
                      margin: 0,
                    }}
                  >
                    Session
                  </p>
                  <span className="app-badge app-badge--accent-soft">VHC linked</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--text-1)",
                      margin: 0,
                    }}
                  >
                    Active
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="app-btn app-btn--primary"
                  >
                    Logout
                  </button>
                </div>
              </LayerSurface>
            </div>
          </LayerTheme>

          <DevLayoutSection
            sectionKey="customer-portal-page-stack"
            parentKey="customer-portal-page-card"
            sectionType="page-shell"
            backgroundToken="customer-portal-page-stack"
            className="app-page-stack"
            style={{ width: "100%", minWidth: 0 }}
          >
            {children}
          </DevLayoutSection>
        </LayerSurface>
      </DevLayoutSection>
    </PortalShell>
  );
}
