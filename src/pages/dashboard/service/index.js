// file location: src/pages/dashboard/service/index.js
"use client";

import React, { useEffect, useState } from "react";
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
import { getServiceDashboardData } from "@/lib/database/dashboard/service";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md §3.0)
import ServiceDashboardUi from "@/components/page-ui/dashboard/service/dashboard-service-ui";

// MetricCard — single stat tile. Lives inside a ThemeCard (LayerTheme),
// so per the strict alternation rule it renders as a LayerSurface.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 0 }}>
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.8rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-2)" }}>{helper}</p>}
  </LayerSurface>
);

const PieChart = ({ breakdown }) => {
  const total = breakdown.waiting + breakdown.loan + breakdown.collection || 1;
  const segments = [
    { label: "Waiting", value: breakdown.waiting, color: "var(--danger)" },
    { label: "Loan car", value: breakdown.loan, color: "var(--accent-purple)" },
    { label: "Collection", value: breakdown.collection, color: "var(--info)" },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
      {segments.map((segment) => (
        <div key={segment.label} style={{ minWidth: 120, flex: "1 1 120px" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-2)" }}>{segment.label}</p>
          <div
            style={{
              height: 12,
              width: "100%",
              background: "var(--surface)",
              borderRadius: 6,
              overflow: "hidden",
              margin: "6px 0",
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
          <strong style={{ color: "var(--text-accent)" }}>{segment.value}</strong>
        </div>
      ))}
    </div>
  );
};

// TrendBlock — chart card inside a ThemeCard (LayerTheme), renders as LayerSurface.
const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "service" };
const REPORT_TODAY_FILTER = { range: "today", granularity: "day", department: "service" };

const TrendBlock = ({ data }) => (
  <ReportLinkedTrend
    kpiId="svc.booking_volume"
    filter={REPORT_TREND_FILTER}
    fallbackData={data}
    sectionKey="dashboard-service-booking-volume-chart"
    parentKey="dashboard-service-appointment-trends"
    unit="count"
    format="0,0"
  />
);

const ProgressBar = ({ completed, target }) => {
  const percentage = Math.min(100, Math.round((completed / target) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-2)" }}>
        <span style={{ color: "var(--text-1)" }}>Completed</span>
        <span style={{ color: "var(--text-accent)" }}>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--surface)", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--danger)",
            borderRadius: 5,
          }}
        />
      </div>
    </div>
  );
};

// QueueItem — list-row card inside a ThemeCard (LayerTheme), renders as LayerSurface.
const QueueItem = ({ job }) => (
  <LayerSurface
    radius="var(--radius-sm)"
    padding="12px 14px"
    style={{
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "12px",
    }}
  >
    <div style={{ minWidth: 0 }}>
      <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "—"}</strong>
      <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "0.85rem" }}>
        {job.vehicle_reg || "Plate missing"}
      </p>
    </div>
    <span style={{ fontSize: "0.85rem", color: "var(--text-1)", textAlign: "right" }}>
      {job.status || "Status unknown"}
    </span>
  </LayerSurface>
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
  const reportToday = useKpiValues(["svc.booking_volume"], REPORT_TODAY_FILTER);

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

  const reportLinkedData = {
    ...data,
    appointmentsToday: reportToday.byId["svc.booking_volume"]?.value ?? data.appointmentsToday,
  };

  return (
    <ServiceDashboardUi
      view="section1"
      data={reportLinkedData}
      error={error}
      loading={loading}
      LayerTheme={LayerTheme}
      MetricCard={MetricCard}
      PieChart={PieChart}
      ProgressBar={ProgressBar}
      QueueItem={QueueItem}
      TrendBlock={TrendBlock}
    />
  );
}
