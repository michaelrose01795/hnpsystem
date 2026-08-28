// file location: src/pages/dashboard/parts/index.js
"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { hasAllAccessRole } from "@/lib/auth/roles";
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
// Loaded on demand.
//
// This module resolves the Supabase browser client, so importing it at module
// scope put 213 KB of @supabase/supabase-js into this route's first-load
// bundle — before the page could paint, for data that is only fetched from an
// effect after mount. The queries still start on the same tick they did
// before; only the download of the client moves off the critical path.
const loadDashboardData = () => import("@/lib/database/dashboard/parts");
import { useKpiValues } from "@/hooks/reporting/useReporting";
import Section from "@/components/Section"; // shared titled section card — consolidated from duplicate local definitions
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md §3.0)
import PartsDashboardUi from "@/components/page-ui/dashboard/parts/dashboard-parts-ui"; // Extracted presentation layer.

// MetricCard — single stat tile. Lives inside a themed section (LayerTheme)
// on this dashboard, so per the strict alternation rule it renders as a LayerSurface.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 180 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--surfaceTextMuted)" }}>{helper}</p>}
  </LayerSurface>
);


const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "parts" };
const REPORT_TODAY_FILTER = { range: "today", granularity: "day", department: "parts" };

const TrendBlock = ({ data }) => (
  <ReportLinkedTrend
    kpiId="prt.requests"
    filter={REPORT_TREND_FILTER}
    fallbackData={data}
    sectionKey="dashboard-parts-requests-trend-chart"
    parentKey="dashboard-parts-requests-trend"
    unit="count"
    format="0,0"
  />
);

const humanizeStatusLabel = (value) => {
  if (!value) return "Unknown";
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// ListBlock — list block inside a themed section (LayerTheme), renders as LayerSurface.
const ListBlock = ({ title, items }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="8px">
    <p style={{ margin: 0, fontWeight: 600, color: "var(--text-accent)" }}>{title}</p>
    {(items || []).length === 0 ?
      <p style={{ margin: 0, color: "var(--surfaceTextMuted)" }}>No records yet.</p> :
      items.map((entry) =>
        <div key={entry.request_id} style={{ fontSize: "0.85rem", color: "var(--text-1)" }}>
          Request <strong style={{ color: "var(--text-accent)" }}>{entry.request_id}</strong>
          <span style={{ color: "var(--surfaceTextMuted)" }}> · {humanizeStatusLabel(entry.status)}</span>
        </div>
      )
    }
  </LayerSurface>
);


export default function PartsDashboard() {
  const { user } = useUser();
  const roleLabels = (user?.roles || []).map((role) => String(role).toLowerCase());
  const hasAccess =
    hasAllAccessRole(roleLabels) ||
    roleLabels.includes("parts") ||
    roleLabels.includes("parts manager");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportToday = useKpiValues(hasAccess ? ["prt.requests", "prt.ordered"] : [], REPORT_TODAY_FILTER);

  const requestSummary = {
    ...(data?.requestSummary ?? {}),
    totalRequests: reportToday.byId["prt.requests"]?.value ?? data?.requestSummary?.totalRequests,
    partsOnOrder: reportToday.byId["prt.ordered"]?.value ?? data?.requestSummary?.partsOnOrder,
  };
  const stockAlerts = data?.stockAlerts || [];
  const requestsByStatus = data?.requestsByStatus || [];
  const recentRequests = data?.recentRequests || [];
  const trendData = data?.trend || [];

  useEffect(() => {
    if (!hasAccess) {
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await (await loadDashboardData()).getPartsDashboardData();
        setData(payload);
      } catch (fetchError) {
        console.error("Failed to load parts dashboard", fetchError);
        setData(null);
        setError(fetchError.message || "Unable to load parts data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [hasAccess]);

  if (!hasAccess) {
    return <PartsDashboardUi view="section1" />;
  }

  return <PartsDashboardUi view="section2" data={data} error={error} LayerSurface={LayerSurface} LayerTheme={LayerTheme} ListBlock={ListBlock} loading={loading} MetricCard={MetricCard} recentRequests={recentRequests} requestsByStatus={requestsByStatus} requestSummary={requestSummary} Section={Section} stockAlerts={stockAlerts} TrendBlock={TrendBlock} trendData={trendData} />;
}
