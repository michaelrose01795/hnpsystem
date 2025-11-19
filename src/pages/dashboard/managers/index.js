"use client";

import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { CombinedPerformanceView, useCombinedPerformanceMetrics } from "@/pages/dashboard/after-sales";

const MANAGER_ROLES = [
  "service manager",
  "workshop manager",
  "parts manager",
  "admin manager",
  "accounts manager",
  "general manager",
  "owner",
];

export default function ManagersDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = MANAGER_ROLES.some((role) => userRoles.includes(role));

  const metrics = useCombinedPerformanceMetrics();

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the Managers dashboard.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <CombinedPerformanceView
        {...metrics}
        title="Managers dashboard"
        heading="Executive service & workshop view"
        description="A consolidated readout of workshop throughput, VHC, and approval signals for leadership."
      />
    </Layout>
  );
}
