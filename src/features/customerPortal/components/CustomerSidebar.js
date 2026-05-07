// file location: src/features/customerPortal/components/CustomerSidebar.js
import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import { canShowDevSidebarItems } from "@/lib/dev-tools/config";
import LayerSurface from "@/components/ui/LayerSurface";
import BrandLogo from "@/components/BrandLogo";

const PRESENTATION_RETURN_TO_STORAGE_KEY = "presentation:returnTo";

const NAV_LINKS = [
  { href: "/customer", label: "Overview" },
  { href: "/customer/vhc", label: "VHC & Media" },
  { href: "/customer/vehicles", label: "My Vehicles" },
  { href: "/customer/parts", label: "Parts & Accessories" },
  { href: "/customer/payments", label: "Payments & Billing" },
  { href: "/customer/messages", label: "Messages" },
];

export default function CustomerSidebar() {
  const router = useRouter();
  const pathname = router.pathname;
  const { user, dbUserId } = useUser();
  const { unreadCount } = useMessagesBadge(dbUserId);
  const {
    canAccess: canUseDevOverlay,
    enabled: devOverlayEnabled,
    toggleEnabled: toggleDevOverlay,
  } = useDevLayoutOverlay();
  const canShowPresentation = canShowDevSidebarItems(user);
  const isPresentationActive = pathname.startsWith("/presentation");

  const handlePresentationClick = () => {
    if (typeof window !== "undefined") {
      const current = router?.asPath || "/customer";
      if (!current.startsWith("/presentation")) {
        window.sessionStorage.setItem(PRESENTATION_RETURN_TO_STORAGE_KEY, current);
      }
    }
    router.push("/presentation");
  };

  return (
    <LayerSurface
      as="aside"
      radius="var(--page-card-radius)"
      padding="0"
      gap="0"
      className="customer-portal-sidebar"
      style={{
        width: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          background: "var(--primary)",
          color: "var(--text-2)",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-2)",
          }}
        >
          Customer Portal
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 0",
          }}
        >
          <BrandLogo
            alt="Humphries &amp; Parks"
            style={{
              maxWidth: "100%",
              maxHeight: "96px",
              width: "auto",
              height: "auto",
              display: "block",
              background: "transparent",
            }}
          />
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          const isMessagesLink = link.href === "/customer/messages";
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 16px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  background: isActive ? "var(--primary)" : "var(--theme)",
                  color: isActive ? "var(--text-2)" : "var(--primary-selected)",
                  minHeight: "44px",
                }}
              >
                <span>{link.label}</span>
                {isMessagesLink && unreadCount > 0 && (
                  <span className="app-badge app-badge--control app-badge--accent-soft">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        {(canUseDevOverlay || canShowPresentation) && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "12px",
              position: "relative",
              zIndex: 10,
            }}
          >
            {canUseDevOverlay && (
              <button
                type="button"
                role="switch"
                aria-checked={devOverlayEnabled}
                aria-label={
                  devOverlayEnabled
                    ? "Turn dev layout overlay off"
                    : "Turn dev layout overlay on"
                }
                className={`app-btn app-btn--nav ${
                  devOverlayEnabled ? "app-btn--primary" : "app-btn--danger"
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleDevOverlay();
                }}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  position: "relative",
                  zIndex: 11,
                  pointerEvents: "auto",
                }}
              >
                <span>Dev Overlay</span>
                <span
                  aria-hidden="true"
                  style={{
                    fontWeight: 700,
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-pill)",
                    background: devOverlayEnabled
                      ? "rgba(255, 255, 255, 0.22)"
                      : "rgba(255, 255, 255, 0.18)",
                  }}
                >
                  {devOverlayEnabled ? "On" : "Off"}
                </span>
              </button>
            )}
            {canShowPresentation && (
              <button
                type="button"
                className={`app-btn app-btn--secondary app-btn--nav${
                  isPresentationActive ? " is-active" : ""
                }`}
                aria-current={isPresentationActive ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handlePresentationClick();
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  position: "relative",
                  zIndex: 11,
                  pointerEvents: "auto",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  style={{ flexShrink: 0, fill: "currentColor" }}
                >
                  <path d="M2 1 L9 5 L2 9 Z" />
                </svg>
                <span>Presentation</span>
              </button>
            )}
          </div>
        )}
      </div>
    </LayerSurface>
  );
}
