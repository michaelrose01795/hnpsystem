// file location: src/pages/dashboard/painting/index.js

"use client";

import React, { useEffect, useState } from "react";
import { getPaintingDashboardData } from "@/lib/database/dashboard/painting";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import PaintingDashboardUi from "@/components/page-ui/dashboard/painting/dashboard-painting-ui"; // Extracted presentation layer.
const MetricCard = ({ label, value, helper }) =>
<div
  className="app-section-card"
  style={{
    minWidth: 180
  }}>
  
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>;


const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) =>
      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--info)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`,
              height: "100%",
              background: "var(--danger)",
              borderRadius: 4
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{point.count}</strong>
        </div>
      )}
    </div>);

};

const QueueList = ({ queue }) =>
<div
  style={{
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    background: "var(--surface)",
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  }}>
  
    {queue.length === 0 ?
  <p style={{ margin: 0, color: "var(--info)" }}>No painting jobs in queue.</p> :

  queue.map((job) =>
  <div
    key={job.id}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "var(--info-dark)"
    }}>
    
          <div>
            <strong style={{ color: "var(--primary-dark)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{job.vehicle_reg || "Plate"}</p>
          </div>
          <span style={{ color: "var(--info)" }}>{job.status || "In progress"}</span>
        </div>
  )
  }
  </div>;


const defaultData = {
  bodyshopCount: 0,
  queue: [],
  trends: []
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

  return <PaintingDashboardUi view="section1" data={data} error={error} loading={loading} MetricCard={MetricCard} QueueList={QueueList} Section={Section} TrendBlock={TrendBlock} />;












































}
