// file location: src/components/Sidebar.js
// Edit: Responsive improvements - mobile close button smaller and edge-aligned
"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { sidebarSections } from "@/config/navigation";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import BrandLogo from "@/components/BrandLogo";
import { useDevLayoutOverlay } from "@/context/DevLayoutOverlayContext";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";

const hiddenHrRoutes = new Set([
  "/hr/employees",
  "/hr/attendance",
  "/hr/payroll",
  "/hr/leave",
  "/hr/performance",
  "/hr/training",
  "/hr/disciplinary",
  "/hr/recruitment",
  "/hr/reports",
  "/hr/settings",
  "/admin/users",
]);

export default function Sidebar({
  onToggle,
  isCondensed = false,
  extraSections = [],
  visibleRoles = null,
  modeLabel: _modeLabel = null, // keep legacy prop available without rendering the old text block
}) {
  void _modeLabel;
  const router = useRouter();
  const pathname = (router.asPath || router.pathname || "").split("?")[0];
  const { user, dbUserId } = useUser();
  const { canAccess: canUseDevOverlay, enabled: devOverlayEnabled, toggleEnabled: toggleDevOverlay } =
    useDevLayoutOverlay();
  const { unreadCount } = useMessagesBadge(dbUserId);
  const derivedRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const userRoles =
    Array.isArray(visibleRoles) && visibleRoles.length > 0
      ? visibleRoles.map((role) => role.toLowerCase())
      : derivedRoles;
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) => {
    if (!shortcut.roles || shortcut.roles.length === 0) return true;
    return shortcut.roles.some((role) => userRoles.includes(role));
  });
  const headerLogoStyle = {
    width: "100%",
    height: "auto",
    maxHeight: isCondensed ? 180 : 210,
    objectFit: "contain",
    objectPosition: "center",
    display: "block",
  }; // oversized logo spans nearly the full header width while keeping proportions intact

  const groupedSections = useMemo(() => {
    const groups = { general: [], departments: [], account: [] };
    [...sidebarSections, ...extraSections].forEach((section) => {
      const category = section.category || "departments";
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(section);
    });
    return groups;
  }, [extraSections]);

  const hasAccess = (item) => {
    if (!item.roles || item.roles.length === 0) return true;
    // Check if any of the item's required roles match the user's roles (case-insensitive)
    const access = item.roles.some((requiredRole) =>
      userRoles.some((userRole) => userRole.toLowerCase() === requiredRole.toLowerCase())
    );

    return access;
  };
  const hasRestrictedJobSectionRole = userRoles.some(
    (role) => role === "techs" || role === "mot tester" || role === "valet service"
  );

  const filterAccessibleSections = (sections = []) =>
    sections
      .map((section) => ({
        ...section,
        items:
          hasRestrictedJobSectionRole && section.label === "Job Divisions"
            ? []
            : (section.items || []).filter(
                (item) =>
                  hasAccess(item) &&
                  (!item.href || !hiddenHrRoutes.has(item.href)) &&
                  !(hasRestrictedJobSectionRole && item.href === "/job-cards/archive")
              ),
      }))
      .filter((section) => section.items.length > 0);

  const generalSections = filterAccessibleSections(groupedSections.general);
  const departmentSections = filterAccessibleSections(groupedSections.departments);
  const accountSections = filterAccessibleSections(groupedSections.account);
  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        LOGOUT_BARRIER_STORAGE_KEY,
        String(Date.now() + LOGOUT_BARRIER_MS)
      );
      window.sessionStorage.setItem(PENDING_LOGOUT_STORAGE_KEY, "1");
      window.location.replace("/login");
      return;
    }
    router.replace("/login");
  };

  // Clock in/out state for sidebar button
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchClockStatus = async () => {
      try {
        const url = dbUserId ? `/api/profile/clock?userId=${dbUserId}` : "/api/profile/clock";
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload?.success) {
          setIsClockedIn(payload.data.isClockedIn);
        }
      } catch (err) {
        console.error("Failed to fetch clock status:", err);
      }
    };
    fetchClockStatus();
  }, [user, dbUserId]);

  const handleClockToggle = useCallback(async () => {
    setClockLoading(true);
    try {
      const action = isClockedIn ? "clock-out" : "clock-in";
      const url = dbUserId ? `/api/profile/clock?userId=${dbUserId}` : "/api/profile/clock";
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        setIsClockedIn(!isClockedIn);
      }
    } catch (err) {
      console.error("Clock toggle error:", err);
    } finally {
      setClockLoading(false);
    }
  }, [isClockedIn, dbUserId]);

  const renderLinkLabel = (label, href) => {
    const isMessagesItem = href === "/messages";
    if (!href) {
      return <span>{label}</span>;
    }
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span>{label}</span>
        {isMessagesItem && unreadCount > 0 && (
          <span
            style={{
              minWidth: 24,
              minHeight: 24,
              padding: "0 6px",
              borderRadius: 999,
              background: "var(--accentMain)",
              color: "var(--onAccentText)",
              fontSize: "0.75rem",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>
    );
  };

  const sidebarSectionKey = isCondensed ? "app-sidebar-shell-mobile" : "app-sidebar-shell";
  const sidebarHeaderKey = isCondensed ? "app-sidebar-header-mobile" : "app-sidebar-header";
  const sidebarBodyKey = isCondensed ? "app-sidebar-body-mobile" : "app-sidebar-body";

  return (
    <DevLayoutSection
      as="aside"
      sectionKey={sidebarSectionKey}
      sectionType="section-shell"
      shell
      backgroundToken="app-sidebar-shell"
      className="app-sidebar"
      style={{
        padding: "0",
        width: isCondensed ? "100%" : "260px",
        minWidth: isCondensed ? "auto" : "220px",
        height: isCondensed ? "auto" : "100%",
        minHeight: isCondensed ? "auto" : "100%",
        maxHeight: isCondensed ? "100%" : "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--page-card-radius)",
        boxShadow: "none",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "0",
        overflowX: "hidden",
        overflowY: isCondensed ? "visible" : "auto",
        flexShrink: 0,
        background: "var(--surface)",
      }}
    >
      {/* Header */}
      {/* Brand logo replaces the old Navigation/Workspace labels while keeping header spacing consistent. Background now follows the sidebar theme for both light/dark modes. */}
      <DevLayoutSection
        className="sidebar-logo-header app-sidebar__header"
        sectionKey={sidebarHeaderKey}
        parentKey={sidebarSectionKey}
        sectionType="content-card"
        backgroundToken="app-sidebar-header"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: isCondensed ? "60px" : "75px", // fix the height so the oversized logo crops vertically
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "1 1 auto",
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <BrandLogo
            alt="H&P logo"
            width={800}
            height={240}
            style={headerLogoStyle}
          />
        </div>
      </DevLayoutSection>

      {/* Navigation Content */}
      <DevLayoutSection
        className="app-sidebar__body"
        sectionKey={sidebarBodyKey}
        parentKey={sidebarSectionKey}
        sectionType="content-card"
        backgroundToken="app-sidebar-body"
        style={{
          background: "var(--surface)",
          flex: 1,
          minHeight: 0,
        }}
      >
        {dashboardShortcuts.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <div className="app-sidebar__section-title">
                My Dashboard
              </div>
              {onToggle && (
                <button
                  className="app-topbar-button app-topbar-button--secondary"
                  type="button"
                  onClick={onToggle}
                  aria-label="Close sidebar"
                  style={{
                    fontSize: "0.75rem",
                    boxShadow: "none",
                    minHeight: "32px",
                    padding: "4px 10px",
                  }}
                >
                  Close
                </button>
              )}
            </div>
            {dashboardShortcuts.map((shortcut) => {
              const isActive =
                pathname === shortcut.href || (pathname && pathname.startsWith(`${shortcut.href}/`));
              return (
                <Link
                  className={`app-sidebar__link${isActive ? " is-active" : ""}`}
                  key={shortcut.href}
                  href={shortcut.href}
                  title={shortcut.description}
                >
                  {shortcut.label}
                </Link>
              );
            })}
          </>
        )}

        {/* General Section */}
        {generalSections.length > 0 && (
          <>
            <div className="app-sidebar__section-title" style={{ marginBottom: "10px" }}>
              General
            </div>
            {generalSections.flatMap((section) => section.items).map((item) => {
              if (!item.href) return null;
              const isActive = pathname === item.href;
              return (
                <Link
                  className={`app-sidebar__link${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={item.href}
                >
                  {renderLinkLabel(item.label, item.href)}
                </Link>
              );
            })}
          </>
        )}

        {/* Department Sections - NO COLLAPSE, just headers */}
        {departmentSections.map((section) => (
          <Fragment key={section.label}>
            <div className="app-sidebar__section-title" style={{ marginTop: "16px", marginBottom: "10px" }}>
              {section.label}
            </div>
            {section.items.map((item) => {
              if (!item.href) return null;
              const isActive = pathname === item.href;
              return (
                <Link
                  className={`app-sidebar__link${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={item.href}
                >
                  {renderLinkLabel(item.label, item.href)}
                </Link>
              );
            })}
          </Fragment>
        ))}

        {/* Account Section */}
        {accountSections.length > 0 && (
          <>
            <div className="app-sidebar__section-title" style={{ marginTop: "16px", marginBottom: "10px" }}>
              Account
            </div>
            {accountSections.flatMap((section) => section.items).map((item) => {
              if (item.action === "logout") {
                return (
                  <Fragment key="clock-logout-row">
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button
                        className="app-topbar-button"
                        type="button"
                        onClick={handleClockToggle}
                        disabled={clockLoading}
                        style={{
                          flex: 1,
                          background: isClockedIn
                            ? "var(--danger, #e53935)"
                            : "var(--success, #43a047)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          opacity: clockLoading ? 0.6 : 1,
                          transition: "background 0.2s, opacity 0.2s",
                        }}
                      >
                        {clockLoading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
                      </button>
                      <button
                        className="app-topbar-button app-topbar-button--primary"
                        type="button"
                        onClick={handleLogout}
                        style={{
                          flex: 1,
                          fontWeight: 700,
                          fontSize: "0.82rem",
                        }}
                      >
                        Logout
                      </button>
                    </div>
                    {(process.env.NODE_ENV !== "production" || canUseDevOverlay) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          width: "100%",
                          marginTop: "8px",
                        }}
                      >
                        {process.env.NODE_ENV !== "production" && (
                          <Link
                            className="app-sidebar__link"
                            href="/dev/user-diagnostic"
                            style={{
                              flex: 1,
                              marginBottom: 0,
                              background: "transparent",
                              color: "var(--text-secondary)",
                              fontSize: "0.78rem",
                              textAlign: "center",
                            }}
                          >
                            Diagnostics
                          </Link>
                        )}
                        {canUseDevOverlay && (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={devOverlayEnabled}
                            aria-label="Toggle dev layout overlay"
                            className="app-sidebar__link"
                            onClick={toggleDevOverlay}
                            style={{
                              flex: 1,
                              marginBottom: 0,
                              border: "none",
                              background: devOverlayEnabled ? "var(--accent-strong)" : "var(--accent-base)",
                              color: devOverlayEnabled ? "var(--onAccentText)" : "var(--accentText)",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              textAlign: "center",
                              justifyContent: "center",
                            }}
                          >
                            Dev Overlay {devOverlayEnabled ? "ON" : "OFF"}
                          </button>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              }

              if (item.href) {
                const isActive = pathname === item.href;
                return (
                <Link
                  className={`app-sidebar__link${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={item.href}
                    style={{
                      marginBottom: "10px",
                    }}
                >
                  {renderLinkLabel(item.label, item.href)}
                </Link>
                );
              }

              return null;
            })}
          </>
        )}
      </DevLayoutSection>
    </DevLayoutSection>
  );
}
