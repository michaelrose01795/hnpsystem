// src/pages/management/index.js
import React from "react";
import Link from "next/link";

export default function ManagementDashboard() {
  const managerFeatures = [
    { name: "Reports & Analytics", path: "/management/reports" },
    { name: "Job & Parts Approvals", path: "/management/approvals" },
    { name: "Staff Performance", path: "/management/staff" },
    { name: "Sales Tracking", path: "/management/sales-tracking" },
    { name: "Workshop Utilization", path: "/management/workshop" },
  ];

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Management Dashboard</h1>
      <p>Welcome, Manager. Select a section below:</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        {managerFeatures.map((feature, index) => (
          <Link key={index} href={feature.path}>
            <div
              style={{
                padding: "1.8rem",
                background: "#f5f5f5",
                border: "1px solid #ddd",
                borderRadius: "8px",
                textAlign: "center",
                cursor: "pointer",
                transition: "0.2s ease-in-out",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#e0e0e0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "#f5f5f5")
              }
            >
              <h2>{feature.name}</h2>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}