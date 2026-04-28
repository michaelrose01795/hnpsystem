// file location: src/pages/dashboard/service/index.js
"use client";

import React, { useEffect, useState } from "react";
import { getServiceDashboardData } from "@/lib/database/dashboard/service";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import ServiceDashboardUi from "@/components/page-ui/dashboard/service/dashboard-service-ui"; // Extracted presentation layer.
const MetricCard = ({ label, value, helper }) =>
<div
  className="app-section-card"
  style={{
    minWidth: 160
  }}>
  
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.8rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>;


const PieChart = ({ breakdown }) => {
  const total = breakdown.waiting + breakdown.loan + breakdown.collection || 1;
  const segments = [
  { label: "Waiting", value: breakdown.waiting, color: "var(--danger)" },
  { label: "Loan car", value: breakdown.loan, color: "var(--accent-purple)" },
  { label: "Collection", value: breakdown.collection, color: "var(--info)" }];


  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {segments.map((segment) =>
      <div key={segment.label} style={{ minWidth: 140 }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--info)" }}>{segment.label}</p>
          <div
          style={{
            height: 12,
            width: "100%",
            background: "var(--surface)",
            borderRadius: 6,
            overflow: "hidden"
          }}>
          
            <div
            style={{
              width: `${Math.round(segment.value / total * 100)}%`,
              height: "100%",
              background: segment.color
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{segment.value}</strong>
        </div>
      )}
    </div>);

};

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px",
        border: "none",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface)"
      }}>
      
      {(data || []).map((point) =>
      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--info)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`,
              height: "100%",
              background: "var(--success)",
              borderRadius: 4
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{point.count}</strong>
        </div>
      )}
    </div>);

};

const ProgressBar = ({ completed, target }) => {
  const percentage = Math.min(100, Math.round(completed / target * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info)" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--surface)", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--danger)",
            borderRadius: 5
          }} />
        
      </div>
    </div>);

};

const QueueItem = ({ job }) =>
<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px 14px",
    background: "var(--surface)"
  }}>
  
    <div>
      <strong style={{ color: "var(--primary-dark)" }}>{job.job_number || "—"}</strong>
      <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
        {job.vehicle_reg || "Plate missing"}
      </p>
    </div>
    <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>{job.status || "Status unknown"}</span>
  </div>;


const defaultData = {
  appointmentsToday: 0,
  appointmentTrends: [],
  customerStatuses: [],
  waitingBreakdown: { waiting: 0, loan: 0, collection: 0 },
  upcomingJobs: [],
  awaitingVhc: [],
  vhcSeverityTrend: [],
  progress: { completed: 0, scheduled: 1 }
};

export default function ServiceDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getServiceDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load service dashboard", fetchError);
        setError(fetchError.message || "Unable to load service data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return <ServiceDashboardUi view="section1" data={data} error={error} loading={loading} MetricCard={MetricCard} PieChart={PieChart} ProgressBar={ProgressBar} QueueItem={QueueItem} Section={Section} TrendBlock={TrendBlock} />;






















































































































}
