// file location: src/pages/dashboard/valeting/index.js
"use client";

import React, { useEffect, useState } from "react"; // React runtime + hooks
import ReportLinkedTrend from "@/components/dashboards/ReportLinkedTrend";
import { getValetingDashboardData } from "@/lib/database/dashboard/valeting"; // fetch valet dashboard metrics
import { useKpiValues } from "@/hooks/reporting/useReporting";
import { LayerSurface, LayerTheme } from "@/components/ui"; // canonical layer primitives (see CLAUDE.md §3.0)
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";

// MetricCard — single stat tile. Lives inside an outer LayerTheme section,
// so per the strict alternation rule it renders as a LayerSurface.
import ValetingDashboardUi from "@/components/page-ui/dashboard/valeting/dashboard-valeting-ui"; // Extracted presentation layer.
const MetricCard = ({ label, value, helper, sectionKey, parentKey }) => (
  <LayerSurface
    sectionKey={sectionKey}
    parentKey={parentKey}
    sectionType="stat-card"
    backgroundToken="surface"
    radius="var(--radius-sm)"
    data-dev-text-preview={label}
    style={{ minWidth: 0 }}
  >
    <p style={{ margin: 0, fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-accent)" }}>{label}</p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600, color: "var(--text-1)" }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{helper}</p>}
  </LayerSurface>
);


// TrendBlock — horizontal bar chart rows. Sits inside the outer LayerTheme
// "Queue trend" section, so each row is a LayerSurface for alternation.
const REPORT_TREND_FILTER = { range: "last_7d", granularity: "day", department: "valeting" };
const REPORT_TODAY_FILTER = { range: "today", granularity: "day", department: "valeting" };

const TrendBlock = ({ data }) => (
  <ReportLinkedTrend
    kpiId="val.cars_washed"
    filter={REPORT_TREND_FILTER}
    fallbackData={data}
    sectionKey="dashboard-valeting-cars-washed-chart"
    parentKey="dashboard-valeting-queue-trend"
    unit="count"
    format="0,0"
  />
);

// QueueBoard — waiting cars table. Sits inside the themed "Queue board"
// section, so rows render as LayerSurface for alternation.
const QueueBoard = ({ queue }) =>
<DevLayoutSection
  sectionKey="dashboard-valeting-queue-board-list"
  parentKey="dashboard-valeting-queue-board"
  sectionType="section-shell"
  backgroundToken="transparent"
  data-dev-text-preview="Cars checked in and ready list"
  style={{ display: "flex", flexDirection: "column", gap: "10px" }}
>
    {queue.length === 0 ?
  <LayerSurface
    sectionKey="dashboard-valeting-queue-empty"
    parentKey="dashboard-valeting-queue-board-list"
    sectionType="content-card"
    backgroundToken="surface"
    radius="var(--radius-sm)"
    padding="16px"
    data-dev-text-preview="No cars waiting"
    style={{ color: "var(--text-1)" }}
  >
        No cars waiting.
      </LayerSurface> :

  <>
        <DevLayoutSection
      sectionKey="dashboard-valeting-queue-headings"
      parentKey="dashboard-valeting-queue-board-list"
      sectionType="table-headings"
      backgroundToken="transparent"
      data-dev-text-preview="Vehicle Status Queue headings"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
        gap: "12px",
        alignItems: "center",
        padding: "0 8px 10px"
      }}>

          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-accent)" }}>Vehicle</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-accent)" }}>Status</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-accent)" }}>Queue</span>
        </DevLayoutSection>
        <DevLayoutSection
      sectionKey="dashboard-valeting-queue-rows"
      parentKey="dashboard-valeting-queue-board-list"
      sectionType="table-rows"
      backgroundToken="transparent"
      data-dev-text-preview="Queue rows"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxHeight: "294px",
        overflowY: "auto",
        paddingRight: "4px"
      }}>

          {queue.map((job) =>
      <LayerSurface
        key={job.id}
        sectionKey={`dashboard-valeting-queue-row-${job.id}`}
        parentKey="dashboard-valeting-queue-rows"
        sectionType="content-card"
        backgroundToken="surface"
        data-dev-text-preview={`${job.job_number || "Job"} ${job.vehicle_reg || "Plate"} ${job.waiting_status || "Ready"}`}
        radius="var(--radius-sm)"
        padding="14px 16px"
        style={{
          display: "grid", // override flex column from LayerTheme default for grid row layout
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
          gap: "12px",
          alignItems: "center",
          minHeight: "66px",
          boxShadow: "0 1px 0 rgba(var(--primary-rgb), 0.04)" // subtle lift, non-surface concern
        }}>
              <div style={{ minWidth: 0 }}>
                <strong style={{ color: "var(--text-accent)" }}>{job.job_number || "—"}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-1)" }}>{job.vehicle_reg || "Plate"}</p>
              </div>
              <span style={{ color: "var(--text-1)", fontSize: "0.9rem" }}>{job.status || "Checked in"}</span>
              <span
          style={{
            justifySelf: "start",
            padding: "6px 10px",
            borderRadius: "999px", // pill badge — non-surface decorative element
            background: "rgba(var(--primary-rgb), 0.1)", // pill badge — non-surface decorative element
            color: "var(--text-accent)",
            fontSize: "0.82rem",
            fontWeight: 600
          }}>

                {job.waiting_status || "Ready"}
              </span>
            </LayerSurface>
      )}
        </DevLayoutSection>
      </>
  }
  </DevLayoutSection>;


// default empty state for dashboard data
const defaultData = {
  waitingCount: 0, // cars waiting to be washed
  washedCount: 0, // cars already washed
  delayedCount: 0, // cars with delay flag
  waitingQueue: [], // list of cars in the queue
  trends: [] // 7-day trend data
};

export default function ValetingDashboard() {
  const [data, setData] = useState(defaultData); // dashboard metrics state
  const [loading, setLoading] = useState(true); // loading indicator
  const [error, setError] = useState(null); // error message
  const reportToday = useKpiValues(["val.cars_washed"], REPORT_TODAY_FILTER);

  useEffect(() => {
    const loadData = async () => {// fetch dashboard data on mount
      setLoading(true); // show loading state
      setError(null); // clear previous errors
      try {
        const payload = await getValetingDashboardData(); // call Supabase query
        setData(payload); // update state with fetched data
      } catch (fetchError) {
        console.error("Failed to load valeting metrics", fetchError); // log error
        setError(fetchError.message || "Unable to load valeting data"); // display error
      } finally {
        setLoading(false); // hide loading state
      }
    };
    loadData(); // invoke on mount
  }, []);

  const reportLinkedData = {
    ...data,
    washedCount: reportToday.byId["val.cars_washed"]?.value ?? data.washedCount,
  };

  return <ValetingDashboardUi view="section1" data={reportLinkedData} error={error} LayerSurface={LayerSurface} LayerTheme={LayerTheme} loading={loading} MetricCard={MetricCard} QueueBoard={QueueBoard} TrendBlock={TrendBlock} />;
}
