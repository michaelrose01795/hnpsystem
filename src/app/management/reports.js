// src/pages/management/reports.js
import React from "react";

export default function ReportsAnalytics() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Reports & Analytics</h1>
      <p>Overview of key business performance metrics. (Placeholder data shown)</p>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        <div style={cardStyle}>
          <h2>Jobs Completed</h2>
          <p style={statStyle}>152</p>
        </div>
        <div style={cardStyle}>
          <h2>Cars Sold</h2>
          <p style={statStyle}>27</p>
        </div>
        <div style={cardStyle}>
          <h2>Revenue</h2>
          <p style={statStyle}>£185,000</p>
        </div>
        <div style={cardStyle}>
          <h2>Customer Satisfaction</h2>
          <p style={statStyle}>92%</p>
        </div>
      </div>

      {/* Placeholder Charts */}
      <div style={{ marginTop: "3rem" }}>
        <h2>Workshop Productivity</h2>
        <div style={chartPlaceholder}>[Bar Chart Placeholder]</div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h2>Sales Trends</h2>
        <div style={chartPlaceholder}>[Line Chart Placeholder]</div>
      </div>

      <div style={{ marginTop: "3rem" }}>
        <h2>Parts Requests</h2>
        <div style={chartPlaceholder}>[Pie Chart Placeholder]</div>
      </div>
    </div>
  );
}

// Styles
const cardStyle = {
  padding: "1.5rem",
  background: "#f5f5f5",
  border: "1px solid #ddd",
  borderRadius: "8px",
  textAlign: "center",
};

const statStyle = {
  fontSize: "2rem",
  fontWeight: "bold",
  marginTop: "0.5rem",
  color: "#0070f3",
};

const chartPlaceholder = {
  height: "250px",
  background: "#e0e0e0",
  border: "1px dashed #aaa",
  borderRadius: "8px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#555",
  fontSize: "1.2rem",
};