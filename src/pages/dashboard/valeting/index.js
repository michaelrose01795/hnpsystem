"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getValetingDashboardData } from "@/lib/database/dashboard/valeting";

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid #ffe0e0",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 160,
      background: "#fff",
      boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "#6b7280" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "#f5f5f5", borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.round((point.count / max) * 100)}%`,
                height: "100%",
                background: "#2563eb",
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ color: "#a00000" }}>{point.count}</strong>
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
      border: "1px solid #ffe0e0",
      borderRadius: "12px",
      padding: "12px",
      background: "#fff",
    }}
  >
    {queue.length === 0 ? (
      <p style={{ margin: 0, color: "#6b7280" }}>No cars waiting.</p>
    ) : (
      queue.map((job) => (
        <div
          key={job.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#374151",
          }}
        >
          <div>
            <strong style={{ color: "#a00000" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "#6b7280" }}>{job.waiting_status || "Ready"}</span>
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
            background: "linear-gradient(120deg, #f8fafc, #fff)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #dce4eb",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a00000" }}>
            Valeting desk
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Car wash queue</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Monitor the wash bay, track delays, and keep orders flowing.
          </p>
        </header>

        <Section title="Wash bay metrics">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Gathering wash bay metrics…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
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
            <p style={{ color: "#6b7280" }}>Refreshing queue…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
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
