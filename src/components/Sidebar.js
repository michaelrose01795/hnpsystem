// file location: src/components/Sidebar.js
// Edit: Responsive improvements - mobile close button smaller and edge-aligned
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
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
    await logout?.();
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  };

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
          paddingRight: onToggle ? "72px" : "18px", // leave room for the close button so it doesn't overlap the expanded logo
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
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close sidebar"
            style={{
              position: "absolute",
              top: "14px",
              right: "14px",
              padding: "0 12px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid rgba(var(--primary-rgb), 0.35)",
              backgroundColor: "rgba(var(--primary-rgb), 0.12)", // ensure the button remains visible on both light/dark backgrounds
              color: "var(--primary)",
              fontWeight: 700,
              fontSize: "0.8rem",
              cursor: "pointer",
              boxShadow: "none",
              transition: "all 0.2s ease",
            }}
          >
            Close
          </button>
        )}
      </div>

      {/* Navigation Content */}
      <div style={{ padding: "20px" }}>
        {dashboardShortcuts.length > 0 && (
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
              My Dashboard
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
                  <button
                    key={item.label}
                    type="button"
                    onClick={handleLogout}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "10px",
                      background: "var(--primary)",
                      color: "var(--surface)",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "none",
                      width: "100%",
                      textDecoration: "none",
                    }}
                  >
                    {item.label}
                  </button>
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
