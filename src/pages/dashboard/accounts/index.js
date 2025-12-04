// file location: src/pages/dashboard/accounts/index.js

"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getAccountsDashboardData } from "@/lib/database/dashboard/accounts";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "var(--surface)",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid var(--surface-light)",
      boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid var(--surface-light)",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 180,
      background: "var(--surface)",
      boxShadow: "0 10px 20px rgba(var(--shadow-rgb),0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--info)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.round((point.count / max) * 100)}%`,
                height: "100%",
                background: "var(--accent-purple)",
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{point.count}</strong>
        </div>
      ))}
    </div>
  );
};

const JobList = ({ jobs }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      border: "1px solid var(--surface-light)",
      borderRadius: "12px",
      padding: "12px",
      background: "var(--surface)",
    }}
  >
    {jobs.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No outstanding jobs right now.</p>
    ) : (
      jobs.map((job) => (
        <div
          key={job.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "var(--info-dark)",
          }}
        >
          <div>
            <strong style={{ color: "var(--primary-dark)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>Vehicle {job.vehicle_reg || "TBC"}</p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{job.status}</span>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  invoicesRaised: 0,
  invoicesPaid: 0,
  outstandingJobs: [],
  trends: [],
};

export default function AccountsDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAccountsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load accounts dashboard", fetchError);
        setError(fetchError.message || "Unable to load financial metrics");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "linear-gradient(120deg, var(--accent-purple-surface), var(--surface))",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--accent-purple-surface)",
            boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            Accounts cockpit
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Invoice performance</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Track invoices raised, items collected, and jobs awaiting billing.
          </p>
        </header>

        <Section title="Invoice stats">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading financial KPIs…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Invoices raised" value={data.invoicesRaised} helper="Status set to Invoiced" />
              <MetricCard label="Invoices paid" value={data.invoicesPaid} helper="Collected status" />
              <MetricCard
                label="Outstanding balances"
                value={data.outstandingJobs.length}
                helper="Jobs awaiting billing"
              />
            </div>
          )}
        </Section>

        <Section title="Outstanding jobs" subtitle="Most recent completions without invoice">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading outstanding jobs…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <JobList jobs={data.outstandingJobs} />
          )}
        </Section>

        <Section title="Completion trend" subtitle="Jobs completed in the last 7 days">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </Layout>
  );
}