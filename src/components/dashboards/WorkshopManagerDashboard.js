import React from "react";

export default function WorkshopManagerDashboard() {
  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#FF4040", marginBottom: "16px" }}>
        Workshop Manager Dashboard
      </h1>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Pending Jobs</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>5 vehicles are waiting for inspection.</p>
        </div>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Clocking Overview</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Technicians clocked in: 6 / 7</p>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "600", marginBottom: "12px" }}>Important Notices</h2>
        <div style={{ padding: "12px", backgroundColor: "#FFF0F0", borderRadius: "6px" }}>
          <p>Remember to review workshop safety guidelines.</p>
        </div>
      </section>
    </div>
  );
}
