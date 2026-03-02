"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      background: "var(--surface)",
      borderRadius: "16px",
      padding: "16px",
      border: "1px solid var(--surface-light)",
      boxShadow: "none",
      minWidth: "140px",
      flex: "1 1 140px",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-dark)" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>
);

const Section = ({ title, subtitle, children, style }) => (
  <section
    style={{
      background: "var(--surface)",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid var(--surface-light)",
      boxShadow: "none",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      ...style,
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const TrendBlock = ({ title, data }) => {
  const maxValue = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <div
      style={{
        border: "1px solid var(--danger-surface)",
        borderRadius: "12px",
        padding: "16px",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1,
      }}
    >
      <p style={{ margin: 0, textTransform: "uppercase", color: "var(--primary-dark)", fontSize: "0.75rem" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {(data || []).map((point) => (
          <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 35, fontSize: "0.8rem", color: "var(--info)" }}>{point.label}</span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: "var(--surface)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((point.count / maxValue) * 100)}%`,
                  background: "var(--danger)",
                }}
              />
            </div>
            <strong style={{ width: 30, fontSize: "0.85rem", color: "var(--primary-dark)" }}>{point.count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProgressBar = ({ completed, target }) => {
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.round((completed / safeTarget) * 100));
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

const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "-");

const defaultData = {
  dailySummary: { inProgress: 0, checkedInToday: 0, completedToday: 0 },
  technicianAvailability: { totalTechnicians: 0, onJobs: 0, available: 0 },
  progress: { completed: 0, scheduled: 1 },
  queue: [],
  outstandingVhc: [],
  trends: { checkInsLast7: [] },
};

const twoColSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch",
};

const listViewportStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxHeight: "276px",
  overflowY: "auto",
  paddingRight: "2px",
};

export default function WorkshopDashboard() {
  const [dashboardData, setDashboardData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getWorkshopDashboardData();
        setDashboardData(data);
      } catch (fetchError) {
        console.error("Failed to load workshop dashboard", fetchError);
        setError(fetchError.message || "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const availableTechnicians = useMemo(
    () => dashboardData.technicianAvailability.available,
    [dashboardData]
  );

  return (
    <Layout>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <Section title="Daily checkpoints">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading today's metrics...</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              <MetricCard
                label="Jobs in progress"
                value={dashboardData.dailySummary.inProgress}
                helper="Vehicles currently on the bay"
              />
              <MetricCard
                label="Checked in today"
                value={dashboardData.dailySummary.checkedInToday}
                helper="Arrivals since midnight"
              />
              <MetricCard label="Jobs completed" value={dashboardData.dailySummary.completedToday} helper="Finished today" />
              <MetricCard
                label="Technician availability"
                value={`${availableTechnicians} / ${dashboardData.technicianAvailability.totalTechnicians}`}
                helper={`${dashboardData.technicianAvailability.onJobs} techs on jobs`}
              />
            </div>
          )}
        </Section>

        <div style={twoColSplitStyle}>
          <Section title="Progress" subtitle="Completed vs scheduled" style={{ height: "100%", minHeight: "250px" }}>
            <ProgressBar
              completed={dashboardData.progress.completed}
              target={dashboardData.progress.scheduled}
            />
          </Section>

          <Section title="Check-in trends" subtitle="Last 7 days" style={{ height: "100%", minHeight: "250px" }}>
            <TrendBlock title="Daily check-ins" data={dashboardData.trends.checkInsLast7} />
          </Section>
        </div>

        <div style={twoColSplitStyle}>
          <Section title="Next jobs queue" style={{ height: "100%", minHeight: "360px" }}>
            {loading ? (
              <p style={{ color: "var(--info)" }}>Loading queue...</p>
            ) : (
              <div style={listViewportStyle}>
                {dashboardData.queue.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--info)" }}>No outstanding jobs in the queue.</p>
                ) : (
                  dashboardData.queue.map((job) => (
                    <div
                      key={job.job_number}
                      style={{
                        padding: "12px",
                        borderRadius: "10px",
                        background: "var(--danger-surface)",
                        border: "1px solid var(--surface-light)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        minHeight: "84px",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--primary-dark)", fontSize: "0.95rem" }}>
                          {job.job_number || "-"} - {job.vehicle_reg || "TBC"}
                        </strong>
                        <div style={{ fontSize: "0.85rem", color: "var(--info)", marginTop: "4px" }}>
                          {job.status || "Status unknown"}
                        </div>
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                        Checked in {formatTime(job.checked_in_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </Section>

          <Section title="Outstanding VHCs" subtitle="Jobs requiring follow-up" style={{ height: "100%", minHeight: "360px" }}>
            {loading ? (
              <p style={{ color: "var(--info)" }}>Loading VHC backlog...</p>
            ) : dashboardData.outstandingVhc.length === 0 ? (
              <p style={{ margin: 0, color: "var(--info)" }}>No VHCs awaiting completion.</p>
            ) : (
              <div style={listViewportStyle}>
                {dashboardData.outstandingVhc.map((job) => (
                  <div
                    key={job.job_number}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      background: "var(--surface)",
                      borderRadius: "10px",
                      border: "1px solid var(--surface-light)",
                      padding: "12px",
                      minHeight: "84px",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.95rem" }}>{job.job_number || "-"}</strong>
                      <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
                        {job.vehicle_reg || "Registration missing"}
                      </p>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                      Checked in {formatTime(job.checked_in_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </Layout>
  );
}
