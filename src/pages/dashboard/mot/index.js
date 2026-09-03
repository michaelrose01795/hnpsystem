// file location: src/pages/dashboard/mot/index.js
"use client";

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
// Loaded on demand.
//
// This module resolves the Supabase browser client, so importing it at module
// scope put 213 KB of @supabase/supabase-js into this route's first-load
// bundle — before the page could paint, for data that is only fetched from an
// effect after mount. The queries still start on the same tick they did
// before; only the download of the client moves off the critical path.
const loadDashboardData = () => import("@/lib/database/dashboard/mot");
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md section 3.0)
import MotDashboardUi from "@/components/page-ui/dashboard/mot/dashboard-mot-ui"; // Extracted presentation layer.
import { logFailure } from "@/lib/utils/logFailure";

// MetricCard - single stat tile. Lives inside a themed MOT section,
// so it renders on the neutral surface layer. minWidth: 0 lets it shrink
// inside the responsive grid instead of forcing a horizontal overflow.
const MetricCard = ({ label, value, helper }) => (
  <LayerSurface radius="var(--radius-sm)" style={{ minWidth: 0 }}>
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)", opacity: 0.7 }}>{helper}</p>}
  </LayerSurface>
);

// OutcomeBar - proportional pass / fail / retest split across every recorded
// MOT job, with the pass rate called out. Built from counts already on the
// payload, so it costs no extra query. The legend reuses the shared badge
// family rather than hand-rolled swatches.
const OutcomeBar = ({ pass = 0, fail = 0, retest = 0 }) => {
  const total = Number(pass) + Number(fail) + Number(retest);
  if (total === 0) return null;
  const share = (part) => `${Math.round((Number(part) / total) * 100)}%`;
  const segments = [
    { key: "pass", count: Number(pass), fill: "var(--success)", tone: "app-badge--success", label: "Pass" },
    { key: "retest", count: Number(retest), fill: "var(--warning)", tone: "app-badge--warning", label: "Retest" },
    { key: "fail", count: Number(fail), fill: "var(--danger)", tone: "app-badge--danger", label: "Fail" }
  ];
  return (
    <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
        <p style={{ margin: 0, opacity: 0.7 }}>Outcome split</p>
        <strong>{share(pass)} pass rate</strong>
      </div>
      {/* Fixed-height meter. borderRadius + overflow are the only way to clip the
          segments into a pill, and no shared meter primitive exists yet. */}
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
        {segments.map((segment) => (
          <div key={segment.key} style={{ width: share(segment.count), background: segment.fill }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {segments.map((segment) => (
          <span key={segment.key} className={`app-badge ${segment.tone}`}>
            {segment.label} {segment.count}
          </span>
        ))}
      </div>
    </LayerSurface>
  );
};

const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "mot" };
const REPORT_TODAY_FILTER = { range: "today", granularity: "day", department: "mot" };

const TrendBlock = ({ data }) => (
  <ReportLinkedTrend
    kpiId="mot.volume"
    filter={REPORT_TREND_FILTER}
    fallbackData={data}
    sectionKey="dashboard-mot-volume-trend-chart"
    parentKey="dashboard-mot-auto-content-card-2"
    unit="count"
    format="0,0"
  />
);

// CardList - recent MOT jobs. The section header already names the block, so
// the list carries no title of its own; each row shows the job, the plate and
// the check-in date, with the outcome as a tone-coded badge.
const outcomeTone = (status) => {
  const value = String(status || "").toLowerCase();
  if (value.includes("pass")) return "app-badge--success";
  if (value.includes("fail")) return "app-badge--danger";
  if (value.includes("retest")) return "app-badge--warning";
  return "app-badge--neutral";
};

const CardList = ({ items = [] }) => (
  <LayerSurface radius="var(--radius-sm)" padding="12px" gap="10px">
    {items.length === 0 ? (
      <p className="app-status-message app-status-message--info" style={{ margin: 0 }}>No MOT jobs recorded yet.</p>
    ) : (
      items.map((job) => (
        <div
          key={job.id}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}
        >
          <div style={{ minWidth: 0 }}>
            <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "-"}</strong>
            <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)", opacity: 0.7 }}>
              {job.vehicle_reg || "Plate TBC"}
              {job.checked_in_at ? ` · ${dayjs(job.checked_in_at).format("DD MMM")}` : ""}
            </p>
          </div>
          <span className={`app-badge ${outcomeTone(job.completion_status)}`}>
            {job.completion_status || "Pending"}
          </span>
        </div>
      ))
    )}
  </LayerSurface>
);

const defaultData = {
  testsToday: 0,
  passCount: 0,
  failCount: 0,
  retestCount: 0,
  recentTests: [],
  trends: [],
};

export default function MotDashboard() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const reportToday = useKpiValues(["mot.volume"], REPORT_TODAY_FILTER);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await (await loadDashboardData()).getMotDashboardData();
        setData(payload);
      } catch (fetchError) {
        logFailure("Failed to load MOT dashboard", fetchError);
        setError(fetchError.message || "Unable to load MOT data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const reportLinkedData = {
    ...data,
    testsToday: reportToday.byId["mot.volume"]?.value ?? data.testsToday,
  };

  return (
    <MotDashboardUi
      view="section1"
      CardList={CardList}
      data={reportLinkedData}
      error={error}
      LayerTheme={LayerTheme}
      loading={loading}
      MetricCard={MetricCard}
      OutcomeBar={OutcomeBar}
      TrendBlock={TrendBlock}
    />
  );
}
