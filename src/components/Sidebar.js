// file location: src/components/Sidebar.js
// Edit: Responsive improvements - mobile close button smaller and edge-aligned
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { sidebarSections } from "@/config/navigation";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";
import { useTheme } from "@/styles/themeProvider";

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
  const pathname = usePathname();
  const { user, logout, dbUserId } = useUser();
  const { resolvedMode } = useTheme(); // tap into the existing theme provider so logo swaps instantly on toggle
  const [isMounted, setIsMounted] = useState(false);
  const { unreadCount } = useMessagesBadge(dbUserId);
  const derivedRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const userRoles =
    Array.isArray(visibleRoles) && visibleRoles.length > 0
      ? visibleRoles.map((role) => role.toLowerCase())
      : derivedRoles;
  const partsRoles = new Set(["parts", "parts manager"]);
  const hasPartsSidebarAccess = userRoles.some((role) => partsRoles.has(role));
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) => {
    if (!shortcut.roles || shortcut.roles.length === 0) return true;
    return shortcut.roles.some((role) => userRoles.includes(role));
  });
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const logoSrc =
    (isMounted ? resolvedMode : "light") === "dark"
      ? "/images/logo/DarkLogo.png"
      : "/images/logo/LightLogo.png"; // choose the appropriate asset for the resolved theme
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

  const filterAccessibleSections = (sections = []) =>
    sections
      .map((section) => ({
        ...section,
        items: (section.items || []).filter(
          (item) => hasAccess(item) && (!item.href || !hiddenHrRoutes.has(item.href))
        ),
      }))
      .filter((section) => section.items.length > 0);

  const generalSections = filterAccessibleSections(groupedSections.general);
  const departmentSections = filterAccessibleSections(groupedSections.departments);
  const accountSections = filterAccessibleSections(groupedSections.account);

  const handleLogout = async () => {
    // Clock out before logging out
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
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
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
              background: "var(--primary)",
              color: "var(--surface)",
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

  return (
    <aside
      style={{
        background: "var(--surface)",
        padding: "0",
        width: isCondensed ? "100%" : "260px",
        minWidth: isCondensed ? "auto" : "220px",
        height: isCondensed ? "auto" : "100%",
        minHeight: isCondensed ? "auto" : "calc(100vh - 20px)",
        maxHeight: isCondensed ? "100%" : "none",
        display: "flex",
        flexDirection: "column",
        borderRadius: "16px",
        boxShadow: "none",
        border: "1px solid var(--surface-light)",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "10px",
        overflowX: "hidden",
        overflowY: isCondensed ? "visible" : "auto",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      {/* Brand logo replaces the old Navigation/Workspace labels while keeping header spacing consistent. Background now follows the sidebar theme for both light/dark modes. */}
      <div
        style={{
          background: "var(--surface)", // match sidebar surface so the header blends with the current theme (light or dark)
          padding: "16px 18px",
          color: "var(--text-primary)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: isCondensed ? "60px" : "75px", // fix the height so the oversized logo crops vertically
          borderBottom: "1px solid var(--surface-light)",
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
          <Image
            src={logoSrc}
            alt="H&P logo"
            width={800}
            height={240}
            priority
            sizes="(max-width: 768px) 95vw, 480px"
            style={headerLogoStyle}
          />
        </div>
      </div>

      {/* Navigation Content */}
      <div style={{ padding: "20px" }}>
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
              <div
                style={{
                  color: "var(--primary-dark)",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                My Dashboard
              </div>
              {onToggle && (
                <button
                  type="button"
                  onClick={onToggle}
                  aria-label="Close sidebar"
                  style={{
                    padding: "4px 10px",
                    borderRadius: "8px",
                    border: "1px solid rgba(var(--primary-rgb), 0.35)",
                    backgroundColor: "rgba(var(--primary-rgb), 0.12)",
                    color: "var(--primary)",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    boxShadow: "none",
                    transition: "all 0.2s ease",
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
                  key={shortcut.href}
                  href={shortcut.href}
                  title={shortcut.description}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    marginBottom: "10px",
                    background: isActive
                      ? "var(--primary)"
                      : "var(--surface)",
                    color: isActive ? "var(--surface)" : "var(--primary-dark)",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid var(--surface-light)",
                    boxShadow: "none",
                    textDecoration: "none",
                  }}
                >
                  {shortcut.label}
                </Link>
              );
            })}
            <div
              style={{
                height: "1px",
                width: "100%",
                background: "rgba(var(--danger-rgb), 0.12)",
                margin: "14px 0",
              }}
            />
          </>
        )}

        {/* General Section */}
        {generalSections.length > 0 && (
          <>
            <div
              style={{
                color: "var(--primary-dark)",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              General
            </div>
            {generalSections.flatMap((section) => section.items).map((item) => {
              if (!item.href) return null;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    marginBottom: "10px",
                    background: isActive
                      ? "var(--primary)"
                      : "var(--surface)",
                    color: isActive ? "var(--surface)" : "var(--primary-dark)",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid var(--surface-light)",
                    boxShadow: "none",
                    textDecoration: "none",
                  }}
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
            <div
              style={{
                color: "var(--primary-dark)",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginTop: "16px",
                marginBottom: "10px",
              }}
            >
              {section.label}
            </div>
            {section.items.map((item) => {
              if (!item.href) return null;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "10px 14px",
                    marginBottom: "10px",
                    background: isActive
                      ? "var(--primary)"
                      : "var(--surface)",
                    color: isActive ? "var(--surface)" : "var(--primary-dark)",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid var(--surface-light)",
                    boxShadow: "none",
                    textDecoration: "none",
                  }}
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
            <div
              style={{
                color: "var(--primary-dark)",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                marginTop: "16px",
                marginBottom: "10px",
              }}
            >
              Account
            </div>
            {accountSections.flatMap((section) => section.items).map((item) => {
              if (item.action === "logout") {
                return (
                  <Fragment key="clock-logout-row">
                    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                      <button
                        type="button"
                        onClick={handleClockToggle}
                        disabled={clockLoading}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: "10px",
                          background: isClockedIn
                            ? "var(--danger, #e53935)"
                            : "var(--success, #43a047)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          border: "none",
                          cursor: clockLoading ? "not-allowed" : "pointer",
                          opacity: clockLoading ? 0.6 : 1,
                          transition: "background 0.2s, opacity 0.2s",
                        }}
                      >
                        {clockLoading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: "10px",
                          background: "var(--primary)",
                          color: "var(--surface)",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Logout
                      </button>
                    </div>
                    {process.env.NODE_ENV !== "production" && (
                      <Link
                        href="/dev/user-diagnostic"
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "8px 8px",
                          marginTop: "8px",
                          borderRadius: "10px",
                          border: "1px solid var(--surface-light)",
                          background: "transparent",
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                          fontSize: "0.78rem",
                          textAlign: "center",
                          textDecoration: "none",
                          cursor: "pointer",
                        }}
                      >
                        Diagnostics
                      </Link>
                    )}
                  </Fragment>
                );
              }

              if (item.href) {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "block",
                      padding: "10px 14px",
                      marginBottom: "10px",
                      background: isActive
                        ? "var(--primary)"
                        : "var(--surface)",
                      color: isActive ? "var(--surface)" : "var(--primary-dark)",
                      borderRadius: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isActive ? "none" : "1px solid var(--surface-light)",
                      boxShadow: "none",
                      textDecoration: "none",
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
      </div>
    </aside>
  );
}
