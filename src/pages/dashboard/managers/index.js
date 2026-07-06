// file location: src/pages/dashboard/managers/index.js

"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
import { getManagersDashboardData } from "@/lib/database/dashboard/managers";
import { useKpiValues } from "@/hooks/reporting/useReporting";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import {
  ContentWidth,
  LayerSurface,
  LayerTheme,
  PageShell,
} from "@/components/ui";
import ManagersDashboardUi from "@/components/page-ui/dashboard/managers/dashboard-managers-ui";

const MANAGER_ROLES = [
  "service manager",
  "workshop manager",
  "parts manager",
  "admin manager",
  "accounts manager",
  "general manager",
  "owner",
];

// MetricCard — single stat tile. Lives inside a Section (LayerSurface),
// so per the strict alternation rule it renders as a LayerTheme.
const MetricCard = ({ sectionKey, parentKey, label, value, helper }) => (
  <LayerTheme
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType="stat-card"
    backgroundToken="surface"
    radius="var(--radius-sm)"
    style={{ background: "var(--surface)", minWidth: "140px", flex: "1 1 140px" }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--accentText)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{helper}</p>}
  </LayerTheme>
);

// Section — titled outer section card. Outermost surface inside the page,
// so per the alternation rule it renders as a LayerSurface.
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

const ProgressBar = ({ completed, target }) => {
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.round((completed / safeTarget) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--text-1)" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--surface)", borderRadius: 5 }}>
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

// TrendBlock — chart card. Rendered inside a Section (LayerSurface),
// so it is a LayerTheme. Internal chart bars are widget elements, not surfaces.
const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "workshop" };

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

// Strips the leading info icon (ℹ️ / ℹ / ⓘ / i) plus surrounding whitespace from a notice message.
const formatEscalationMessage = (message = "") =>
  String(message).replace(/^\s*(?:ℹ️|ℹ|ⓘ|i)\s*/i, "").trim();

// EscalationList — list block inside a Section. Container stays --surface;
// each row is its own LayerTheme so it renders on the --theme tint.
const EscalationList = ({ sectionKey, parentKey, items }) => (
  <LayerTheme
    sectionKey={sectionKey}
    parentKey={parentKey}
    backgroundToken="surface"
    radius="var(--radius-sm)"
    padding="14px"
    gap="10px"
    style={{ background: "var(--surface)" }}
  >
    {items.length === 0 ? (
      <p style={{ margin: 0, color: "var(--text-1)" }}>No escalations.</p>
    ) : (
      items.map((notice) => (
        <LayerTheme
          key={notice.notification_id}
          backgroundToken="theme"
          radius="var(--radius-sm)"
          padding="12px"
          gap="4px"
          style={{ background: "var(--theme)" }}
        >
          <p style={{ margin: 0, color: "var(--text-1)" }}>{formatEscalationMessage(notice.message)}</p>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--accentText)" }}>
            For {notice.target_role || "everyone"}
          </p>
        </LayerTheme>
      ))
    )}
  </LayerTheme>
);

const defaultData = {
  counts: { jobsCompleted: 0, vhcsCompleted: 0, pendingParts: 0, pendingVhc: 0 },
  escalations: [],
  progress: { completed: 0, scheduled: 1 },
  trend: { jobsCompletedLast7: [] },
};

const metricsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "10px",
};

const twoColSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "10px",
  alignItems: "stretch",
};

export default function ManagersDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess = MANAGER_ROLES.some((role) => userRoles.includes(role));
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportWeek = useKpiValues(hasAccess ? ["wsh.jobs_completed"] : [], REPORT_TREND_FILTER);

  useEffect(() => {
    if (!hasAccess) return;
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await getManagersDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load managers dashboard", fetchError);
        setError(fetchError.message || "Unable to load manager data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasAccess]);

  if (!hasAccess) {
    return <ManagersDashboardUi view="section1" />;
  }

  const reportJobsCompleted = reportWeek.byId["wsh.jobs_completed"]?.value;
  const reportLinkedData = {
    ...data,
    counts: {
      ...data.counts,
      jobsCompleted: reportJobsCompleted ?? data.counts.jobsCompleted,
    },
    progress: {
      ...data.progress,
      completed: reportJobsCompleted ?? data.progress.completed,
    },
  };

  return (
    <ManagersDashboardUi
      view="section2"
      data={reportLinkedData}
      error={error}
      loading={loading}
      ContentWidth={ContentWidth}
      DevLayoutSection={DevLayoutSection}
      EscalationList={EscalationList}
      MetricCard={MetricCard}
      PageShell={PageShell}
      ProgressBar={ProgressBar}
      Section={Section}
      TrendBlock={TrendBlock}
      metricsGridStyle={metricsGridStyle}
      twoColSplitStyle={twoColSplitStyle}
    />
  );
}
