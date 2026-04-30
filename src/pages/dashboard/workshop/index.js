// file location: src/pages/dashboard/workshop/index.js
"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { getWorkshopDashboardData } from "@/lib/database/dashboard/workshop";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { ContentWidth, PageShell, SectionShell, StatCard } from "@/components/ui";
import WorkshopDashboardUi from "@/components/page-ui/dashboard/workshop/dashboard-workshop-ui"; // Extracted presentation layer.

const MetricCard = ({ sectionKey, parentKey, label, value, helper }) =>
<StatCard
  sectionKey={sectionKey}
  parentKey={parentKey}
  className="app-section-card"
  style={{
    minWidth: "140px",
    flex: "1 1 140px",
    background: "var(--surface)",
    border: "1px solid var(--primary-border)"
  }}>
  
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-selected)" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </StatCard>;


const Section = ({ sectionKey, parentKey, title, subtitle, children, style }) =>
<SectionShell
  sectionKey={sectionKey}
  parentKey={parentKey}
  className="app-section-card"
  style={{
    gap: "12px",
    background: "var(--theme)",
    border: "1px solid rgba(var(--primary-rgb), 0.18)",
    ...style
  }}>
  
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-selected)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </SectionShell>;


const TrendBlock = ({ sectionKey, parentKey, title, data }) => {
  const maxValue = Math.max(1, ...(data || []).map((item) => item.count));
  return (
    <DevLayoutSection
      sectionKey={sectionKey}
      parentKey={parentKey}
      sectionType="content-card"
      style={{
        border: "1px solid rgba(var(--primary-rgb), 0.18)",
        borderRadius: "var(--radius-sm)",
        padding: "16px",
        background: "var(--theme)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1
      }}>
      
      <p style={{ margin: 0, textTransform: "uppercase", color: "var(--primary-selected)", fontSize: "0.75rem" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {(data || []).map((point) =>
        <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 35, fontSize: "0.8rem", color: "var(--info)" }}>{point.label}</span>
            <div
            style={{
              flex: 1,
              height: 8,
              background: "var(--surface)",
              borderRadius: 4,
              overflow: "hidden"
            }}>
            
              <div
              style={{
                height: "100%",
                width: `${Math.round(point.count / maxValue * 100)}%`,
                background: "var(--danger)"
              }} />
            
            </div>
            <strong style={{ width: 30, fontSize: "0.85rem", color: "var(--primary-selected)" }}>{point.count}</strong>
          </div>
        )}
      </div>
    </DevLayoutSection>);

};

const ProgressBar = ({ completed, target }) => {
  const safeTarget = target > 0 ? target : 1;
  const percentage = Math.min(100, Math.round(completed / safeTarget * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info)" }}>
        <span>Completed</span>
        <span>{percentage}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--theme)", borderRadius: 5 }}>
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: "var(--info)",
            borderRadius: 5
          }} />
        
      </div>
    </div>);

};

const formatTime = (value) => value ? dayjs(value).format("HH:mm") : "-";

const defaultData = {
  dailySummary: { inProgress: 0, checkedInToday: 0, completedToday: 0 },
  technicianAvailability: { totalTechnicians: 0, onJobs: 0, available: 0 },
  progress: { completed: 0, scheduled: 1 },
  queue: [],
  outstandingVhc: [],
  trends: { checkInsLast7: [] }
};

const twoColSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch"
};

const listViewportStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxHeight: "276px",
  overflowY: "auto",
  paddingRight: "2px"
};

export default function WorkshopDashboard() {
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

  return <WorkshopDashboardUi view="section1" availableTechnicians={availableTechnicians} ContentWidth={ContentWidth} dashboardData={dashboardData} DevLayoutSection={DevLayoutSection} error={error} formatTime={formatTime} listViewportStyle={listViewportStyle} loading={loading} MetricCard={MetricCard} PageShell={PageShell} ProgressBar={ProgressBar} Section={Section} TrendBlock={TrendBlock} twoColSplitStyle={twoColSplitStyle} />;















































































































































































}
