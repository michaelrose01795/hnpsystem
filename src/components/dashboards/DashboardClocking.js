// file location: src/components/DashboardClocking.js
// Workshop Manager Clocking placeholders for 6 mechanics

import React from "react";

export default function DashboardClocking() {
  const techs = ["Tech 1", "Tech 2", "Tech 3", "Tech 4", "Tech 5", "Tech 6"];

  return (
    <div style={{ marginTop: "20px" }}>
      <h2 style={{ color: "#FF4040", marginBottom: "16px" }}>Workshop Clocking Overview</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "20px",
        }}
      >
        {techs.map((tech, index) => (
          <div
            key={index}
            style={{
              backgroundColor: "#FFF0F0",
              border: "1px solid #FFCCCC",
              borderRadius: "8px",
              padding: "16px",
              textAlign: "center",
              minHeight: "100px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              fontWeight: "500",
              fontSize: "1rem",
              color: "#FF4040",
            }}
          >
            <div>{tech}</div>
            <div style={{ marginTop: "10px", color: "#FF8080" }}>Status: --</div>
          </div>
        ))}
      </div>
    </div>
  );
}
