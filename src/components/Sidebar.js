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
        background: "#FFF0F0",
        padding: "20px",
        width: "200px",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {sidebarSections.map((section) => {
        const items = section.items.filter(hasAccess);
        if (items.length === 0) return null;
        const isOpen = openSections[section.label];
        return (
          <div key={section.label} style={{ marginBottom: "12px" }}>
            <button
              type="button"
              onClick={() => toggleSection(section.label)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                color: "#FF4040",
                fontWeight: 700,
                fontSize: "0.95rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                padding: "6px 0",
              }}
            >
              {section.label}
              <span>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen &&
              items.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span
                    style={{
                      display: "block",
                      padding: "8px 10px",
                      marginLeft: "6px",
                      backgroundColor: pathname === item.href ? "#FF4040" : "transparent",
                      color: pathname === item.href ? "white" : "#FF4040",
                      borderRadius: "6px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.2s, color 0.2s",
                    }}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
          </div>
        );
      })}
    </aside>
  );
}
