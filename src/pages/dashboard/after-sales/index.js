"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getAfterSalesDashboardData } from "@/lib/database/dashboard/after-sales";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions

const ALLOWED_ROLES = ["after sales manager", "after sales director", "aftersales manager"];

const MetricCard = ({ label, value, helper }) => (
  <div
    className="app-section-card"
    style={{
      minWidth: 180,
    }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>
);

const ProgressBar = ({ completed, target }) => {
  const percentage = Math.min(100, Math.round((completed / target) * 100));
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
            borderRadius: 5,
          }}
        />
      </div>
    </div>
  );
};

const TrendBlock = ({ data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "var(--info)" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.round((point.count / max) * 100)}%`,
                height: "100%",
                background: "var(--info)",
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ color: "var(--primary-dark)" }}>{point.count}</strong>
        </div>
      ))}
    </div>
  );
};

const FollowUpList = ({ items }) => (
  <div
    style={{
      border: "none",
      borderRadius: "var(--radius-sm)",
      padding: "12px",
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    {items.length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No follow-ups recorded.</p>
    ) : (
      items.map((entry) => (
        <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", color: "var(--info-dark)" }}>
          <div>
            <strong style={{ color: "var(--primary-dark)" }}>{entry.job?.job_number || "Job"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{entry.status}</p>
          </div>
          <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>{entry.job?.vehicle_reg || "Vehicle"}</span>
        </div>
      ))
    )}
  </div>
);

const defaultData = {
  counts: { jobsCompleted: 0, vhcsCompleted: 0, pendingParts: 0, pendingVhc: 0 },
  followUps: [],
  progress: { completed: 0, scheduled: 1 },
  trend: { jobsCompletedLast7: [] },
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
    return (
      <>
        <div style={{ padding: "48px", textAlign: "center", color: "var(--primary-dark)" }}>
          You do not have access to the after sales dashboard.
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <header
          className="app-section-card"
          style={{
            background: "var(--surface-light)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            After sales performance
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>Combined workshop + VHC view</h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Keep the customer journey humming — jobs, VHCs, and approvals in one pane.
          </p>
        </header>

        <Section title="Combined performance">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Gathering completion statistics…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
              <MetricCard label="Jobs completed" value={data.counts.jobsCompleted} helper="This week" />
              <MetricCard label="VHCs completed" value={data.counts.vhcsCompleted} helper="This week" />
            </div>
          )}
        </Section>

        <Section title="Follow-up calls needed" subtitle="Statuses containing follow or call">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading follow-ups…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <FollowUpList items={data.followUps} />
          )}
        </Section>

        <Section title="Approvals needed">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <MetricCard label="Parts approvals" value={data.counts.pendingParts} helper="Pending requests" />
            <MetricCard label="VHC sign-off" value={data.counts.pendingVhc} helper="Awaiting auth" />
          </div>
        </Section>

        <Section title="Completion trend" subtitle="Jobs completed last 7 days">
          <TrendBlock data={data.trend.jobsCompletedLast7} />
        </Section>

        <Section title="Progress" subtitle="Jobs completed vs started">
          <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
        </Section>
      </div>
    </>
  );
}
