// file location: src/components/Sidebar.js
// Edit: Responsive improvements - mobile close button smaller and edge-aligned
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { useMessagesBadge } from "@/hooks/useMessagesBadge";
import { sidebarSections } from "@/config/navigation";
import { departmentDashboardShortcuts } from "@/config/departmentDashboards";

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
  modeLabel = null,
}) {
  const pathname = usePathname();
  const { user, logout, dbUserId } = useUser();
  const { unreadCount } = useMessagesBadge(dbUserId);
  const derivedRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
  const userRoles =
    Array.isArray(visibleRoles) && visibleRoles.length > 0 ? visibleRoles : derivedRoles;
  const partsRoles = new Set(["parts", "parts manager"]);
  const hasPartsSidebarAccess = userRoles.some((role) => partsRoles.has(role));
  const dashboardShortcuts = departmentDashboardShortcuts.filter((shortcut) => {
    if (!shortcut.roles || shortcut.roles.length === 0) return true;
    return shortcut.roles.some((role) => userRoles.includes(role));
  });

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

    // Debug logging for HR Manager link
    if (item.label === "HR Manager" || item.href === "/hr/manager") {
      console.log("🔍 Sidebar - Checking access for HR Manager:");
      console.log("  - Item roles:", item.roles);
      console.log("  - User roles:", userRoles);
      console.log("  - Has access:", access);
    }

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
        boxShadow: "none"
          ? "0 12px 30px rgba(var(--primary-rgb), 0.12)"
          : "0 20px 40px rgba(var(--primary-rgb), 0.12)",
        border: "1px solid var(--surface-light)",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "10px",
        overflowX: "hidden",
        overflowY: isCondensed ? "visible" : "auto",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "var(--primary)",
          padding: "24px",
          color: "white",
          position: "relative",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Navigation
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>
          Workspace
        </h2>
        {modeLabel && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {modeLabel} Mode
          </div>
        )}
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
              border: "1px solid rgba(var(--surface-rgb), 0.4)",
              backgroundColor: "rgba(var(--surface-rgb), 0.12)",
              color: "var(--surface)",
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
        {hasPartsSidebarAccess && (
          <div style={{ marginBottom: "16px" }}>
            <Link
              href="/parts/deliveries"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "12px",
                border: "1px solid var(--surface-light)",
                background: "var(--surface-light)",
                color: "var(--primary-dark)",
                fontWeight: 600,
                textDecoration: "none",
                boxShadow: "none",
              }}
            >
              <span role="img" aria-label="deliveries">
                🚚
              </span>
              Deliveries
            </Link>
          </div>
        )}
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
                pathname === shortcut.href || pathname.startsWith(`${shortcut.href}/`);
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
                    boxShadow: "none"
                      ? "0 12px 20px rgba(var(--primary-rgb), 0.28)"
                      : "0 4px 12px rgba(var(--primary-rgb), 0.15)",
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
                    boxShadow: "none"
                      ? "0 12px 20px rgba(var(--primary-rgb), 0.28)"
                      : "0 4px 12px rgba(var(--primary-rgb), 0.15)",
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
          <>
            <div
              key={`${section.label}-header`}
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
                    boxShadow: "none"
                      ? "0 12px 20px rgba(var(--danger-rgb), 0.25)"
                      : "0 4px 12px rgba(var(--shadow-rgb), 0.05)",
                    textDecoration: "none",
                  }}
                >
                  {renderLinkLabel(item.label, item.href)}
                </Link>
              );
            })}
          </>
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
                      boxShadow: "none"
                        ? "0 12px 20px rgba(var(--danger-rgb), 0.35)"
                        : "0 6px 14px rgba(var(--danger-rgb), 0.2)",
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
