// file location: src/pages/dashboard/accounts/index.js

"use client";

import React, { useEffect, useState } from "react";
import { getAccountsDashboardData } from "@/lib/database/dashboard/accounts";
import { LayerSurface } from "@/components/ui"; // canonical surface layer primitive (nested inside dashboard theme sections)
import AccountsDashboardUi from "@/components/page-ui/dashboard/accounts/dashboard-accounts-ui"; // Extracted presentation layer.

// MetricCard — single stat tile. Lives inside a dashboard LayerTheme section,
// so per the strict alternation rule it renders as a LayerSurface.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 180 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-2)" }}>{helper}</p>}
  </LayerSurface>
);

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
      {(data || []).map((point) =>
      <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--text-2)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
            style={{
              width: `${Math.round(point.count / max * 100)}%`,
              height: "100%",
              background: "var(--accent-purple)",
              borderRadius: 4
            }} />

          </div>
          <strong style={{ color: "var(--text-accent)" }}>{point.count}</strong>
        </div>
      )}
    </LayerSurface>);

};

// JobList — list block inside a dashboard LayerTheme section, so it renders as LayerSurface.
const JobList = ({ jobs }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {jobs.length === 0 ?
      <p style={{ margin: 0, color: "var(--text-2)" }}>No outstanding jobs right now.</p> :
      jobs.map((job) =>
        <div
          key={job.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "var(--text-1)"
          }}>
          <div>
            <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "—"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-2)" }}>Vehicle {job.vehicle_reg || "TBC"}</p>
          </div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>{job.status}</span>
        </div>
      )
    }
  </LayerSurface>
);


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

  return <AccountsDashboardUi view="section1" data={data} error={error} JobList={JobList} loading={loading} MetricCard={MetricCard} TrendBlock={TrendBlock} />;
}
