// file location: src/pages/dashboard/mot/index.js
"use client";

import React, { useEffect, useState } from "react";
import { getMotDashboardData } from "@/lib/database/dashboard/mot";
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md section 3.0)
import MotDashboardUi from "@/components/page-ui/dashboard/mot/dashboard-mot-ui"; // Extracted presentation layer.

// MetricCard - single stat tile. Lives inside a themed MOT section,
// so it renders on the neutral surface layer.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface
    className="glass-card"
    radius="var(--radius-sm)"
    style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)", minWidth: 160 }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)", opacity: 0.7 }}>{helper}</p>}
  </LayerSurface>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--text-1)", opacity: 0.75 }}>{point.label}</span>
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
          <strong style={{ color: "var(--text-accent)" }}>{point.count}</strong>
        </div>
      ))}
    </div>
  );
};

// CardList - list block inside a themed MOT section, renders as LayerSurface.
const CardList = ({ title, items }) => (
  <LayerSurface
    className="glass-card"
    radius="var(--radius-sm)"
    padding="12px"
    gap="10px"
    style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)" }}
  >
    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-accent)" }}>{title}</p>
    {items.length === 0 ? (
      <p style={{ margin: 0, color: "var(--text-1)", opacity: 0.7 }}>No records.</p>
    ) : (
      items.map((job) => (
        <div
          key={job.id}
          style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-1)" }}
        >
          <div>
            <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "-"}</strong>
            <p style={{ margin: "4px 0 0", color: "var(--text-1)", opacity: 0.7 }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "var(--text-1)", opacity: 0.75 }}>{job.completion_status || "Pending"}</span>
        </div>
      ))
    )}
  </LayerSurface>
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
    <MotDashboardUi
      view="section1"
      CardList={CardList}
      data={data}
      error={error}
      LayerTheme={LayerTheme}
      loading={loading}
      MetricCard={MetricCard}
      TrendBlock={TrendBlock}
    />
  );
}
