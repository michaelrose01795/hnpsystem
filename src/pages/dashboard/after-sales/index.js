// file location: src/pages/dashboard/after-sales/index.js
import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import AfterSalesManagerDashboard from "@/components/dashboards/AfterSalesManagerDashboard";

const ALLOWED_ROLES = ["after sales manager", "after sales director", "aftersales manager"];

export default function AfterSalesDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = ALLOWED_ROLES.some((role) => userRoles.includes(role));

  return (
    <Layout>
      {hasAccess ? (
        <AfterSalesManagerDashboard />
      ) : (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the after sales dashboard.
        </div>
      )}
    </Layout>
  );
}
