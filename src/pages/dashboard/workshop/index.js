// file location: src/pages/dashboard/workshop/index.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import {
  ContentWidth,
  LayerSurface,
  LayerTheme,
  PageShell,
} from "@/components/ui";
import WorkshopDashboardUi from "@/components/page-ui/dashboard/workshop/dashboard-workshop-ui";

// MetricCard — single stat tile. Lives inside the daily-checkpoints LayerSurface,
// so per the strict alternation rule it renders as a LayerTheme.
const MetricCard = ({ sectionKey, parentKey, label, value, helper }) => (
  <LayerTheme
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType="stat-card"
    backgroundToken="surface"
    radius="var(--radius-sm)"
    style={{
      background: "var(--surface)",
      minWidth: "140px",
      flex: "1 1 140px",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--accentText)" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{helper}</p>}
  </LayerTheme>
);

// Section — titled outer section card. Outermost surface inside the page,
// so per the alternation rule it renders as a LayerSurface (white).
const Section = ({ sectionKey, parentKey, title, subtitle, children, style }) => (
  <LayerSurface
    as="section"
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType="section-shell"
    backgroundToken="theme"
    gap="12px"
    style={{ background: "var(--theme)", ...style }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--accentText)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--text-1)" }}>{subtitle}</p>}
    </div>
    {children}
  </LayerSurface>
);

// TrendBlock — chart card. Rendered inside a Section (LayerSurface),
// so it is a LayerTheme. Internal chart bars are widget elements, not surfaces.
const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "workshop" };
const REPORT_TODAY_FILTER = { range: "today", granularity: "day", department: "workshop" };

const TrendBlock = ({ sectionKey, parentKey, data }) => (
  <ReportLinkedTrend
    kpiId="wsh.jobs_completed"
    filter={REPORT_TREND_FILTER}
    fallbackData={data}
    sectionKey={sectionKey}
    parentKey={parentKey}
    unit="count"
    format="0,0"
    height={132}
  />
);

const ProgressBar = ({ completed, target }) => {
  const safeTarget = Math.max(target, completed, 1);
  const percentage = Math.min(100, Math.round((completed / safeTarget) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
        {[
          ["Completed", completed],
          ["Scheduled", target],
          ["Rate", `${percentage}%`],
        ].map(([label, value]) => (
          <div key={label} style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", padding: "10px" }}>
            <p style={{ margin: 0, color: "var(--text-1)", fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
            <strong style={{ display: "block", marginTop: "4px", color: "var(--accentText)", fontSize: "1.15rem" }}>{value}</strong>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-1)" }}>
        <span>{completed} completed from {target} scheduled</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--theme)", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--accentText)",
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
  gap: "10px",
  alignItems: "stretch",
};

const listViewportStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  maxHeight: "276px",
  overflowY: "auto",
  paddingRight: "2px",
};

export default function WorkshopDashboard() {
  const [dashboardData, setDashboardData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportToday = useKpiValues(["wsh.jobs_completed"], REPORT_TODAY_FILTER);

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

  const reportLinkedData = useMemo(() => {
    const completed = reportToday.byId["wsh.jobs_completed"]?.value;
    if (completed == null) return dashboardData;
    return {
      ...dashboardData,
      dailySummary: {
        ...dashboardData.dailySummary,
        completedToday: completed,
      },
      progress: {
        ...dashboardData.progress,
        completed,
      },
    };
  }, [dashboardData, reportToday.byId]);

  return (
    <WorkshopDashboardUi
      view="section1"
      availableTechnicians={availableTechnicians}
      ContentWidth={ContentWidth}
      dashboardData={reportLinkedData}
      DevLayoutSection={DevLayoutSection}
      LayerTheme={LayerTheme}
      error={error}
      formatTime={formatTime}
      listViewportStyle={listViewportStyle}
      loading={loading}
      MetricCard={MetricCard}
      PageShell={PageShell}
      ProgressBar={ProgressBar}
      Section={Section}
      TrendBlock={TrendBlock}
      twoColSplitStyle={twoColSplitStyle}
    />
  );
}
