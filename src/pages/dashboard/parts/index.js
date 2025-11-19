"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getPartsDashboardData } from "@/lib/database/dashboard/parts";

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
      minWidth: 180,
      borderRadius: "14px",
      padding: "16px",
      background: "#fff",
      border: "1px solid #ffe0e0",
      boxShadow: "0 10px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.8rem", color: "#6b7280" }}>{point.label}</span>
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

const ListBlock = ({ title, items }) => (
  <div
    style={{
      border: "1px solid #ffe0e0",
      borderRadius: "12px",
      padding: "12px",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    }}
  >
    <p style={{ margin: 0, fontWeight: 600, color: "#a00000" }}>{title}</p>
    {(items || []).length === 0 ? (
      <p style={{ margin: 0, color: "#6b7280" }}>No records yet.</p>
    ) : (
      items.map((entry) => (
        <div key={entry.request_id} style={{ fontSize: "0.85rem", color: "#374151" }}>
          Request <strong>{entry.request_id}</strong> · {entry.status}
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  requestSummary: {
    totalRequests: 0,
    partsOnOrder: 0,
    prePicked: 0,
    delayedOrders: 0,
  },
  stockAlerts: [],
  requestsByStatus: [],
  recentRequests: [],
  trend: [],
};

export default function PartsDashboard() {
  const { user } = useUser();
  const roleLabels = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roleLabels.includes("parts") || roleLabels.includes("parts manager");

  if (!hasAccess) {
    return (
      <Layout>
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          You do not have access to the Parts dashboard.
        </div>
      </Layout>
    );
  }
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getPartsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load parts dashboard", fetchError);
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
            background: "linear-gradient(120deg, #f8fafc, #fff)",
            borderRadius: "18px",
            border: "1px solid #dce4eb",
            padding: "24px",
            boxShadow: "0 16px 30px rgba(0,0,0,0.05)",
          }}
        >
          <p style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.1em", color: "#a00000" }}>Parts desk</p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Operations overview</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Live stock, inbound, and request telemetry from the parts catalogue.
          </p>
        </header>

        <Section title="Request snapshot" subtitle="New and pre-picks today">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading request counts…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Parts requests" value={data.requestSummary.totalRequests} helper="Open requests" />
              <MetricCard label="Parts on order" value={data.requestSummary.partsOnOrder} helper="Units on order" />
              <MetricCard label="Pre picked" value={data.requestSummary.prePicked} helper="Assigned to racks" />
              <MetricCard label="Delayed orders" value={data.requestSummary.delayedOrders} helper="Missing qty" />
            </div>
          )}
        </Section>

        <Section title="Requests trend" subtitle="Last 7 days">
          <TrendBlock data={data.trend} />
        </Section>

        <Section title="Stock levels" subtitle="Lowest availability items">
          {data.stockAlerts.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No low stock alerts yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.stockAlerts.map((part) => (
                <div
                  key={part.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "1px solid #ffe0e0",
                    background: "#fff",
                  }}
                >
                  <div>
                    <strong>{part.label}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      Reorder at {part.reorderLevel}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, color: "#a00000" }}>{part.inStock}</p>
                    <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#6b7280" }}>In stock</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Requests by status">
          {data.requestsByStatus.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>Waiting for request data.</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {data.requestsByStatus.map((row) => (
                <div
                  key={row.status}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #ffe0e0",
                    background: "#fff",
                    minWidth: 150,
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}>{row.status}</p>
                  <strong style={{ color: "#a00000" }}>{row.count}</strong>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Recent requests" subtitle="Most recent entries">
          <ListBlock title="Recent requests" items={data.recentRequests} />
        </Section>
      </div>
    </Layout>
  );
}
