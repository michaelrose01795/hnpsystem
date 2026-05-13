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
import { canShowDevPages, canShowDevSidebarItems } from "@/lib/dev-tools/config";
import {
  isOverlayHidden as readOverlayHidden,
  setOverlayHidden as writeOverlayHidden,
  subscribeOverlayVisibility,
} from "@/features/presentation/runtime/overlayVisibility";

const LOGOUT_BARRIER_STORAGE_KEY = "hnp-logout-barrier-until";
const LOGOUT_BARRIER_MS = 8000;
const PENDING_LOGOUT_STORAGE_KEY = "hnp-pending-logout";
const PRESENTATION_LOGOUT_DESTINATION = "/loginPresentation";
const PRESENTATION_ROLE_STORAGE_KEY = "presentation:activeRoleKey";
const PRESENTATION_RETURN_TO_STORAGE_KEY = "presentation:returnTo";

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

function buildRouteAllowedChecker(allowedRoutes) {
  if (!Array.isArray(allowedRoutes) || allowedRoutes.length === 0) return null;
  const matchers = allowedRoutes.map((template) => {
    if (!template) return () => false;
    if (!template.includes("[")) {
      return (candidate) => candidate === template;
    }
    const pattern = new RegExp(
      "^" + template.replace(/\//g, "\\/").replace(/\[[^\]]+\]/g, "[^/]+") + "$"
    );
    return (candidate) => pattern.test(candidate);
  });
  return (href) => {
    if (!href) return false;
    const stripped = String(href).split("?")[0].split("#")[0];
    return matchers.some((m) => m(stripped));
  };
}

export default function Sidebar({
  onToggle,
  onNavigate,
  isCondensed = false,
  extraSections = [],
  visibleRoles = null,
  modeLabel: _modeLabel = null, // keep legacy prop available without rendering the old text block
  allowedRoutes = null,
  inPresentationMode = false,
}) {
  void _modeLabel;
  const router = useRouter();
  const pathname = (router.asPath || router.pathname || "").split("?")[0];
  const { user, dbUserId } = useUser();
  const { canAccess: canUseDevOverlay, enabled: devOverlayEnabled, toggleEnabled: toggleDevOverlay } =
    useDevLayoutOverlay();
  const canShowDevItems = !inPresentationMode && canShowDevSidebarItems(user);
  const canShowDevPagesLink = !inPresentationMode && canShowDevPages();
  // In presentation mode the sidebar belongs to the demo role, not the real
  // signed-in user — pass null to skip the unread-messages query so the badge
  // doesn't surface the presenter's actual inbox count.
  const { unreadCount } = useMessagesBadge(inPresentationMode ? null : dbUserId);

  // Mirror PresentationProvider's "Hide" state so we can show a "Show overlay"
  // sidebar button when the user has dismissed the popup. The state lives in
  // a module-scope pub/sub (src/features/presentation/runtime/overlayVisibility.js)
  // because PresentationProvider mounts inside the page, below this sidebar.
  const [overlayHidden, setOverlayHiddenLocal] = useState(false);
  useEffect(() => {
    setOverlayHiddenLocal(readOverlayHidden());
    const unsubscribe = subscribeOverlayVisibility((value) => setOverlayHiddenLocal(value));
    return unsubscribe;
  }, []);
  const inPresentationRoute = pathname.startsWith("/presentation");
  const inVisionRoute = pathname === "/vision" || pathname.startsWith("/vision/");
  const ghostControlStyle = {
    background: "transparent",
    color: "var(--accentText)",
    border: "var(--ghostbutton-ring)",
  };
  const successGhostControlStyle = {
    background: "transparent",
    color: "var(--success-text)",
    border: "1px solid var(--success)",
  };
  const dangerGhostControlStyle = {
    background: "transparent",
    color: "var(--danger-text)",
    border: "1px solid var(--danger)",
  };
  const successControlStyle = {
    background: "var(--success-surface)",
    color: "var(--success-text)",
    border: "none",
  };
  const dangerControlStyle = {
    background: "var(--danger-surface)",
    color: "var(--danger-text)",
    border: "none",
  };
  const handleShowOverlay = useCallback(() => {
    writeOverlayHidden(false);
  }, []);

  const derivedRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const userRoles =
    Array.isArray(visibleRoles) && visibleRoles.length > 0
      ? visibleRoles.map((role) => role.toLowerCase())
      : derivedRoles;
  const isRouteAllowed = useMemo(() => buildRouteAllowedChecker(allowedRoutes), [allowedRoutes]);
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) => {
    if (isRouteAllowed && shortcut.href && !isRouteAllowed(shortcut.href)) return false;
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
    // In presentation mode, the doc-driven allowed-routes list is the
    // authoritative filter — items outside the active role's list are hidden
    // even if their `roles` would otherwise grant access.
    if (isRouteAllowed && item?.href) {
      if (!isRouteAllowed(item.href)) return false;
    }
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
        items: (section.items || []).filter(
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
  const handleNavigationPress = useCallback(() => {
    if (typeof onNavigate === "function") {
      onNavigate();
    }
  }, [onNavigate]);

  const handleLogout = () => {
    // In presentation mode the "logout" action returns to the role picker
    // instead of clearing the real session — the demo user has no session to
    // tear down.
    if (inPresentationMode) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PRESENTATION_ROLE_STORAGE_KEY);
        window.sessionStorage.removeItem(PRESENTATION_RETURN_TO_STORAGE_KEY);
        window.location.replace(PRESENTATION_LOGOUT_DESTINATION);
        return;
      }
      router.replace(PRESENTATION_LOGOUT_DESTINATION);
      return;
    }
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
          flex: 1,
        }}
      >
        <span>{label}</span>
        {isMessagesItem && unreadCount > 0 && (
          <span
            className="app-badge app-badge--danger-strong app-badge--round-count"
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

      <div
        aria-hidden="true"
        style={{
          height: "1px",
          background: "var(--theme)",
          flexShrink: 0,
        }}
      />

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
                Dashboard
              </div>
              {onToggle && (
                <button
                  className="app-btn app-btn--secondary app-btn--xs"
                  type="button"
                  onClick={onToggle}
                  aria-label="Close sidebar"
                >
                  Close
                </button>
              )}
            </div>
            {dashboardShortcuts.map((shortcut) => {
              const exactOnly = shortcut.href === "/dashboard";
              const isActive =
                pathname === shortcut.href ||
                (!exactOnly && pathname && pathname.startsWith(`${shortcut.href}/`));
              return (
                <Link
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={shortcut.href}
                  href={shortcut.href}
                  title={shortcut.description}
                  onClick={handleNavigationPress}
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
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={item.href}
                  onClick={handleNavigationPress}
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
                  className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                  key={item.href}
                  href={item.href}
                  onClick={handleNavigationPress}
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
                        className="app-btn"
                        type="button"
                        onClick={handleClockToggle}
                        disabled={clockLoading}
                        style={
                          isClockedIn
                            ? { flex: 1, opacity: clockLoading ? 0.6 : 1, ...dangerControlStyle }
                            : {
                                flex: 1,
                                opacity: clockLoading ? 0.6 : 1,
                                ...successControlStyle,
                              }
                        }
                      >
                        {clockLoading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
                      </button>
                      <button
                        className="app-btn"
                        type="button"
                        onClick={handleLogout}
                        data-presentation-allow-interaction="true"
                        style={{ flex: 1, ...dangerGhostControlStyle }}
                      >
                        Logout
                      </button>
                    </div>
                    {(canShowDevItems || canShowDevPagesLink) && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          width: "100%",
                          marginTop: "8px",
                        }}
                      >
                        {canShowDevPagesLink && (
                          <Link
                            className="app-btn app-btn--ghost"
                            href="/dev/user-diagnostic"
                            style={{ flex: 1 }}
                            onClick={handleNavigationPress}
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
                            className="app-btn"
                            onClick={toggleDevOverlay}
                            style={{ flex: 1, ...(devOverlayEnabled ? successGhostControlStyle : ghostControlStyle) }}
                          >
                            Overlay
                          </button>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                        gap: "8px",
                        marginTop: "8px",
                      }}
                    >
                      <button
                        type="button"
                        className="app-btn"
                        style={inPresentationRoute ? successGhostControlStyle : ghostControlStyle}
                        aria-current={inPresentationRoute ? "page" : undefined}
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            const current = router?.asPath || "/";
                            if (!current.startsWith("/presentation")) {
                              window.sessionStorage.setItem(PRESENTATION_RETURN_TO_STORAGE_KEY, current);
                            }
                          }
                          router.push("/presentation");
                          handleNavigationPress();
                        }}
                      >
                        Presentation
                      </button>
                      <Link
                        className="app-btn"
                        style={inVisionRoute ? successGhostControlStyle : ghostControlStyle}
                        href="/vision"
                        aria-current={inVisionRoute ? "page" : undefined}
                        onClick={handleNavigationPress}
                      >
                        Vision
                      </Link>
                    </div>
                    {inPresentationRoute && overlayHidden && (
                      <button
                        type="button"
                        className="app-btn app-btn--nav"
                        style={{
                          width: "100%",
                          marginTop: "8px",
                          marginBottom: 0,
                          textAlign: "left",
                          ...successGhostControlStyle,
                        }}
                        onClick={handleShowOverlay}
                        title="Bring the slide highlight ring and callout popup back"
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "currentColor",
                            flexShrink: 0,
                          }}
                        />
                        <span>Show overlay</span>
                      </button>
                    )}
                  </Fragment>
                );
              }

              if (item.href) {
                const isActive = pathname === item.href;
                return (
                  <Link
                    className={`app-btn app-btn--secondary app-btn--nav${isActive ? " is-active" : ""}`}
                    key={item.href}
                    href={item.href}
                    onClick={handleNavigationPress}
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
