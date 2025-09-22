// file location: src/components/Layout.js
// Vertical left sidebar + topbar layout with Section widgets, sidebar hidden on /login

import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";

export default function Layout({ children }) {
  const { user, logout } = useUser();
  const router = useRouter();

  const hideSidebar = router.pathname === "/login"; // hide sidebar on login page

  // Navigation links per role
  const navLinks = {
    Admin: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/users", label: "User Management" },
      { href: "/reports", label: "Reports" },
    ],
    Sales: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/sales", label: "Sales Tracking" },
      { href: "/cars", label: "Car Inventory" },
    ],
    Workshop: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/jobs", label: "Job Cards" },
      { href: "/clocking", label: "Clocking System" },
    ],
    Parts: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/parts", label: "Parts Management" },
      { href: "/requests", label: "Parts Requests" },
    ],
    Manager: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/overview", label: "Overview" },
      { href: "/approvals", label: "Approvals" },
    ],
  };

  const role = user?.roles?.[0] || "Guest";
  const links = navLinks[role] || [{ href: "/dashboard", label: "Dashboard" }];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar: hidden on /login */}
      {!hideSidebar && (
        <aside
          style={{
            width: "10%",
            minWidth: "120px",
            backgroundColor: "#FFC0C0",
            color: "black",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <div>
            <h2 style={{ marginBottom: "20px", fontSize: "1.2rem" }}>H&P System</h2>

            <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "block",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    textDecoration: "none",
                    color: "black",
                    backgroundColor: router.pathname === link.href ? "#FF8080" : "transparent",
                    transition: "background-color 0.2s",
                    fontSize: "0.9rem",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>New Job</button>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>Request Part</button>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>Send Message</button>
            </div>
          </div>

          <div>
            <button
              onClick={logout}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "#FF4040",
                border: "none",
                color: "black",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "0.9rem",
              }}
            >
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div style={{ width: hideSidebar ? "100%" : "90%", display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Topbar: optional to hide on login */}
        {!hideSidebar && (
          <header style={{ backgroundColor: "white", padding: "16px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: "600" }}>
              Welcome {user?.username || "Guest"} ({role})
            </h1>
          </header>
        )}

        <main style={{ flex: 1, padding: "24px", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
