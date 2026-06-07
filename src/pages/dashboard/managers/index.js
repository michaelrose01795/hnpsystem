// file location: src/pages/dashboard/managers/index.js

"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { getManagersDashboardData } from "@/lib/database/dashboard/managers";
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
    className="glass-card"
    style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)", minWidth: "140px", flex: "1 1 140px" }}
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
    className="glass-card glass-card--theme"
    style={{ background: "var(--glass-theme)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)", ...style }}
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
const TrendBlock = ({ sectionKey, parentKey, data }) => {
  const max = Math.max(1, ...(data || []).map((point) => point.count));
  return (
    <LayerTheme
      sectionKey={sectionKey}
      parentKey={parentKey}
      backgroundToken="surface"
      radius="var(--radius-sm)"
      padding="16px"
      gap="10px"
      className="glass-card"
      style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)" }}
    >
      {(data || []).length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-1)" }}>No completion data for the past 7 days.</p>
      ) : (
        (data || []).map((point) => (
          <div key={point.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: 36, fontSize: "0.85rem", color: "var(--text-1)" }}>{point.label}</span>
            <div style={{ flex: 1, height: 8, background: "var(--theme)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.round((point.count / max) * 100)}%`,
                  height: "100%",
                  background: "var(--accentText)",
                  borderRadius: 4,
                }}
              />
            </div>
            <strong style={{ width: 30, fontSize: "0.85rem", color: "var(--accentText)", textAlign: "right" }}>{point.count}</strong>
          </div>
        ))
      )}
    </LayerTheme>
  );
};

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
    className="glass-card"
    style={{ background: "var(--glass-surface)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)" }}
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
          className="glass-card glass-card--theme"
          style={{ background: "var(--glass-theme)", backdropFilter: "var(--glass-blur)", WebkitBackdropFilter: "var(--glass-blur)", boxShadow: "var(--glass-shadow)" }}
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

  return (
    <ManagersDashboardUi
      view="section2"
      data={data}
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
