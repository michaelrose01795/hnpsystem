import dayjs from "dayjs";
import DashboardWorkshopUi from "@/components/page-ui/dashboard/workshop/dashboard-workshop-ui";
import { SectionShell, StatCard } from "@/components/ui";
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { MockPage } from "./_helpers";

const dashboardData = {
  dailySummary: { inProgress: 6, checkedInToday: 9, completedToday: 4 },
  technicianAvailability: { totalTechnicians: 8, onJobs: 6, available: 2 },
  progress: { completed: 4, scheduled: 12 },
  queue: [
    { job_number: "DEMO-1042", vehicle_reg: "DE24 XYZ", status: "Awaiting tech", checked_in_at: "2026-04-23T08:30:00.000Z" },
    { job_number: "DEMO-1043", vehicle_reg: "TA23 ABC", status: "Awaiting parts", checked_in_at: "2026-04-23T09:05:00.000Z" },
    { job_number: "DEMO-1044", vehicle_reg: "TV22 HNP", status: "Diagnosis", checked_in_at: "2026-04-23T09:42:00.000Z" },
  ],
  outstandingVhc: [
    { job_number: "DEMO-1041", vehicle_reg: "AB22 KLM", checked_in_at: "2026-04-23T07:55:00.000Z" },
    { job_number: "DEMO-1045", vehicle_reg: "CD24 NOP", checked_in_at: "2026-04-23T10:12:00.000Z" },
  ],
  trends: {
    checkInsLast7: [
      { label: "Mon", count: 8 },
      { label: "Tue", count: 11 },
      { label: "Wed", count: 9 },
      { label: "Thu", count: 12 },
      { label: "Fri", count: 14 },
      { label: "Sat", count: 6 },
      { label: "Sun", count: 0 },
    ],
  },
};

// Mirrors the inline MetricCard/Section/TrendBlock/ProgressBar definitions in
// src/pages/dashboard/workshop/index.js so the slide visually matches the live
// dashboard. If the inline definitions in the page change, update them here.
const MetricCard = ({ sectionKey, parentKey, label, value, helper }) => (
  <StatCard
    sectionKey={sectionKey}
    parentKey={parentKey}
    className="app-section-card"
    style={{
      minWidth: "140px",
      flex: "1 1 140px",
      background: "var(--surface)",
      border: "1px solid var(--primary-border)",
    }}
  >
    <p style={{ margin: 0, textTransform: "uppercase", fontSize: "0.75rem", color: "var(--primary-selected)" }}>
      {label}
    </p>
    <p style={{ margin: "8px 0 0", fontSize: "1.9rem", fontWeight: 600 }}>{value}</p>
    {helper && <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--info)" }}>{helper}</p>}
  </StatCard>
);

const Section = ({ sectionKey, parentKey, title, subtitle, children, style }) => (
  <SectionShell
    sectionKey={sectionKey}
    parentKey={parentKey}
    className="app-section-card"
    style={{ gap: "12px", background: "var(--theme)", border: "1px solid rgba(var(--primary-rgb), 0.18)", ...style }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--primary-selected)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "6px 0 0", color: "var(--info)" }}>{subtitle}</p>}
    </div>
    {children}
  </SectionShell>
);

const TrendBlock = ({ sectionKey, parentKey, title, data }) => {
  const max = Math.max(1, ...(data || []).map((d) => d.count));
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
        flex: 1,
      }}
    >
      <p style={{ margin: 0, textTransform: "uppercase", color: "var(--primary-selected)", fontSize: "0.75rem" }}>{title}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {(data || []).map((p) => (
          <div key={p.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: 35, fontSize: "0.8rem", color: "var(--info)" }}>{p.label}</span>
            <div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round((p.count / max) * 100)}%`, background: "var(--danger)" }} />
            </div>
            <strong style={{ width: 30, fontSize: "0.85rem", color: "var(--primary-selected)" }}>{p.count}</strong>
          </div>
        ))}
      </div>
    </DevLayoutSection>
  );
};

const ProgressBar = ({ completed, target }) => {
  const safe = target > 0 ? target : 1;
  const pct = Math.min(100, Math.round((completed / safe) * 100));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--info)" }}>
        <span>Completed</span>
        <span>{pct}%</span>
      </div>
      <div style={{ width: "100%", height: 10, background: "var(--theme)", borderRadius: 5 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--info)", borderRadius: 5 }} />
      </div>
    </div>
  );
};

const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "-");

const twoColSplitStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
  alignItems: "stretch",
};

const listViewportStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  maxHeight: "276px",
  overflowY: "auto",
  paddingRight: "2px",
};

export default function DashboardWorkshopMock() {
  return (
    <MockPage
      Ui={DashboardWorkshopUi}
      overrides={{
        view: "section1",
        availableTechnicians: dashboardData.technicianAvailability.available,
        dashboardData,
        loading: false,
        error: null,
        formatTime,
        listViewportStyle,
        twoColSplitStyle,
        MetricCard,
        Section,
        TrendBlock,
        ProgressBar,
      }}
    />
  );
}
