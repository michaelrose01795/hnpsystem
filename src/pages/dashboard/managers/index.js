// file location: src/pages/dashboard/managers/index.js

"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getManagersDashboardData } from "@/lib/database/dashboard/managers";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import ManagersDashboardUi from "@/components/page-ui/dashboard/managers/dashboard-managers-ui"; // Extracted presentation layer.
const MANAGER_ROLES = [
"service manager",
"workshop manager",
"parts manager",
"admin manager",
"accounts manager",
"general manager",
"owner"];


const MetricCard = ({ label, value, helper, style }) =>
<div
  className="app-section-card"
  style={{
    minWidth: 180,
    ...style
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
            background: "var(--danger)",
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

const EscalationList = ({ items }) =>
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
  <p style={{ margin: 0, color: "var(--info)" }}>No escalations.</p> :

  items.map((notice) =>
  <div key={notice.notification_id} style={{ color: "var(--info-dark)" }}>
          <p style={{ margin: 0 }}>{notice.message}</p>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--info)" }}>
            For {notice.target_role || "everyone"}
          </p>
        </div>
  )
  }
  </div>;


const defaultData = {
  counts: { jobsCompleted: 0, vhcsCompleted: 0, pendingParts: 0, pendingVhc: 0 },
  escalations: [],
  progress: { completed: 0, scheduled: 1 },
  trend: { jobsCompletedLast7: [] }
};

export default function ManagersDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = MANAGER_ROLES.some((role) => userRoles.includes(role));
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!hasAccess) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getManagersDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load managers dashboard", fetchError);
        setError(fetchError.message || "Unable to load manager data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasAccess]);

  if (!hasAccess) {
    return <ManagersDashboardUi view="section1" />;






  }

  return <ManagersDashboardUi view="section2" data={data} error={error} EscalationList={EscalationList} loading={loading} MetricCard={MetricCard} ProgressBar={ProgressBar} Section={Section} TrendBlock={TrendBlock} />;



















































}
