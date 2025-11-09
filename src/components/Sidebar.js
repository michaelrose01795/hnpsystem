// file location: src/components/Sidebar.js
"use client";

import Link from "next/link"; // import Next.js navigation link
import { usePathname } from "next/navigation"; // import routing helpers
import { useEffect, useMemo, useState } from "react"; // import React hooks
import { useUser } from "@/context/UserContext"; // import user context for roles and logout
import { sidebarSections } from "@/config/navigation"; // import sidebar configuration

export default function Sidebar({ onToggle, isCondensed = false }) {
  const pathname = usePathname(); // get current path
  const { user, logout } = useUser(); // get user data and logout helper
  const userRoles = user?.roles?.map((role) => role.toLowerCase()) || []; // normalise roles
  const isCustomerOnly =
    userRoles.length > 0 && userRoles.every((role) => role === "customer"); // check for customer-only accounts

  const groupedSections = useMemo(() => {
    const groups = { general: [], departments: [], account: [] }; // prepare grouped structure
    sidebarSections.forEach((section) => {
      const category = section.category || "departments"; // default category
      if (!groups[category]) {
        groups[category] = []; // ensure array exists
      }
      groups[category].push(section); // add section to the correct group
    });
    return groups;
  }, []);

  const hasAccess = (item) => {
    if (!item.roles || item.roles.length === 0) return true; // allow items without role requirements
    return item.roles.some((role) => userRoles.includes(role.toLowerCase())); // check access
  };

  const filterAccessibleSections = (sections = []) =>
    sections
      .map((section) => ({
        ...section,
        items: (section.items || []).filter(hasAccess), // keep only allowed items
      }))
      .filter((section) => section.items.length > 0); // keep sections with content

  const generalSections = filterAccessibleSections(groupedSections.general); // accessible general links
  const departmentSections = filterAccessibleSections(
    groupedSections.departments
  ); // accessible department sections
  const accountSections = filterAccessibleSections(groupedSections.account); // accessible account links

  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(departmentSections.map((section) => [section.label, true]))
  ); // track open/closed state for department groups

  useEffect(() => {
    setOpenSections((prev) => {
      const nextState = {};
      departmentSections.forEach((section) => {
        nextState[section.label] = prev[section.label] ?? true; // keep previous state or default to open
      });
      return nextState;
    });
  }, [departmentSections]);

  const toggleSection = (label) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] })); // toggle collapse state
  };

  const handleLogout = async () => {
    await logout?.(); // call logout if available
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
  };

  const renderNavItem = (item) => {
    if (!item.href) return null; // guard against items without a destination
    const isActive = pathname === item.href; // determine active state
    return (
      <Link
        key={item.href || item.label}
        href={item.href}
      >
        <div
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: isActive ? "linear-gradient(90deg, #d10000, #a00000)" : "#ffffff",
            color: isActive ? "#ffffff" : "#a00000",
            fontWeight: 600,
            boxShadow: isActive
              ? "0 12px 20px rgba(161, 0, 0, 0.25)"
              : "0 4px 12px rgba(0, 0, 0, 0.05)",
            border: isActive ? "none" : "1px solid #ffe0e0",
            transition: "all 0.2s ease",
            cursor: "pointer",
          }}
        >
          {item.label}
        </div>
      </Link>
    );
  };

  const renderAccountItem = (item) => {
    if (item.action === "logout") {
      return (
        <button
          key={item.label}
          type="button"
          onClick={handleLogout}
          style={{
            marginTop: "10px",
            padding: "10px 14px",
            borderRadius: "10px",
            background: "linear-gradient(90deg, #a00000, #700000)",
            color: "#ffffff",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 12px 20px rgba(112, 0, 0, 0.3)",
            width: "100%",
          }}
        >
          {item.label}
        </button>
      );
    }

    if (item.href) {
      return renderNavItem(item); // reuse navigation renderer for profile link
    }

    return null; // ignore unsupported patterns
  };

  if (isCustomerOnly) {
    return (
      <aside
        style={{
          width: "260px",
          minWidth: "220px",
          maxHeight: "calc(100vh - 20px)",
          position: "sticky",
          top: "10px",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 40px rgba(209, 0, 0, 0.12)",
          border: "1px solid #ffe0e0",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
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
            Customer Portal
          </p>
          <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>
            Welcome
          </h2>
        </div>
        <div style={{ padding: "20px", flex: 1 }}>
          {[
            { href: "/customer", label: "Overview" },
            { href: "/customer/vhc", label: "VHC & Media" },
            { href: "/customer/vehicles", label: "My Vehicles" },
            { href: "/customer/parts", label: "Parts & Accessories" },
            { href: "/customer/messages", label: "Messages" },
          ].map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: isActive
                      ? "linear-gradient(90deg, #d10000, #a00000)"
                      : "#fff5f5",
                    color: isActive ? "#ffffff" : "#a00000",
                    fontWeight: 600,
                    boxShadow: isActive
                      ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                      : "0 4px 12px rgba(0, 0, 0, 0.05)",
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside
      style={{
        width: isCondensed ? "100%" : "260px",
        minWidth: isCondensed ? "auto" : "220px",
        height: isCondensed ? "auto" : "calc(100vh - 20px)",
        position: isCondensed ? "relative" : "sticky",
        top: isCondensed ? "auto" : "10px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: isCondensed
          ? "0 12px 30px rgba(209, 0, 0, 0.12)"
          : "0 20px 40px rgba(209, 0, 0, 0.12)",
        border: "1px solid #ffe0e0",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
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
            aria-label="Collapse sidebar"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              width: "36px",
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
            X
          </button>
        )}
      </div>

      <div
        style={{
          padding: "20px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            paddingRight: "6px",
          }}
        >
          {generalSections.length > 0 && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "12px",
                backgroundColor: "#fff5f5",
                marginBottom: "12px",
                border: "1px solid #ffe0e0",
                boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
              }}
            >
              <div
                style={{
                  color: "#a00000",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                General
              </div>
              {generalSections.flatMap((section) => section.items).map(renderNavItem)}
            </div>
          )}

          {departmentSections.map((section) => {
            const isOpen = openSections[section.label];
            return (
              <div
                key={section.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: "12px",
                  backgroundColor: "#fff5f5",
                  marginBottom: "12px",
                  border: "1px solid #ffe0e0",
                  boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleSection(section.label)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    color: "#a00000",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  {section.label}
                  <span style={{ fontSize: "1rem" }}>{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && section.items.map(renderNavItem)}
              </div>
            );
          })}
        </div>

        {accountSections.length > 0 && (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: "12px",
              backgroundColor: "#fff5f5",
              border: "1px solid #ffe0e0",
              boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.4)",
              marginTop: "auto",
            }}
          >
            <div
              style={{
                color: "#a00000",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Account
            </div>
            {accountSections.flatMap((section) => section.items).map(renderAccountItem)}
          </div>
        )}
      </div>
    </aside>
  );
}