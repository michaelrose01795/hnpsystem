"use client";

import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { getServiceDashboardData } from "@/lib/database/dashboard/service";

const MetricCard = ({ label, value, helper }) => (
  <div
    style={{
      border: "1px solid #ffe0e0",
      borderRadius: "16px",
      padding: "18px",
      background: "#fff",
      minWidth: 160,
      boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "#a00000" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.8rem", fontWeight: 600 }}>{value}</p>
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
      boxShadow: "0 16px 30px rgba(0,0,0,0.05)",
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

const PieChart = ({ breakdown }) => {
  const total = breakdown.waiting + breakdown.loan + breakdown.collection || 1;
  const segments = [
    { label: "Waiting", value: breakdown.waiting, color: "#f97316" },
    { label: "Loan car", value: breakdown.loan, color: "#2563eb" },
    { label: "Collection", value: breakdown.collection, color: "#0ea5e9" },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {segments.map((segment) => (
        <div key={segment.label} style={{ minWidth: 140 }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>{segment.label}</p>
          <div
            style={{
              height: 12,
              width: "100%",
              background: "#f5f5f5",
              borderRadius: 6,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round((segment.value / total) * 100)}%`,
                height: "100%",
                background: segment.color,
              }}
            />
          </div>
          <strong style={{ color: "#a00000" }}>{segment.value}</strong>
        </div>
      ))}
    </div>
  );
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
        border: "1px solid #efe5e5",
        borderRadius: "12px",
        background: "#fff",
      }}
    >
      {(data || []).map((point) => (
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: 35, fontSize: "0.85rem", color: "#6b7280" }}>{point.label}</span>
          <div style={{ flex: 1, height: 8, background: "#f5f5f5", borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.round((point.count / max) * 100)}%`,
                height: "100%",
                background: "#22c55e",
                borderRadius: 4,
              }}
            />
          </div>
          <strong style={{ color: "#a00000" }}>{point.count}</strong>
        </div>
      ))}
    </div>
  );
};

const ProgressBar = ({ completed, target }) => {
  const percentage = Math.min(100, Math.round((completed / target) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#6b7280" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "#f5f5f5", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "#ea580c",
            borderRadius: 5,
          }}
        />
      </div>
    </div>
  );
};

const QueueItem = ({ job }) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      border: "1px solid #ffe0e0",
      borderRadius: "12px",
      padding: "12px 14px",
      background: "#fff",
    }}
  >
    <div>
      <strong style={{ color: "#a00000" }}>{job.job_number || "—"}</strong>
      <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.85rem" }}>
        {job.vehicle_reg || "Plate missing"}
      </p>
    </div>
    <span style={{ fontSize: "0.85rem", color: "#374151" }}>{job.status || "Status unknown"}</span>
  </div>
);

const defaultData = {
  appointmentsToday: 0,
  appointmentTrends: [],
  customerStatuses: [],
  waitingBreakdown: { waiting: 0, loan: 0, collection: 0 },
  upcomingJobs: [],
  awaitingVhc: [],
  vhcSeverityTrend: [],
  progress: { completed: 0, scheduled: 1 },
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

  return (
    <Layout>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <header
          style={{
            background: "#fff5f5",
            borderRadius: "18px",
            padding: "24px",
            border: "1px solid #ffd6d6",
            boxShadow: "0 16px 30px rgba(0,0,0,0.08)",
          }}
        >
          <p style={{ margin: 0, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a00000" }}>
            Service dashboard
          </p>
          <h1 style={{ margin: "6px 0 0", color: "#a00000" }}>Advisor cockpit</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
            Appointment throughput, customer status, and VHC approvals all in one pane.
          </p>
        </header>

        <Section title="Appointments today">
          {loading ? (
            <p style={{ color: "#6b7280" }}>Counting today&apos;s arrivals…</p>
          ) : error ? (
            <p style={{ color: "#ff4040" }}>{error}</p>
          ) : (
            <MetricCard
              label="Appointments today"
              value={data.appointmentsToday}
              helper="Scheduled between 00:00 and midnight"
            />
          )}
        </Section>

        <Section title="Progress" subtitle="Jobs completed vs checked in">
          <ProgressBar completed={data.progress.completed} target={data.progress.scheduled} />
        </Section>

        <Section title="Waiting mix" subtitle="Loan, waiting, and collection split">
          <PieChart breakdown={data.waitingBreakdown} />
        </Section>

        <Section title="Appointment trends" subtitle="Last 7 days">
          <TrendBlock data={data.appointmentTrends} />
        </Section>

        <Section title="Upcoming jobs">
          {data.upcomingJobs.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No upcoming jobs right now.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.upcomingJobs.map((job) => (
                <QueueItem key={job.id} job={job} />
              ))}
            </div>
          )}
        </Section>

        <Section title="VHC severity" subtitle="Weekly breakdown">
          {data.vhcSeverityTrend.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No VHC data for the week yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {data.vhcSeverityTrend.map((point) => {
                const total = point.red + point.amber + point.green || 1;
                return (
                  <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: 35, fontSize: "0.85rem", color: "#6b7280" }}>{point.label}</span>
                    <div style={{ flex: 1, height: 8, background: "#f5f5f5", borderRadius: 4 }}>
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((point.red / total) * 100)}%`,
                            background: "#dc2626",
                          }}
                        />
                        <div
                          style={{
                            width: `${Math.round((point.amber / total) * 100)}%`,
                            background: "#f59e0b",
                          }}
                        />
                        <div
                          style={{
                            width: `${Math.round((point.green / total) * 100)}%`,
                            background: "#16a34a",
                          }}
                        />
                      </div>
                    </div>
                    <strong style={{ color: "#a00000", fontSize: "0.85rem" }}>{total}</strong>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="VHCs awaiting approval">
          {data.awaitingVhc.length === 0 ? (
            <p style={{ margin: 0, color: "#6b7280" }}>No pending VHC approvals.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.awaitingVhc.map((job) => (
                <QueueItem key={job.id} job={job} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </Layout>
  );
}
