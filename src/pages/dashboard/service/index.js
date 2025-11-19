// ✅ Imports converted to use absolute alias "@/"
import React from "react";
import Layout from "@/components/Layout";

export default function ServiceDashboard() {
  return (
    <Layout>
      <div style={{ padding: "24px" }}>
        <h1 style={{ color: "#FF4040" }}>Service Dashboard</h1>
        <p>
          Arrival trends, advisor performance signals, and customer touchpoints will populate here once the service
          telemetry is wired.
        </p>
      </div>
    </Layout>
  );
}
