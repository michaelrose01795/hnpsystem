// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useUser } from "@/context/UserContext";
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

export default function Sidebar({ onToggle, isCondensed = false, extraSections = [] }) {
  const pathname = usePathname();
  const { user, logout } = useUser();
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || [];
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
    return item.roles.some((role) => userRoles.includes(role.toLowerCase()));
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

  return (
    <aside
      style={{
        background: "#ffffff",
        padding: "0",
        width: isCondensed ? "100%" : "260px",
        minWidth: isCondensed ? "auto" : "220px",
        height: isCondensed ? "auto" : "calc(100vh - 20px)",
        display: "flex",
        flexDirection: "column",
        borderRadius: "16px",
        boxShadow: isCondensed
          ? "0 12px 30px rgba(209, 0, 0, 0.12)"
          : "0 20px 40px rgba(209, 0, 0, 0.12)",
        border: "1px solid #ffe0e0",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "10px",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(to right, #d10000, #a00000)",
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
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Close sidebar"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              padding: "0 16px",
              height: "36px",
              borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.4)",
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(0,0,0,0.15)",
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
                color: "#a00000",
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
                      ? "linear-gradient(90deg, #d10000, #a00000)"
                      : "#ffffff",
                    color: isActive ? "#ffffff" : "#a00000",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid #ffe0e0",
                    boxShadow: isActive
                      ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                      : "0 4px 12px rgba(0, 0, 0, 0.05)",
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
                background: "rgba(160,0,0,0.12)",
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
                color: "#a00000",
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
                      ? "linear-gradient(90deg, #d10000, #a00000)"
                      : "#ffffff",
                    color: isActive ? "#ffffff" : "#a00000",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid #ffe0e0",
                    boxShadow: isActive
                      ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                      : "0 4px 12px rgba(0, 0, 0, 0.05)",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
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
                color: "#a00000",
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
                      ? "linear-gradient(90deg, #d10000, #a00000)"
                      : "#ffffff",
                    color: isActive ? "#ffffff" : "#a00000",
                    borderRadius: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: isActive ? "none" : "1px solid #ffe0e0",
                    boxShadow: isActive
                      ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                      : "0 4px 12px rgba(0, 0, 0, 0.05)",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
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
                color: "#a00000",
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
                      background: "linear-gradient(90deg, #a00000, #700000)",
                      color: "#ffffff",
                      fontWeight: 700,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 12px 20px rgba(112, 0, 0, 0.3)",
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
                        ? "linear-gradient(90deg, #d10000, #a00000)"
                        : "#ffffff",
                      color: isActive ? "#ffffff" : "#a00000",
                      borderRadius: "10px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: isActive ? "none" : "1px solid #ffe0e0",
                      boxShadow: isActive
                        ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                        : "0 4px 12px rgba(0, 0, 0, 0.05)",
                      textDecoration: "none",
                    }}
                  >
                    {item.label}
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
