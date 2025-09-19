"use client";
import React, { useState, useEffect } from "react";

// Placeholder KPI data
const mockKPIs = {
  activeJobs: 32,
  activeUsers: 14,
  revenueToday: "£4,520",
  partsRequests: 12,
};

export default function Dashboard() {
  const [kpis, setKpis] = useState({});

  useEffect(() => {
    // Later fetch from backend API
    setKpis(mockKPIs);
  }, []);

  return (
    <div style={{ padding: "1rem" }}>
      <h1>System Dashboard</h1>
      <p>Overview of current workshop and sales performance.</p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1.5rem",
          marginTop: "2rem",
        }}
      >
        <div style={cardStyle}>
          <h2>{kpis.activeJobs}</h2>
          <p>Active Jobs</p>
        </div>

        <div style={cardStyle}>
          <h2>{kpis.activeUsers}</h2>
          <p>Active Users</p>
        </div>

        <div style={cardStyle}>
          <h2>{kpis.revenueToday}</h2>
          <p>Revenue Today</p>
        </div>

        <div style={cardStyle}>
          <h2>{kpis.partsRequests}</h2>
          <p>Pending Parts Requests</p>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#f5f5f5",
  padding: "2rem",
  borderRadius: "8px",
  textAlign: "center",
  border: "1px solid #ddd",
  boxShadow: "0px 2px 6px rgba(0,0,0,0.05)",
};