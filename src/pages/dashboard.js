// file location: src/pages/dashboard.js
// Dashboard page with role awareness, protected access, and wrapped in Layout

import React from "react"; // React core
import ProtectedRoute from "../components/ProtectedRoute"; // Protects the route
import { useUser } from "../context/UserContext"; // Access user + role
import Layout from "../components/Layout"; // Shared sidebar + topbar layout

export default function DashboardPage() {
  const { user } = useUser(); // Get logged-in user (logout handled in Layout)

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Dashboard header */}
          <header>
            <h2 className="text-2xl font-bold">H&P Dashboard</h2>
            <p className="text-gray-600">
              Signed in as <strong>{user?.username}</strong> — Role:{" "}
              <strong>{user?.role}</strong>
            </p>
          </header>

          {/* Quick status section */}
          <section>
            <h3 className="text-xl font-semibold">Quick Status</h3>
            <p className="text-gray-700">
              Phase 1.3 MVP: Layout + Navigation is working. Next step: connect
              Keycloak + role detection.
            </p>
          </section>

          {/* Cards grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-lg shadow">
              <strong>Jobs</strong>
              <div className="mt-2 text-gray-600">
                Placeholder for incoming jobs / progress bar
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg shadow">
              <strong>Clocking</strong>
              <div className="mt-2 text-gray-600">
                Placeholder for mechanic clocking status
              </div>
            </div>

            <div className="p-4 bg-white rounded-lg shadow">
              <strong>Parts</strong>
              <div className="mt-2 text-gray-600">
                Placeholder for parts requests
              </div>
            </div>
          </section>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
