// file location: src/pages/dashboard/parts/index.js
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getPartsDashboardData } from "@/lib/database/dashboard/parts";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md §3.0)
import PartsDashboardUi from "@/components/page-ui/dashboard/parts/dashboard-parts-ui"; // Extracted presentation layer.

// MetricCard — single stat tile. Lives inside a themed section (LayerTheme)
// on this dashboard, so per the strict alternation rule it renders as a LayerSurface.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 180 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-2)" }}>{helper}</p>}
  </LayerSurface>
);


const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) =>
      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.8rem", color: "var(--info)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`,
              height: "100%",
              background: "var(--accent-purple)",
              borderRadius: 4
            }} />

          </div>
          <strong style={{ color: "var(--primary-selected)" }}>{point.count}</strong>
        </div>
      )}
    </div>);

};

const humanizeStatusLabel = (value) => {
  if (!value) return "Unknown";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ListBlock — list block inside a themed section (LayerTheme), renders as LayerSurface.
const ListBlock = ({ title, items }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-accent)" }}>{title}</p>
    {(items || []).length === 0 ?
      <p style={{ margin: 0, color: "var(--text-2)" }}>No records yet.</p> :
      items.map((entry) =>
        <div key={entry.request_id} style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
          Request <strong style={{ color: "var(--text-accent)" }}>{entry.request_id}</strong>
          <span style={{ color: "var(--text-2)" }}> · {humanizeStatusLabel(entry.status)}</span>
        </div>
      )
    }
  </LayerSurface>
);


export default function PartsDashboard() {
  const { user } = useUser();
  const roleLabels = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = roleLabels.includes("parts") || roleLabels.includes("parts manager");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestSummary = data?.requestSummary ?? {};
  const stockAlerts = data?.stockAlerts || [];
  const requestsByStatus = data?.requestsByStatus || [];
  const recentRequests = data?.recentRequests || [];
  const trendData = data?.trend || [];

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

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
  }, [hasAccess]);

  if (!hasAccess) {
    return <PartsDashboardUi view="section1" />;
  }

  return <PartsDashboardUi view="section2" data={data} error={error} LayerSurface={LayerSurface} LayerTheme={LayerTheme} ListBlock={ListBlock} loading={loading} MetricCard={MetricCard} recentRequests={recentRequests} requestsByStatus={requestsByStatus} requestSummary={requestSummary} Section={Section} stockAlerts={stockAlerts} TrendBlock={TrendBlock} trendData={trendData} />;
}
