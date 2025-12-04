// file location: src/pages/dashboard/painting/index.js

"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getPaintingDashboardData } from "@/lib/database/dashboard/painting";

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
  const max = Math.max(1, ...(data || []).map((point) => point.count));
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
                background: "var(--danger)",
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

const QueueList = ({ queue }) => (
  <div
    style={{
      border: "1px solid var(--surface-light)",
      borderRadius: "12px",
      padding: "12px",
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    {queue.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No painting jobs in queue.</p>
    ) : (
      queue.map((job) => (
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
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "var(--info)" }}>{job.status || "In progress"}</span>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  bodyshopCount: 0,
  queue: [],
  trends: [],
};

export default function PaintingDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getPaintingDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load painting dashboard", fetchError);
        setError(fetchError.message || "Unable to load painting data");
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
            background: "linear-gradient(120deg, var(--warning-surface), var(--warning-surface))",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--warning)",
            boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            Painting studio
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Bodyshop queue</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Track paint jobs waiting on the bay and pull estimated finish times directly from job timestamps.
          </p>
        </header>

        <Section title="Bodyshop jobs">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading bodyshop jobs…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <MetricCard label="Bodyshop jobs" value={data.bodyshopCount} helper="Jobs requiring bodywork" />
          )}
        </Section>

        <Section title="Paint queue" subtitle="Jobs still in progress">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading queue…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <QueueList queue={data.queue} />
          )}
        </Section>

        <Section title="Queue trend" subtitle="Recent workshop starts">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </Layout>
  );
}