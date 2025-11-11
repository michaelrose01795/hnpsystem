// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/vhc/index.js
"use client";

import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { useRoster } from "@/context/RosterContext";
import DashboardPage from "@/pages/vhc/dashboard";

export default function VHCIndex() {
  const { user } = useUser();
  const { usersByRole, isLoading } = useRoster();
  // ⚠️ Mock data found — replacing with Supabase query
  // ✅ Mock data replaced with Supabase integration (see seed-test-data.js for initial inserts)
  const username = user?.username;
  const allowedUsers = React.useMemo(() => {
    if (!usersByRole) return [];
    return [
      ...(usersByRole["Service"] || []),
      ...(usersByRole["Service Manager"] || []),
      ...(usersByRole["Workshop Manager"] || []),
      ...(usersByRole["Admin"] || []),
    ];
  }, [usersByRole]);
  const hasAccess = allowedUsers.includes(username);

  if (isLoading) {
    return (
      <Layout>
        <div style={{ padding: "20px", color: "#6B7280" }}>
          Loading permissions…
        </div>
      </Layout>
    );
  }

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "20px" }}>
          <p style={{ color: "#ef4444", fontWeight: "600", fontSize: "16px" }}>
            You do not have access to the VHC page.
          </p>
          <div
            style={{
              marginTop: "20px",
              padding: "20px",
              background: "#f5f5f5",
              borderRadius: "8px",
            }}
          >
            <p>
              <strong>Current User:</strong> {username || "Not logged in"}
            </p>
            <p>
              <strong>Allowed Users:</strong>{" "}
              {allowedUsers.join(", ") || "None"}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return <DashboardPage />;
}
