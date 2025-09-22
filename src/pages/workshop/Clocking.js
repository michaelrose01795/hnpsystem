// file location: src/pages/workshop/Clocking.js
import React from "react";

export default function Clocking() {
  const techs = ["Tech 1", "Tech 2", "Tech 3", "Tech 4", "Tech 5", "Tech 6"];
  const managerFeatures = ["Add Job", "Approve Parts", "Send Alert", "Generate Report", "Assign Tasks", "View Stats"];

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ color: "#FF4040", marginBottom: "20px" }}>Workshop Clocking</h1>

      <h2 style={{ marginBottom: "10px" }}>Mechanic Status</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "30px" }}>
        {techs.map((tech, i) => (
          <div key={i} style={{ backgroundColor: "#FFF0F0", border: "1px solid #FFCCCC", borderRadius: "8px", padding: "16px", textAlign: "center", fontWeight: "500", color: "#FF4040" }}>
            <div>{tech}</div>
            <div style={{ marginTop: "10px", color: "#FF8080" }}>Status: --</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginBottom: "10px" }}>Manager Actions (placeholders)</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
        {managerFeatures.map((feat, i) => (
          <div key={i} style={{ backgroundColor: "#FFF8F8", border: "1px solid #FFCCCC", borderRadius: "8px", padding: "16px", textAlign: "center", fontWeight: "500", color: "#FF4040" }}>
            {feat}
          </div>
        ))}
      </div>
    </div>
  );
}
