// src/pages/admin/index.js
import React from "react";
import Link from "next/link";

// Admin Dashboard Home Page
export default function AdminDashboard() {
  const adminFeatures = [
    { name: "User Management", path: "/admin/user-management" },
    { name: "Role Management", path: "/admin/role-management" },
    { name: "System Logs", path: "/admin/logs" },
    { name: "System Settings", path: "/admin/settings" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Admin Dashboard</h1>
      <p>Welcome to the Admin Control Panel. Choose a section below:</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        {adminFeatures.map((feature, index) => (
          <Link key={index} href={feature.path}>
            <div
              style={{
                padding: "1.5rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "8px",
                textAlign: "center",
                cursor: "pointer",
                transition: "0.2s ease-in-out",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#e0e0e0")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f5f5")}
            >
              <h2>{feature.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}