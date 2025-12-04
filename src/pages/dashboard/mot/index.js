"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getMotDashboardData } from "@/lib/database/dashboard/mot";

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
      border: "1px solid var(--danger-surface)",
      borderRadius: "14px",
      padding: "16px",
      minWidth: 160,
      background: "var(--surface)",
      boxShadow: "0 10px 20px rgba(var(--shadow-rgb),0.04)",
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
                background: "var(--success)",
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

const CardList = ({ title, items }) => (
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
    <p style={{ margin: 0, fontWeight: 600, color: "var(--primary-dark)" }}>{title}</p>
    {items.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No records.</p>
    ) : (
      items.map((job) => (
        <div
          key={job.id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info-dark)" }}
        >
          <div>
            <strong style={{ color: "var(--primary-dark)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "var(--info)" }}>{job.completion_status || "Pending"}</span>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  testsToday: 0,
  passCount: 0,
  failCount: 0,
  retestCount: 0,
  recentTests: [],
  trends: [],
};

export default function MotDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getMotDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load MOT dashboard", fetchError);
        setError(fetchError.message || "Unable to load MOT data");
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
            background: "linear-gradient(120deg, var(--surface-light), var(--surface-light))",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--surface-light)",
            boxShadow: "0 18px 30px rgba(var(--primary-rgb),0.08)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            MOT workspace
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Today's test board</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Track pass/fail rates, retests, and the queue for testers.
          </p>
        </header>

        <Section title="Daily MOT tally">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading daily totals…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Tests today" value={data.testsToday} helper="Checked in today" />
              <MetricCard label="Passed" value={data.passCount} helper="Completion includes pass" />
              <MetricCard label="Failed" value={data.failCount} helper="Status includes fail" />
              <MetricCard label="Retests" value={data.retestCount} helper="Needs follow-up" />
            </div>
          )}
        </Section>

        <Section title="Recent MOT jobs" subtitle="Latest registered jobs">
          <CardList title="Recent MOTs" items={data.recentTests} />
        </Section>

        <Section title="Trend" subtitle="Tests checked in over the last 7 days">
          <TrendBlock data={data.trends} />
        </Section>
      </div>
    </Layout>
  );
}
