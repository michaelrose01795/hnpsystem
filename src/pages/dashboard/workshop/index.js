"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      background: "#fff",
      borderRadius: "16px",
      padding: "16px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 10px 24px rgba(0,0,0,0.04)",
      minWidth: 160,
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#6b7280" }}>{helper}</p>}
  </div>
);

const Section = ({ title, subtitle, children }) => (
  <section
    style={{
      background: "#fff",
      borderRadius: "18px",
      padding: "24px",
      border: "1px solid #ffe0e0",
      boxShadow: "0 16px 30px rgba(209,0,0,0.08)",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#a00000" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "#6b7280" }}>{subtitle}</p>}
    </div>
    {children}
  </section>
);

const TrendBlock = ({ title, data }) => {
  const maxValue = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <div
      style={{
        border: "1px solid #efe5e5",
        borderRadius: "12px",
        padding: "16px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <p style={{ margin: 0, textTransform: "uppercase", color: "#a00000", fontSize: "0.75rem" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {(data || []).map((point) => (
          <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 35, fontSize: "0.8rem", color: "#6b7280" }}>{point.label}</span>
            <div
              style={{
                flex: 1,
                height: 8,
                background: "#f5f5f5",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.round((point.count / maxValue) * 100)}%`,
                  background: "#f97316",
                }}
              />
            </div>
            <strong style={{ width: 30, fontSize: "0.85rem", color: "#a00000" }}>{point.count}</strong>
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
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#6b7280" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "#f5f5f5", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "#0ea5e9",
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
      background: "#fff",
      borderRadius: "12px",
      border: "1px solid #ffe0e0",
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    <p style={{ margin: 0, fontWeight: 600, color: "#a00000" }}>
      {title} <span style={{ fontSize: "0.85rem", fontWeight: 400, color: "#6b7280" }}>{titleSuffix}</span>
    </p>
    {(items || []).length === 0 ? (
      <p style={{ margin: 0, color: "#6b7280" }}>No updates yet.</p>
    ) : (
      items.map((item) => (
        <div key={item.id || item.job_id} style={{ fontSize: "0.85rem", color: "#374151" }}>
          <strong style={{ color: "#a00000" }}>{item.job?.job_number || item.job_number || "Job"}</strong> – {item.to_status || item.status}
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
            background: "linear-gradient(120deg, #ffeaea, #fff5f5)",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 18px 35px rgba(209,0,0,0.1)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Workshop workspace · {todayLabel}
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>
            {user?.username ? `Hi ${user.username}, workshop view` : "Workshop workspace"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Live view of technician assignments, queue, and VHC throughput.
          </p>
        </header>

        <Section title="Daily checkpoints">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Loading today&apos;s metrics…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
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
            <p style={{ color: "#6b7280" }}>Loading queue…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dashboardData.queue.length === 0 ? (
                <p style={{ margin: 0, color: "#6b7280" }}>No outstanding jobs in the queue.</p>
              ) : (
                dashboardData.queue.map((job) => (
                  <div
                    key={job.job_number}
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: "#fef6f6",
                      border: "1px solid #ffe0e0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#a00000" }}>
                        {job.job_number || "—"} · {job.vehicle_reg || "TBC"}
                      </strong>
                      <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>{job.status || "Status unknown"}</div>
                    </div>
                    <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
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
            <p style={{ color: "#6b7280" }}>Loading VHC backlog…</p>
          ) : dashboardData.outstandingVhc.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No VHCs awaiting completion.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dashboardData.outstandingVhc.map((job) => (
                <div
                  key={job.job_number}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    background: "#fff",
                    borderRadius: "10px",
                    border: "1px solid #ffe0e0",
                    padding: "12px 14px",
                  }}
                >
                  <div>
                    <strong>{job.job_number || "—"}</strong>
                    <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
                      {job.vehicle_reg || "Registration missing"}
                    </p>
                  </div>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
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
