// file location: src/pages/dashboard.js
import React from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import Layout from "../components/Layout";
import { useUser } from "../context/UserContext";
import Section from "../components/Section"; // Reusable widget component
import DashboardClocking from "../components/DashboardClocking"; // Added import

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Dashboard header */}
          <header>
            <h2 className="text-2xl font-bold">H&P Dashboard</h2>
            <p className="text-gray-600">
              Signed in as <strong>{user?.username || "Guest"}</strong> — Role:{" "}
              <strong>{user?.roles?.[0] || "Guest"}</strong>
            </p>
          </header>

          {/* Quick Status section */}
          <Section title="Quick Status">
            <p className="text-gray-700">
              Phase 1.3 MVP: Layout + Navigation is working. Next step: connect
              Keycloak + role detection.
            </p>
          </Section>

          {/* Cards grid for other sections */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Section title="Jobs">
              Placeholder for incoming jobs / progress bar
            </Section>

            <Section title="Clocking">
              {/* Replaced placeholder with DashboardClocking */}
              <DashboardClocking />
            </Section>

            <Section title="Parts">
              Placeholder for parts requests
            </Section>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
