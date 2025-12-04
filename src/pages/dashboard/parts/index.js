"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getPartsDashboardData } from "@/lib/database/dashboard/parts";

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
      minWidth: 180,
      borderRadius: "14px",
      padding: "16px",
      background: "var(--surface)",
      border: "1px solid var(--surface-light)",
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
          <span style={{ width: 35, fontSize: "0.8rem", color: "var(--info)" }}>{point.label}</span>
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

const ListBlock = ({ title, items }) => (
  <div
    style={{
      border: "1px solid var(--surface-light)",
      borderRadius: "12px",
      padding: "12px",
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}
  >
    <p style={{ margin: 0, fontWeight: 600, color: "var(--primary-dark)" }}>{title}</p>
    {(items || []).length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No records yet.</p>
    ) : (
      items.map((entry) => (
        <div key={entry.request_id} style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
          Request <strong>{entry.request_id}</strong> · {entry.status}
        </div>
      ))
    )}
  </div>
);

export default function PartsDashboard() {
  const { user } = useUser();
  const roleLabels = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roleLabels.includes("parts") || roleLabels.includes("parts manager");

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to the Parts dashboard.
        </div>
      </Layout>
    );
  }
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestSummary = data?.requestSummary ?? {};
  const stockAlerts = data?.stockAlerts || [];
  const requestsByStatus = data?.requestsByStatus || [];
  const recentRequests = data?.recentRequests || [];
  const trendData = data?.trend || [];

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getPartsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load parts dashboard", fetchError);
        setData(null);
        setError(fetchError.message || "Unable to load parts data");
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
            background: "linear-gradient(120deg, var(--info-surface), var(--surface))",
            borderRadius: "18px",
            border: "1px solid var(--info)",
            padding: "24px",
            boxShadow: "0 16px 30px rgba(var(--shadow-rgb),0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--primary-dark)" }}>Parts desk</p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Operations overview</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Live stock, inbound, and request telemetry from the parts catalogue.
          </p>
        </header>

        <Section title="Request snapshot" subtitle="New and pre-picks today">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading request counts…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : data ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard
                label="Parts requests"
                value={requestSummary.totalRequests ?? 0}
                helper="Open requests"
              />
              <MetricCard
                label="Parts on order"
                value={requestSummary.partsOnOrder ?? 0}
                helper="Units on order"
              />
              <MetricCard
                label="Pre picked"
                value={requestSummary.prePicked ?? 0}
                helper="Assigned to racks"
              />
              <MetricCard
                label="Delayed orders"
                value={requestSummary.delayedOrders ?? 0}
                helper="Missing qty"
              />
            </div>
          ) : (
            <p style={{ color: "var(--info)" }}>No request data available yet.</p>
          )}
        </Section>

        <Section title="Requests trend" subtitle="Last 7 days">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading request trends…</p>
          ) : trendData.length === 0 ? (
            <p style={{ color: "var(--info)" }}>No trend data available yet.</p>
          ) : (
            <TrendBlock data={trendData} />
          )}
        </Section>

        <Section title="Stock levels" subtitle="Lowest availability items">
          {loading ? (
            <p style={{ margin: 0, color: "var(--info)" }}>Loading stock alerts…</p>
          ) : stockAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "var(--info)" }}>No low stock alerts yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {stockAlerts.map((part) => (
                <div
                  key={part.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                  }}
                >
                  <div>
                    <strong>{part.label}</strong>
                    <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
                      Reorder at {part.reorderLevel}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "var(--primary-dark)" }}>{part.inStock}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>In stock</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Requests by status">
          {loading ? (
            <p style={{ margin: 0, color: "var(--info)" }}>Loading request status breakdown…</p>
          ) : requestsByStatus.length === 0 ? (
            <p style={{ margin: 0, color: "var(--info)" }}>Waiting for request data.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {requestsByStatus.map((row) => (
                <div
                  key={row.status}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid var(--surface-light)",
                    background: "var(--surface)",
                    minWidth: 150,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--info)" }}>{row.status}</p>
                  <strong style={{ color: "var(--primary-dark)" }}>{row.count}</strong>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recent requests" subtitle="Most recent entries">
          {loading ? (
            <p style={{ margin: 0, color: "var(--info)" }}>Loading recent requests…</p>
          ) : (
            <ListBlock title="Recent requests" items={recentRequests} />
          )}
        </Section>
      </div>
    </Layout>
  );
}
