// ✅ HR Dashboard Tab Component
// file location: src/components/HR/tabs/HRDashboardTab.js
// Shows HR overview metrics, upcoming absences, training renewals, and active warnings

import React, { useMemo } from "react";
import { useHrDashboardData } from "@/hooks/useHrData";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { MetricCard, StatusTag } from "@/components/HR/MetricCard"; // metric display and status badge components
import HrTabLoadingSkeleton from "@/components/HR/HrTabLoadingSkeleton";
import LayerSurface from "@/components/ui/LayerSurface";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

const slug = (label) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function HRDashboardTab() {
  const { data, isLoading, error } = useHrDashboardData();

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

  if (isLoading) {
    return <HrTabLoadingSkeleton variant="dashboard" />;
  }

  if (error) {
    return (
      <SectionCard title="Failed to load HR data" subtitle="An error occurred.">
        <span style={{ color: "var(--danger)" }}>{error.message}</span>
      </SectionCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Metrics Overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
        {formattedMetrics.map((metric) => (
          <MetricCard
            key={metric.label}
            {...metric}
            accentColor="var(--info)"
            sectionKey={`hr-manager-dashboard-metric-${slug(metric.label)}`}
            parentKey="hr-manager-tab-dashboard"
          />
        ))}
      </div>

      {/* Department Performance & Training */}
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "2fr 1.2fr" }}>
        <SectionCard
          sectionKey="hr-manager-auto-content-card-1"
          parentKey="hr-manager-tab-dashboard"
          sectionType="content-card"
          backgroundToken="surface"
          title="Department Performance Snapshot"
          subtitle="Productivity, quality, and teamwork scoring (rolling 30 days)"
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ padding: "12px 0" }}>Department</th>
                <th>Productivity</th>
                <th>Quality</th>
                <th>Teamwork</th>
              </tr>
            </thead>
            <tbody>
              {departmentPerformance.map((dept) => (
                <tr key={dept.id} style={{ borderBottom: "1px solid var(--separating-line)" }}>
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
          sectionKey="hr-manager-auto-content-card-2"
          parentKey="hr-manager-tab-dashboard"
          sectionType="content-card"
          backgroundToken="surface"
          title="Training Renewals"
          subtitle="Upcoming expiries across mandatory certifications"
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
                    borderBottom: "1px solid var(--separating-line)",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontWeight: 600, color: "var(--primary)" }}>{renewal.course}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{renewal.employee}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                    <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                      Due {new Date(renewal.dueDate).toLocaleDateString()}
                    </span>
                    <StatusTag label={renewal.status} tone={tone} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Absences & Warnings */}
      <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "1.4fr 1fr" }}>
        <SectionCard
          sectionKey="hr-manager-auto-content-card-3"
          parentKey="hr-manager-tab-dashboard"
          sectionType="content-card"
          backgroundToken="surface"
          title="Upcoming Holidays & Absences"
          subtitle="Next 14 days across the business"
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--info)", fontSize: "0.8rem" }}>
                <th style={{ paddingBottom: "10px" }}>Employee</th>
                <th>Department</th>
                <th>Type</th>
                <th>Dates</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAbsences.map((absence) => (
                <tr key={absence.id} style={{ borderBottom: "1px solid var(--separating-line)" }}>
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
          sectionKey="hr-manager-auto-content-card-4"
          parentKey="hr-manager-tab-dashboard"
          sectionType="content-card"
          backgroundToken="surface"
          title="Active Warnings"
          subtitle="Summary of open disciplinary notices"
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
                  borderBottom: "1px solid var(--separating-line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "var(--primary)" }}>{warning.employee}</span>
                  <StatusTag
                    label={warning.level}
                    tone={warning.level.includes("Final") ? "danger" : "warning"}
                  />
                </div>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>{warning.department}</span>
                <span style={{ fontSize: "0.8rem", color: "var(--info)" }}>
                  Issued {new Date(warning.issuedOn).toLocaleDateString()}
                </span>
                <span style={{ fontSize: "0.85rem", color: "var(--info-dark)" }}>{warning.notes}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
