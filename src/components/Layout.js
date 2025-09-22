// file location: src/components/Layout.js
// Vertical left sidebar + topbar layout with Section widgets, sidebar hidden on /login
// Red-accent modern style, all roles, News Feed button, logout redirect

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../context/UserContext";
import ClockInButton from "./Clocking/ClockInButton"; // ✅ Import ClockInButton

export default function Layout({ children }) {
  const { user, logout } = useUser();
  const router = useRouter();
  const hideSidebar = router.pathname === "/login";

  // Redirect if logged out
  useEffect(() => {
    if (user === null && !hideSidebar) {
      router.replace("/login");
    }
  }, [user, hideSidebar, router]);

  // Show loading spinner while user is undefined
  if (user === undefined && !hideSidebar) {
    return <div style={{ padding: "2rem", textAlign: "center" }}>Loading...</div>;
  }

  // Navigation links per role
  const navLinks = {
    Admin: [{ href: "/dashboard", label: "Dashboard" }, { href: "/users", label: "User Management" }, { href: "/reports", label: "Reports" }],
    Accounts: [{ href: "/dashboard", label: "Dashboard" }, { href: "/accounts", label: "Accounts Overview" }, { href: "/reports", label: "Reports" }],
    Owner: [{ href: "/dashboard", label: "Dashboard" }, { href: "/overview", label: "Business Overview" }],
    "General Manager": [{ href: "/dashboard", label: "Dashboard" }, { href: "/overview", label: "Overview" }],
    "Sales Director": [{ href: "/dashboard", label: "Dashboard" }, { href: "/sales", label: "Sales Tracking" }, { href: "/cars", label: "Car Inventory" }],
    Sales: [{ href: "/dashboard", label: "Dashboard" }, { href: "/sales", label: "Sales Tracking" }, { href: "/cars", label: "Car Inventory" }],
    Service: [{ href: "/dashboard", label: "Dashboard" }, { href: "/jobs", label: "Job Cards" }],
    Techs: [{ href: "/dashboard", label: "Dashboard" }, { href: "/jobs", label: "Job Cards" }],
    Parts: [{ href: "/dashboard", label: "Dashboard" }, { href: "/parts", label: "Parts Management" }, { href: "/requests", label: "Parts Requests" }],
    "MOT Tester": [{ href: "/dashboard", label: "Dashboard" }, { href: "/mot", label: "MOT Testing" }],
    "Valet Service": [{ href: "/dashboard", label: "Dashboard" }, { href: "/valet", label: "Valet Jobs" }],
    "Valet Sales": [{ href: "/dashboard", label: "Dashboard" }, { href: "/valet/sales", label: "Valet Sales" }],
    "Buying Director": [{ href: "/dashboard", label: "Dashboard" }, { href: "/buying", label: "Buying Overview" }],
    "Second Hand Buying": [{ href: "/dashboard", label: "Dashboard" }, { href: "/buying/used", label: "Used Cars" }],
    "Vehicle Processor & Photographer": [{ href: "/dashboard", label: "Dashboard" }, { href: "/vehicle/processing", label: "Vehicle Processing" }, { href: "/vehicle/photos", label: "Photos" }],
    Receptionist: [{ href: "/dashboard", label: "Dashboard" }, { href: "/appointments", label: "Appointments" }],
    Painters: [{ href: "/dashboard", label: "Dashboard" }, { href: "/painting", label: "Painting Jobs" }],
    Contractors: [{ href: "/dashboard", label: "Dashboard" }, { href: "/contracts", label: "Contract Jobs" }],
    Manager: [{ href: "/dashboard", label: "Dashboard" }, { href: "/overview", label: "Overview" }, { href: "/approvals", label: "Approvals" }],
  };

  const role = user?.roles?.[0] || "Guest";
  const links = [{ href: "/newsfeed", label: "News Feed" }, ...(navLinks[role] || [{ href: "/dashboard", label: "Dashboard" }])];

  // Only specific manager roles see Controller Clocking
  const controllerRoles = ["Workshop Manager", "Service Controller"];
  if (controllerRoles.includes(role)) {
    const clockingLink = { href: "/workshop/ControllerClocking", label: "Controller Clocking" };
    links.splice(2, 0, clockingLink); // Insert after News Feed & Dashboard
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {!hideSidebar && (
        <aside
          style={{
            width: "10%",
            minWidth: "140px",
            backgroundColor: "#FFF0F0",
            color: "black",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px",
            boxSizing: "border-box",
            borderRight: "1px solid #FFCCCC",
          }}
        >
          <div>
            <h2 style={{ marginBottom: "20px", fontSize: "1.2rem", color: "#FF4040" }}>H&P DMS</h2>

            <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {links.map((link) => (
                <Link key={link.href} href={link.href} legacyBehavior>
                  <a
                    style={{
                      display: "block",
                      padding: "10px",
                      borderRadius: "6px",
                      textDecoration: "none",
                      color: router.pathname === link.href ? "white" : "#FF4040",
                      backgroundColor: router.pathname === link.href ? "#FF4040" : "transparent",
                      transition: "all 0.2s",
                      fontSize: "0.95rem",
                      fontWeight: 500,
                    }}
                  >
                    {link.label}
                  </a>
                </Link>
              ))}
            </nav>

            {/* ✅ Add ClockInButton for techs */}
            <div style={{ marginTop: "20px" }}>
              <ClockInButton />
            </div>

            <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>New Job</button>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>Request Part</button>
              <button style={{ padding: "8px", backgroundColor: "#FF8080", border: "none", color: "black", cursor: "pointer", borderRadius: "6px", fontSize: "0.85rem" }}>Send Message</button>
            </div>
          </div>

          <div>
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              style={{
                width: "100%",
                padding: "10px",
                backgroundColor: "#FF4040",
                border: "none",
                color: "white",
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

      <div
        style={{
          width: hideSidebar ? "100%" : "90%",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          backgroundColor: "#FFF8F8",
        }}
      >
        {!hideSidebar && (
          <header
            style={{
              backgroundColor: "white",
              padding: "16px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#FF4040" }}>
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
