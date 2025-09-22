// file location: src/pages/dashboard.js
import React from "react";
import Layout from "../components/Layout";
import Section from "../components/Section";
import ProtectedRoute from "../components/ProtectedRoute";
import { useUser } from "../context/UserContext";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <ProtectedRoute>
      <Layout>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Section title="Jobs">
            Placeholder for incoming jobs / progress bar
          </Section>

          <Section title="Clocking">
            Placeholder for mechanic clocking status
          </Section>

          <Section title="Parts">
            Placeholder for parts requests
          </Section>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
