// file location: src/pages/dashboard/accounts/index.js

"use client";

import React, { useEffect, useState } from "react";
import { getAccountsDashboardData } from "@/lib/database/dashboard/accounts";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import AccountsDashboardUi from "@/components/page-ui/dashboard/accounts/dashboard-accounts-ui"; // Extracted presentation layer.
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


const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
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
              background: "var(--accent-purple)",
              borderRadius: 4
            }} />
          
          </div>
          <strong style={{ color: "var(--primary-selected)" }}>{point.count}</strong>
        </div>
      )}
    </div>);

};

const JobList = ({ jobs }) =>
<div
  style={{
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "12px",
    background: "var(--surface)"
  }}>
  
    {jobs.length === 0 ?
  <p style={{ margin: 0, color: "var(--info)" }}>No outstanding jobs right now.</p> :

  jobs.map((job) =>
  <div
    key={job.id}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "var(--info-dark)"
    }}>
    
          <div>
            <strong style={{ color: "var(--primary-selected)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>Vehicle {job.vehicle_reg || "TBC"}</p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{job.status}</span>
        </div>
  )
  }
  </div>;


const defaultData = {
  invoicesRaised: 0,
  invoicesPaid: 0,
  outstandingJobs: [],
  trends: []
};

export default function AccountsDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getAccountsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load accounts dashboard", fetchError);
        setError(fetchError.message || "Unable to load financial metrics");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return <AccountsDashboardUi view="section1" data={data} error={error} JobList={JobList} loading={loading} MetricCard={MetricCard} Section={Section} TrendBlock={TrendBlock} />;



















































}
