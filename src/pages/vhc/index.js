// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/vhc/index.js
"use client";

import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { usersByRole } from "@/config/users";
import DashboardPage from "@/pages/vhc/dashboard";

export default function VHCIndex() {
  const { user } = useUser();
  const username = user?.username;
  const allowedUsers = [
    ...(usersByRole["Service"] || []),
    ...(usersByRole["Service Manager"] || []),
    ...(usersByRole["Workshop Manager"] || []),
    ...(usersByRole["Admin"] || []),
  ];
  const hasAccess = allowedUsers.includes(username);

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
