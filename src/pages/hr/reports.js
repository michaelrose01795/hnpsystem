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
          <p style={{ color: "var(--info)", marginTop: "6px" }}>
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
          <MetricCard icon="" label="Scheduled Exports" primary="4" accentColor="var(--accent-purple)" />
          <MetricCard icon="" label="Reports Generated (30d)" primary="18" accentColor="var(--success)" />
          <MetricCard icon="" label="Downloads (30d)" primary="126" accentColor="var(--danger)" />
          <MetricCard icon="" label="Alerts Triggered" primary="3" accentColor="var(--danger)" />
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
                  border: "1px solid var(--accent-purple-surface)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  background: "var(--surface)",
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--accent-purple)" }}>{report.title}</span>
                <p style={{ margin: 0, color: "var(--info-dark)", fontSize: "0.9rem" }}>{report.description}</p>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>Formats: {report.format}</span>
                <button type="button" style={buttonStyleSecondary}>
                  View definition
                </button>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--info)", marginTop: "16px" }}>
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
  background: "var(--accent-purple)",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleSecondary = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px solid var(--accent-purple)",
  background: "var(--surface)",
  color: "var(--accent-purple)",
  fontWeight: 600,
  cursor: "pointer",
};

const buttonStyleGhost = {
  padding: "8px 14px",
  borderRadius: "10px",
  border: "1px dashed var(--info)",
  background: "transparent",
  color: "var(--info)",
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  fontSize: "0.85rem",
  color: "var(--info-dark)",
  fontWeight: 600,
};

const inputStyle = {
  borderRadius: "10px",
  border: "1px solid var(--accent-purple-surface)",
  padding: "10px 12px",
  fontWeight: 500,
  color: "var(--accent-purple)",
  background: "var(--surface)",
};
