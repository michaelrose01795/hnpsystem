// file location: src/pages/dashboard/painting/index.js

"use client";

import React, { useEffect, useState } from "react";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import PaintingDashboardUi from "@/components/page-ui/dashboard/painting/dashboard-painting-ui";
import { LayerSurface, LayerTheme } from "@/components/ui";
import { getPaintingDashboardData } from "@/lib/database/dashboard/painting";

// Metric cards live inside themed dashboard sections, so they render on --surface.
const MetricCard = ({ label, value, helper, sectionKey, parentKey }) => (
  <LayerSurface
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType="stat-card"
    backgroundToken="surface"
    radius="var(--radius-sm)"
    data-dev-text-preview={label}
    className="glass-card"
    style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)", minWidth: 0 }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{helper}</p>}
  </LayerSurface>
);

const TrendBlock = ({ data, parentKey }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));

  return (
    <DevLayoutSection
      sectionKey="dashboard-painting-trend-list"
      parentKey={parentKey}
      sectionType="section-shell"
      backgroundToken="transparent"
      data-dev-text-preview="Painting workshop starts trend list"
      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
    >
      {(data || []).map((point, index) => (
        <LayerSurface
          key={point.label}
          sectionKey={`dashboard-painting-trend-${index + 1}`}
          parentKey="dashboard-painting-trend-list"
          sectionType="stat-card"
          backgroundToken="surface"
          data-dev-text-preview={`${point.label} ${point.count}`}
          radius="var(--radius-sm)"
          padding="8px 12px"
          className="glass-card"
          style={{
            background: "var(--glass-surface)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--glass-shadow)",
            flexDirection: "row",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--text-1)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--theme)", borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.round((point.count / max) * 100)}%`,
                height: "100%",
                background: "var(--danger)",
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ color: "var(--text-accent)" }}>{point.count}</strong>
        </LayerSurface>
      ))}
    </DevLayoutSection>
  );
};

// Queue rows live inside the themed paint queue section, so they render on --surface.
const QueueList = ({ queue, parentKey }) => (
  <DevLayoutSection
    sectionKey="dashboard-painting-queue-list"
    parentKey={parentKey}
    sectionType="section-shell"
    backgroundToken="transparent"
    data-dev-text-preview="Painting jobs queue list"
    style={{ display: "flex", flexDirection: "column", gap: "10px" }}
  >
    {queue.length === 0 ? (
      <LayerSurface
        sectionKey="dashboard-painting-queue-empty"
        parentKey="dashboard-painting-queue-list"
        sectionType="content-card"
        backgroundToken="surface"
        radius="var(--radius-sm)"
        padding="16px"
        data-dev-text-preview="No painting jobs in queue"
        className="glass-card"
        style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)", color: "var(--text-1)" }}
      >
        No painting jobs in queue.
      </LayerSurface>
    ) : (
      queue.map((job) => (
        <LayerSurface
          key={job.id}
          sectionKey={`dashboard-painting-queue-row-${job.id}`}
          parentKey="dashboard-painting-queue-list"
          sectionType="content-card"
          backgroundToken="surface"
          data-dev-text-preview={`${job.job_number || "Job"} ${job.vehicle_reg || "Plate"} ${job.status || "In progress"}`}
          radius="var(--radius-sm)"
          padding="14px 16px"
          className="glass-card"
          style={{
            background: "var(--glass-surface)",
            backdropFilter: "var(--glass-blur)",
            WebkitBackdropFilter: "var(--glass-blur)",
            boxShadow: "var(--glass-shadow)",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            color: "var(--text-1)",
          }}
        >
          <div>
            <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "..."}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "var(--text-1)" }}>{job.status || "In progress"}</span>
        </LayerSurface>
      ))
    )}
  </DevLayoutSection>
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
    <PaintingDashboardUi
      view="section1"
      data={data}
      error={error}
      LayerTheme={LayerTheme}
      loading={loading}
      MetricCard={MetricCard}
      QueueList={QueueList}
      TrendBlock={TrendBlock}
    />
  );
}
