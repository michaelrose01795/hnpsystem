// file location: src/components/dashboards/TechDashboard.js
import React from "react";
import NewsFeed from "../../pages/newsfeed";

export default function TechDashboard() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "16px", color: "#FF4040" }}>
        Technician Dashboard
      </h1>
      <p>Here you can see your jobs, clocking, and updates.</p>

      <NewsFeed />
    </div>
  );
}
