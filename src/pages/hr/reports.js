// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/reports.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard } from "@/components/HR/MetricCard";

function ReportsContent() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
            Generate HR analytics, download data sets, and schedule automated exports.
          </p>
        </header>

        <SectionCard title="Report Metrics" subtitle="Overview of report activity.">
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch report metrics from Supabase analytics. Display scheduled exports count, reports generated (30d), downloads (30d), and alerts triggered.
          </p>
        </SectionCard>

        <SectionCard
          title="Quick Export"
          subtitle="Choose a report and export format."
        >
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch available report types from Supabase. Build export form with report type dropdown, format selection (CSV/Excel/PDF), date range picker, and generate/schedule actions.
          </p>
        </SectionCard>

        <SectionCard
          title="Report Catalogue"
          subtitle="Available HR reporting templates."
        >
          <p style={{ fontSize: "0.75rem", color: "var(--info)", fontStyle: "italic", margin: 0 }}>
            TODO: Fetch report templates from Supabase. Display each report with title, description, supported formats, and a "View definition" action.
          </p>
        </SectionCard>
    </div>
  );
}

export default function HrReportsExports({ embedded = false } = {}) {
  const content = <ReportsContent />;
  return embedded ? content : <Layout>{content}</Layout>;
}

