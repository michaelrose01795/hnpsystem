// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { sidebarSections } from "@/config/navigation";

export default function Sidebar({ onToggle, isCondensed = false }) {
  const pathname = usePathname();
  const { user } = useUser();
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];
  const isCustomerOnly =
    userRoles.length > 0 && userRoles.every((role) => role === "customer");
  const isPartsUser = userRoles.some(
    (role) => role === "parts" || role === "parts manager"
  );
  const trackingRoles = [
    "techs",
    "service",
    "service manager",
    "workshop manager",
    "valet service",
    "admin",
  ];
  const canSeeTrackingButton = userRoles.some((role) =>
    trackingRoles.includes(role)
  );

  const initialState = useMemo(
    () =>
      Object.fromEntries(sidebarSections.map((section) => [section.label, true])),
    []
  );
  const [openSections, setOpenSections] = useState(initialState);

  const hasAccess = (item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.some((role) => userRoles.includes(role.toLowerCase()));
  };

  const toggleSection = (label) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
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
              <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
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
        maxHeight: isCondensed ? "none" : "calc(100vh - 20px)",
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
        <p style={{ margin: 0, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Navigation
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>Workspace</h2>
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

      <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
        {isPartsUser && (
          <Link href="/vhc/dashboard" style={{ textDecoration: "none" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                marginBottom: "16px",
                background: "linear-gradient(90deg, #fde68a, #fca5a5)",
                color: "#7c2d12",
                fontWeight: 700,
                border: "1px solid rgba(124,45,18,0.2)",
                boxShadow: "0 10px 18px rgba(124,45,18,0.18)",
                textAlign: "center",
              }}
            >
              🧾 VHC Dashboard
            </div>
          </Link>
        )}
        {canSeeTrackingButton && (
          <Link href="/tracking" style={{ textDecoration: "none" }}>
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "12px",
                marginBottom: "16px",
                background: "linear-gradient(90deg, #e0f2fe, #fecaca)",
                color: "#0f172a",
                fontWeight: 700,
                border: "1px solid rgba(15, 23, 42, 0.15)",
                boxShadow: "0 12px 22px rgba(15, 23, 42, 0.18)",
                textAlign: "center",
              }}
            >
              🚗 Tracking Hub
            </div>
          </Link>
        )}

        {sidebarSections.map((section) => {
          const items = section.items.filter(hasAccess);
          if (items.length === 0) return null;
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
              {isOpen &&
                items.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{ textDecoration: "none" }}
                    >
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          background: isActive
                            ? "linear-gradient(90deg, #d10000, #a00000)"
                            : "#ffffff",
                          color: isActive ? "#ffffff" : "#a00000",
                          fontWeight: 600,
                          boxShadow: isActive
                            ? "0 12px 20px rgba(161, 0, 0, 0.25)"
                            : "0 4px 12px rgba(0, 0, 0, 0.05)",
                          border: isActive ? "none" : "1px solid #ffe0e0",
                          transition: "all 0.2s ease",
                          display: "block",
                        }}
                      >
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
