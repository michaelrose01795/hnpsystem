// ✅ Imports converted to use absolute alias "@/"
// file location: /src/pages/workshop.js
import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import WorkshopManagerDashboard from "@/components/dashboards/WorkshopManagerDashboard";

export default function WorkshopPage() {
  return (
    <ProtectedRoute
      allowedRoles={[
        "WORKSHOP MANAGER",
        "AFTER SALES DIRECTOR",
        "SERVICE MANAGER",
        "PARTS MANAGER",
      ]}
    >
      <Layout>
        <WorkshopManagerDashboard />
      </Layout>
    </ProtectedRoute>
  );
}
