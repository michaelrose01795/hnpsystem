// PartsOpsDashboard already surfaces live queue and inbound information once the service layer is connected.
import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import PartsOpsDashboard from "@/components/dashboards/PartsOpsDashboard";

export default function PartsDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const hasAccess = userRoles.includes("parts") || userRoles.includes("parts manager");

  return (
    <Layout>
      {hasAccess ? (
        <PartsOpsDashboard />
      ) : (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the Parts dashboard.
        </div>
      )}
    </Layout>
  );
}
