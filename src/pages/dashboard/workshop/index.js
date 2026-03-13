"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ContentWidth, PageShell, SectionShell, StatCard } from "@/components/ui";

const MetricCard = ({ sectionKey, parentKey, label, value, helper }) => (
  <StatCard
    sectionKey={sectionKey}
    parentKey={parentKey}
    className="app-section-card"
    style={{
      minWidth: "140px",
      flex: "1 1 140px",
      background: "var(--surface)",
      border: "1px solid var(--border)",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-dark)" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </StatCard>
);

const Section = ({ sectionKey, parentKey, title, subtitle, children, style }) => (
  <SectionShell
    sectionKey={sectionKey}
    parentKey={parentKey}
    className="app-section-card"
    style={{
      gap: "12px",
      background: "rgba(var(--primary-rgb), 0.10)",
      border: "1px solid rgba(var(--primary-rgb), 0.18)",
      ...style,
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-dark)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </SectionShell>
);

const TrendBlock = ({ sectionKey, parentKey, title, data }) => {
  const maxValue = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={{
        border: "1px solid rgba(var(--primary-rgb), 0.18)",
        borderRadius: "var(--radius-sm)",
        padding: "16px",
        background: "rgba(var(--primary-rgb), 0.14)",
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
    </DevLayoutSection>
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
      <div style={{ width: "100%", height: 10, background: "rgba(var(--primary-rgb), 0.14)", borderRadius: 5 }}>
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
      <PageShell sectionKey="workshop-dashboard-shell">
        <ContentWidth sectionKey="workshop-dashboard-content" parentKey="workshop-dashboard-shell" widthMode="content">
        <Section sectionKey="workshop-dashboard-daily-checkpoints" parentKey="workshop-dashboard-content" title="Daily checkpoints">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading today's metrics...</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <DevLayoutSection
              sectionKey="workshop-dashboard-checkpoints-grid"
              parentKey="workshop-dashboard-daily-checkpoints"
              sectionType="grid-card"
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}
            >
              <MetricCard
                sectionKey="workshop-dashboard-metric-in-progress"
                parentKey="workshop-dashboard-checkpoints-grid"
                label="Jobs in progress"
                value={dashboardData.dailySummary.inProgress}
                helper="Vehicles currently on the bay"
              />
              <MetricCard
                sectionKey="workshop-dashboard-metric-checkedin"
                parentKey="workshop-dashboard-checkpoints-grid"
                label="Checked in today"
                value={dashboardData.dailySummary.checkedInToday}
                helper="Arrivals since midnight"
              />
              <MetricCard
                sectionKey="workshop-dashboard-metric-completed"
                parentKey="workshop-dashboard-checkpoints-grid"
                label="Jobs completed"
                value={dashboardData.dailySummary.completedToday}
                helper="Finished today"
              />
              <MetricCard
                sectionKey="workshop-dashboard-metric-availability"
                parentKey="workshop-dashboard-checkpoints-grid"
                label="Technician availability"
                value={`${availableTechnicians} / ${dashboardData.technicianAvailability.totalTechnicians}`}
                helper={`${dashboardData.technicianAvailability.onJobs} techs on jobs`}
              />
            </DevLayoutSection>
          )}
        </Section>

        <DevLayoutSection
          sectionKey="workshop-dashboard-analytics-row"
          parentKey="workshop-dashboard-content"
          sectionType="section-shell"
          shell
          style={twoColSplitStyle}
        >
          <Section
            sectionKey="workshop-dashboard-progress"
            parentKey="workshop-dashboard-analytics-row"
            title="Progress"
            subtitle="Completed vs scheduled"
            style={{ height: "100%", minHeight: "250px" }}
          >
            <ProgressBar
              completed={dashboardData.progress.completed}
              target={dashboardData.progress.scheduled}
            />
          </Section>

          <Section
            sectionKey="workshop-dashboard-checkin-trends"
            parentKey="workshop-dashboard-analytics-row"
            title="Check-in trends"
            subtitle="Last 7 days"
            style={{ height: "100%", minHeight: "250px" }}
          >
            <TrendBlock
              sectionKey="workshop-dashboard-checkin-trends-chart"
              parentKey="workshop-dashboard-checkin-trends"
              title="Daily check-ins"
              data={dashboardData.trends.checkInsLast7}
            />
          </Section>
        </DevLayoutSection>

        <DevLayoutSection
          sectionKey="workshop-dashboard-worklist-row"
          parentKey="workshop-dashboard-content"
          sectionType="section-shell"
          shell
          style={twoColSplitStyle}
        >
          <Section sectionKey="workshop-dashboard-next-jobs-queue" parentKey="workshop-dashboard-worklist-row" title="Next jobs queue" style={{ height: "100%", minHeight: "360px" }}>
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
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
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

          <Section
            sectionKey="workshop-dashboard-outstanding-vhc"
            parentKey="workshop-dashboard-worklist-row"
            title="Outstanding VHCs"
            style={{ height: "100%", minHeight: "360px" }}
          >
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
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
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
        </DevLayoutSection>
        </ContentWidth>
      </PageShell>
    </Layout>
  );
}
