// file location: src/pages/hr/index.js
import React, { useMemo } from "react";
import Link from "next/link";
import Layout from "../../components/Layout";
import { useHrMockData } from "../../hooks/useHrData";
import { MetricCard, SectionCard, StatusTag } from "../../components/HR/MetricCard";

// TODO: Replace useHrMockData with real HR dashboard aggregation from the database.

export default function HrDashboard() {
  const { data, isLoading, error } = useHrMockData();

  const {
    hrDashboardMetrics = [],
    upcomingAbsences = [],
    activeWarnings = [],
    departmentPerformance = [],
    trainingRenewals = [],
  } = data || {};

  const formattedMetrics = useMemo(() => {
    return hrDashboardMetrics.map((metric) => {
      if (metric.id === "totalEmployees") {
        return {
          icon: metric.icon,
          label: metric.label,
          primary: `${metric.active + metric.inactive}`,
          secondary: `${metric.active} active / ${metric.inactive} inactive`,
          trend: null,
        };
      }

      return {
        icon: metric.icon,
        label: metric.label,
        primary: metric.value,
        secondary: null,
        trend: metric.trend,
      };
    });
  }, [hrDashboardMetrics]);

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          padding: "8px 8px 32px",
        }}
      >
        {isLoading && (
          <SectionCard title="Loading dashboard…" subtitle="Fetching HR overview data.">
            <span style={{ color: "#6B7280" }}>
              Please wait while we pull the latest HR metrics from the placeholder service.
            </span>
          </SectionCard>
        )}

        {error && (
          <SectionCard title="Failed to load HR data" subtitle="Mock API returned an error.">
            <span style={{ color: "#B91C1C" }}>{error.message}</span>
          </SectionCard>
        )}

        {!isLoading && !error && (
          <>
            <section
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}
            >
              {formattedMetrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} accentColor="#0EA5E9" />
              ))}
            </section>

            <section style={{ display: "grid", gap: "18px", gridTemplateColumns: "2fr 1.2fr" }}>
              <SectionCard
                title="Department Performance Snapshot"
                subtitle="Productivity, quality, and teamwork scoring (rolling 30 days)"
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ padding: "12px 0" }}>Department</th>
                      <th>Productivity</th>
                      <th>Quality</th>
                      <th>Teamwork</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departmentPerformance.map((dept) => (
                      <tr key={dept.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "14px 0", fontWeight: 600 }}>{dept.department}</td>
                        <td>{dept.productivity}%</td>
                        <td>{dept.quality}%</td>
                        <td>{dept.teamwork}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard
                title="Training Renewals"
                subtitle="Upcoming expiries across mandatory certifications"
                action={
                  <Link href="/hr/training" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0EA5E9" }}>
                    View all
                  </Link>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {trainingRenewals.map((renewal) => {
                    const tone =
                      renewal.status === "Overdue"
                        ? "danger"
                        : renewal.status === "Due Soon"
                        ? "warning"
                        : "default";

                    return (
                      <div
                        key={renewal.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingBottom: "12px",
                          borderBottom: "1px solid #F3F4F6",
                          gap: "12px",
                        }}
                      >
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontWeight: 600, color: "#111827" }}>{renewal.course}</span>
                          <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>{renewal.employee}</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                          <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                            Due {new Date(renewal.dueDate).toLocaleDateString()}
                          </span>
                          <StatusTag label={renewal.status} tone={tone} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            </section>

            <section style={{ display: "grid", gap: "18px", gridTemplateColumns: "1.4fr 1fr" }}>
              <SectionCard
                title="Upcoming Holidays & Absences"
                subtitle="Next 14 days across the business"
                action={
                  <Link href="/hr/leave" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0EA5E9" }}>
                    Manage leave
                  </Link>
                }
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#6B7280", fontSize: "0.8rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Employee</th>
                      <th>Department</th>
                      <th>Type</th>
                      <th>Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingAbsences.map((absence) => (
                      <tr key={absence.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                        <td style={{ padding: "12px 0", fontWeight: 600 }}>{absence.employee}</td>
                        <td>{absence.department}</td>
                        <td>{absence.type}</td>
                        <td>
                          {new Date(absence.startDate).toLocaleDateString()} -{" "}
                          {new Date(absence.endDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>

              <SectionCard
                title="Active Warnings"
                subtitle="Summary of open disciplinary notices"
                action={
                  <Link href="/hr/disciplinary" style={{ fontSize: "0.8rem", fontWeight: 600, color: "#0EA5E9" }}>
                    Review log
                  </Link>
                }
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {activeWarnings.map((warning) => (
                    <div
                      key={warning.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        paddingBottom: "12px",
                        borderBottom: "1px solid #F3F4F6",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 600, color: "#111827" }}>{warning.employee}</span>
                        <StatusTag
                          label={warning.level}
                          tone={warning.level.includes("Final") ? "danger" : "warning"}
                        />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>{warning.department}</span>
                      <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
                        Issued {new Date(warning.issuedOn).toLocaleDateString()}
                      </span>
                      <span style={{ fontSize: "0.85rem", color: "#374151" }}>{warning.notes}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
