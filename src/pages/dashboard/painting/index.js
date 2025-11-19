"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getPaintingDashboardData } from "@/lib/database/dashboard/painting";

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
      minWidth: 180,
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
                background: "#f97316",
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
      border: "1px solid #ffe0e0",
      borderRadius: "12px",
      padding: "12px",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    {queue.length === 0 ? (
      <p style={{ margin: 0, color: "#6b7280" }}>No painting jobs in queue.</p>
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
          <span style={{ color: "#6b7280" }}>{job.status || "In progress"}</span>
        </div>
      ))}
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
            background: "linear-gradient(120deg, #fff7ed, #fff9f1)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffe2c6",
            boxShadow: "0 18px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Painting studio
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Bodyshop queue</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Track paint jobs waiting on the bay and pull estimated finish times directly from job timestamps.
          </p>
        </header>

        <Section title="Bodyshop jobs">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading bodyshop jobs…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <MetricCard label="Bodyshop jobs" value={data.bodyshopCount} helper="Jobs requiring bodywork" />
          )}
        </Section>

        <Section title="Paint queue" subtitle="Jobs still in progress">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading queue…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
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
