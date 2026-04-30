// file location: src/pages/dashboard/after-sales/index.js
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getAfterSalesDashboardData } from "@/lib/database/dashboard/after-sales";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import AfterSalesDashboardUi from "@/components/page-ui/dashboard/after-sales/dashboard-after-sales-ui"; // Extracted presentation layer.
const ALLOWED_ROLES = ["after sales manager", "after sales director", "aftersales manager"];

const MetricCard = ({ label, value, helper }) =>
<div
  className="app-section-card"
  style={{
    minWidth: 180
  }}>
  
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-selected)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>;


const ProgressBar = ({ completed, target }) => {
  const percentage = Math.min(100, Math.round(completed / target * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info)" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--surface)", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--info)",
            borderRadius: 5
          }} />
        
      </div>
    </div>);

};

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
              background: "var(--info)",
              borderRadius: 4
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-selected)" }}>{point.count}</strong>
        </div>
      )}
    </div>);

};

const FollowUpList = ({ items }) =>
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
  
    {items.length === 0 ?
  <p style={{ margin: 0, color: "var(--info)" }}>No follow-ups recorded.</p> :

  items.map((entry) =>
  <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", color: "var(--info-dark)" }}>
          <div>
            <strong style={{ color: "var(--primary-selected)" }}>{entry.job?.job_number || "Job"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{entry.status}</p>
          </div>
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>{entry.job?.vehicle_reg || "Vehicle"}</span>
        </div>
  )
  }
  </div>;


const defaultData = {
  counts: { jobsCompleted: 0, vhcsCompleted: 0, pendingParts: 0, pendingVhc: 0 },
  followUps: [],
  progress: { completed: 0, scheduled: 1 },
  trend: { jobsCompletedLast7: [] }
};

export default function AfterSalesDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = ALLOWED_ROLES.some((role) => userRoles.includes(role));
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hasAccess) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAfterSalesDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load after sales dashboard", fetchError);
        setError(fetchError.message || "Unable to load after sales data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasAccess]);

  if (!hasAccess) {
    return <AfterSalesDashboardUi view="section1" />;






  }

  return <AfterSalesDashboardUi view="section2" data={data} error={error} FollowUpList={FollowUpList} loading={loading} MetricCard={MetricCard} ProgressBar={ProgressBar} Section={Section} TrendBlock={TrendBlock} />;

























































}
