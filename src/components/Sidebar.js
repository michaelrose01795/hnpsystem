// file location: src/components/Sidebar.js
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useMemo } from "react";
import { useUser } from "@/context/UserContext";
import { sidebarSections } from "@/config/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const userRoles = user?.roles?.map((r) => r.toLowerCase()) || [];

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
        }}
      >
        <p style={{ margin: 0, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Navigation
        </p>
        <h2 style={{ margin: "6px 0 0", fontSize: "1.4rem", fontWeight: 700 }}>Workspace</h2>
      </div>

      <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
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
