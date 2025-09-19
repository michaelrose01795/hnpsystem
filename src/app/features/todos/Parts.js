"use client";
import React from "react";
import Link from "next/link";

export default function Parts() {
  const partsFeatures = [
    { name: "Parts Inventory", path: "/features/todos/PartsInventory" },
    { name: "Parts Requests", path: "/features/todos/PartsRequests" },
    { name: "Parts Sales Tracking", path: "/features/todos/PartsSales" },
  ];

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Parts Module</h1>
      <p>Manage all parts, requests, and sales tracking.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.2rem",
          marginTop: "2rem",
        }}
      >
        {partsFeatures.map((feature, index) => (
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