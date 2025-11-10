// ✅ Imports converted to use absolute alias "@/"
// file location: src/pages/hr/reports.js
import React from "react";
import Layout from "@/components/Layout";
import { SectionCard, MetricCard } from "@/components/HR/MetricCard";

// TODO: Drive these report exports and metrics from Supabase analytics endpoints.

// TODO: Replace placeholder reporting data with Supabase analytics once available.
const placeholderReports = [
  {
    id: "REP-1",
    title: "Attendance Summary",
    description: "Breakdown of attendance and absence per department.",
    format: "CSV / PDF",
  },
  {
    id: "REP-2",
    title: "Employee Turnover",
    description: "Monthly joiners/leavers and retention rate.",
    format: "CSV",
  },
  {
    id: "REP-3",
    title: "Salary & Compensation",
    description: "Total salary costs per team with overtime and bonuses.",
    format: "CSV / XLSX",
  },
  {
    id: "REP-4",
    title: "Training Compliance",
    description: "Percentage of staff compliant with mandatory training.",
    format: "PDF",
  },
];

export default function HrReportsExports() {
  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px 8px 32px" }}>
        <header>
          <p style={{ color: "#6B7280", marginTop: "6px" }}>
            Generate HR analytics, download data sets, and schedule automated exports.
          </p>
        </header>

        <section
          style={{
            display: "grid",
            gap: "18px",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <MetricCard icon="🧾" label="Scheduled Exports" primary="4" accentColor="#6366F1" />
          <MetricCard icon="📊" label="Reports Generated (30d)" primary="18" accentColor="#22C55E" />
          <MetricCard icon="📥" label="Downloads (30d)" primary="126" accentColor="#F97316" />
          <MetricCard icon="⚠️" label="Alerts Triggered" primary="3" accentColor="#EF4444" />
        </section>

        <SectionCard
          title="Quick Export"
          subtitle="Choose a report and export format."
        >
          <form style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <label style={labelStyle}>
              <span>Report Type</span>
              <select style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Select report
                </option>
                {placeholderReports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {report.title}
                  </option>
                ))}
              </select>
            </label>
            <label style={labelStyle}>
              <span>Format</span>
              <select style={inputStyle} defaultValue="">
                <option value="" disabled>
                  Pick format
                </option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel</option>
                <option value="pdf">PDF</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span>Date Range</span>
              <input style={inputStyle} type="month" />
            </label>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "12px" }}>
              <button type="button" style={buttonStylePrimary}>
                Generate report
              </button>
              <button type="button" style={buttonStyleGhost}>
                Schedule export
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Report Catalogue"
          subtitle="Available HR reporting templates."
        >
          <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            {placeholderReports.map((report) => (
              <div
                key={report.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  background: "white",
                }}
              >
                <span style={{ fontWeight: 600, color: "#111827" }}>{report.title}</span>
                <p style={{ margin: 0, color: "#4B5563", fontSize: "0.9rem" }}>{report.description}</p>
                <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>Formats: {report.format}</span>
                <button type="button" style={buttonStyleSecondary}>
                  View definition
                </button>
              </div>
            ))}
          </div>
          <p style={{ color: "#6B7280", marginTop: "16px" }}>
            Placeholder metrics for UI verification. Connect to Supabase views and export endpoints before go-live.
          </p>
        </SectionCard>
      </div>
    </Layout>
  );
}

const buttonStylePrimary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "none",
  background: "#6366F1",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid #C7D2FE",
  background: "white",
  color: "#4F46E5",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px dashed #D1D5DB",
  background: "transparent",
  color: "#6B7280",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "#374151",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  padding: "10px 12px",
  fontWeight: 500,
  color: "#111827",
  background: "#FFFFFF",
};
