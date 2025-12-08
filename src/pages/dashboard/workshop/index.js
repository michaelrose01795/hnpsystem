"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      background: "var(--surface)",
      borderRadius: "16px",
      padding: "16px",
      border: "1px solid var(--surface-light)",
      boxShadow: "none",
      minWidth: 160,
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-dark)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </div>
);

const Section = ({ title, subtitle, children }) => (
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

const StatusList = ({ title, titleSuffix, items }) => (
  <div
    style={{
      background: "var(--surface)",
      borderRadius: "12px",
      border: "1px solid var(--surface-light)",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    <p style={{ margin: 0, fontWeight: 600, color: "var(--primary-dark)" }}>
      {title} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "var(--info)" }}>{titleSuffix}</span>
    </p>
    {(items || []).length === 0 ? (
      <p style={{ margin: 0, color: "var(--info)" }}>No updates yet.</p>
    ) : (
      items.map((item) => (
        <div key={item.id || item.job_id} style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>
          <strong style={{ color: "var(--primary-dark)" }}>{item.job?.job_number || item.job_number || "Job"}</strong> – {item.to_status || item.status}
        </div>
      ))
    )}
  </div>
);

const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "—");

const defaultData = {
  dailySummary: { inProgress: 0, checkedInToday: 0, completedToday: 0 },
  technicianAvailability: { totalTechnicians: 0, onJobs: 0, available: 0 },
  progress: { completed: 0, scheduled: 1 },
  queue: [],
  outstandingVhc: [],
  trends: { checkInsLast7: [] },
  latestStatusUpdates: [],
};

export default function WorkshopDashboard() {
  const todayLabel = dayjs().format("dddd D MMMM");
  const { user } = useUser();
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
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "var(--surface-light)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid var(--surface-light)",
            boxShadow: "none",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--primary-dark)" }}>
            Workshop workspace · {todayLabel}
          </p>
          <h1 style={{ margin: "6px 0 0", color: "var(--primary-dark)" }}>
            {user?.username ? `Hi ${user.username}, workshop view` : "Workshop workspace"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "var(--info)" }}>
            Live view of technician assignments, queue, and VHC throughput.
          </p>
        </header>

        <Section title="Daily checkpoints">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading today&apos;s metrics…</p>
          ) : error ? (
            <p style={{ color: "var(--primary)" }}>{error}</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
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

        <Section title="Progress" subtitle="Completed vs scheduled">
          <ProgressBar
            completed={dashboardData.progress.completed}
            target={dashboardData.progress.scheduled}
          />
        </Section>

        <Section title="Check-in trends" subtitle="Last 7 days">
          <TrendBlock title="Daily check-ins" data={dashboardData.trends.checkInsLast7} />
        </Section>

        <Section title="Next jobs queue">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading queue…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dashboardData.queue.length === 0 ? (
                <p style={{ margin: 0, color: "var(--info)" }}>No outstanding jobs in the queue.</p>
              ) : (
                dashboardData.queue.map((job) => (
                  <div
                    key={job.job_number}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: "var(--danger-surface)",
                      border: "1px solid var(--surface-light)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "var(--primary-dark)" }}>
                        {job.job_number || "—"} · {job.vehicle_reg || "TBC"}
                      </strong>
                      <div style={{ fontSize: "0.85rem", color: "var(--info)" }}>{job.status || "Status unknown"}</div>
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>
                      Checked in {formatTime(job.checked_in_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </Section>

        <Section title="Outstanding VHCs" subtitle="Jobs requiring follow-up">
          {loading ? (
            <p style={{ color: "var(--info)" }}>Loading VHC backlog…</p>
          ) : dashboardData.outstandingVhc.length === 0 ? (
            <p style={{ margin: 0, color: "var(--info)" }}>No VHCs awaiting completion.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dashboardData.outstandingVhc.map((job) => (
                <div
                  key={job.job_number}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "var(--surface)",
                    borderRadius: "10px",
                    border: "1px solid var(--surface-light)",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <strong>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "var(--info)", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Registration missing"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "var(--info)" }}>
                    Checked in {formatTime(job.checked_in_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <StatusList
          title="Status updates"
          titleSuffix="Latest changes"
          items={dashboardData.latestStatusUpdates}
        />
      </div>
    </Layout>
  );
}
