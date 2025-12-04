"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getValetingDashboardData } from "@/lib/database/dashboard/valeting";

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
      minWidth: 160,
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

const QueueList = ({ queue }) => (
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
    {queue.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No cars waiting.</p>
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
          <span style={{ color: "var(--info)" }}>{job.waiting_status || "Ready"}</span>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  waitingCount: 0,
  washedCount: 0,
  delayedCount: 0,
  waitingQueue: [],
  trends: [],
};

export default function ValetingDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getValetingDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load valeting metrics", fetchError);
        setError(fetchError.message || "Unable to load valeting data");
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
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--info)",
            boxShadow: "0 18px 30px rgba(var(--shadow-rgb),0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-dark)" }}>
            Valeting desk
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Car wash queue</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Monitor the wash bay, track delays, and keep orders flowing.
          </p>
        </header>

        <Section title="Wash bay metrics">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Gathering wash bay metrics…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Cars waiting wash" value={data.waitingCount} helper="Checked in but not started" />
              <MetricCard label="Cars washed" value={data.washedCount} helper="Wash started" />
              <MetricCard label="Cars delayed" value={data.delayedCount} helper="Waiting-status includes delay" />
            </div>
          )}
        </Section>

        <Section title="Waiting for wash" subtitle="Cars checked in and ready">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Refreshing queue…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <QueueList queue={data.waitingQueue} />
          )}
        </Section>

        <Section title="Queue trend" subtitle="Wash starts last 7 days">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </Layout>
  );
}
