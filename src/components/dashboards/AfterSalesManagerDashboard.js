// file location: src/components/dashboards/AfterSalesManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { supabase } from "@/lib/database/supabaseClient";
import { SectionCard } from "@/components/Section"; // section card layout — ghost chain removed
import { formatCurrencyRounded as formatCurrency } from "@/components/dashboards/DashboardPrimitives"; // currency formatter
import DevLayoutSection from "@/components/dev-layout-overlay/DevLayoutSection";
import { SkeletonBlock } from "@/components/ui/LoadingSkeleton";

const revenueStreams = [
  { label: "Service Retail", actual: 28600, target: 26000 },
  { label: "MOT & Safety", actual: 6400, target: 7200 },
  { label: "Warranty", actual: 9100, target: 7500 },
  { label: "Parts Counter", actual: 5100, target: 4800 },
];

const strategicRisks = [
  {
    title: "EV throughput",
    detail: "Charger fault on Bay 5 means EV bookings sliding into tomorrow.",
    owner: "Workshop Manager",
    mitigation: "Mobile charger delivered 13:30, rebook 2 EV jobs.",
    severity: "high",
  },
  {
    title: "CSI follow-up",
    detail: "Two VIP surveys at risk due to delayed callbacks.",
    owner: "Customer Care",
    mitigation: "Video update recorded, concierge on route to handover.",
    severity: "medium",
  },
  {
    title: "Parts margin",
    detail: "Brake kit campaign burning margin (-4.3% vs plan).",
    owner: "Parts Manager",
    mitigation: "Switch to OEM+ supplier for next batch, update menu price.",
    severity: "medium",
  },
];

const loyaltyMetrics = [
  { label: "Club Members", value: "1,842", helper: "+112 MTD" },
  { label: "Renewals", value: "78%", helper: "vs 74% target" },
  { label: "Finance Referrals", value: "16", helper: "+4 vs same day last week" },
];

const regionalSnapshot = [
  { site: "H&P North", doc: "GP %", value: 54, trend: "+2.1%" },
  { site: "H&P City", doc: "Throughput", value: 128, trend: "-3 jobs" },
  { site: "H&P Coast", doc: "CSI", value: 92, trend: "+4 pts" },
];

const quickActions = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/appointments" },
];


const KPI_INITIAL_STATE = { todaysJobs: 0, openJobs: 0, partsPending: 0, vhcSentToday: 0 }; // Default KPI values before Supabase responds.
const JOB_STATUS_EXCLUSIONS = ["finished", "Finished", "complete", "Complete"]; // TODO: Confirm which job statuses mean fully completed.

const formatCount = (value) => (typeof value === "number" ? value.toLocaleString("en-GB") : value); // Helper to format integer KPIs.


export default function AfterSalesManagerDashboard() {
  const [kpis, setKpis] = useState(KPI_INITIAL_STATE); // Track live KPI counts.
  const [kpiLoading, setKpiLoading] = useState(true); // Track loading state for KPI fetch.
  const [kpiError, setKpiError] = useState(null); // Track any Supabase error messages.

  useEffect(() => {
    let isMounted = true; // Prevent state updates if the component unmounts.

    const fetchKpis = async () => {
      setKpiLoading(true); // Begin loading state.
      setKpiError(null); // Reset previous errors.

      const startOfDay = dayjs().startOf("day").toISOString(); // ISO timestamp for day start.
      const startOfTomorrow = dayjs().add(1, "day").startOf("day").toISOString(); // ISO timestamp for next day start.

      try {
        const jobsTodayPromise = supabase // Count jobs created today.
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfDay)
          .lt("created_at", startOfTomorrow);

        const openJobsQuery = supabase // Count open jobs by excluding completed statuses.
          .from("jobs")
          .select("id", { count: "exact", head: true });
        JOB_STATUS_EXCLUSIONS.forEach((status) => {
          openJobsQuery.not("status", "eq", status); // Exclude each finished status variant.
        });

        const partsPendingPromise = supabase // Count pending parts allocations.
          .from("parts_job_items")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "awaiting_stock"]);

        const vhcSentPromise = supabase // Count VHC sends triggered today.
          .from("vhc_send_history")
          .select("id", { count: "exact", head: true })
          .gte("sent_at", startOfDay)
          .lt("sent_at", startOfTomorrow);

        const [jobsTodayResult, openJobsResult, partsPendingResult, vhcSentResult] = await Promise.all([
          jobsTodayPromise,
          openJobsQuery,
          partsPendingPromise,
          vhcSentPromise,
        ]); // Await all queries in parallel.

        const error =
          jobsTodayResult.error ||
          openJobsResult.error ||
          partsPendingResult.error ||
          vhcSentResult.error; // Collapse Supabase errors into a single reference.

        if (error) {
          throw new Error(error.message || "Failed to load KPIs"); // Surface first error encountered.
        }

        if (isMounted) {
          setKpis({
            todaysJobs: jobsTodayResult.count ?? 0,
            openJobs: openJobsResult.count ?? 0,
            partsPending: partsPendingResult.count ?? 0,
            vhcSentToday: vhcSentResult.count ?? 0,
          }); // Persist fetched counts.
        }
      } catch (fetchError) {
        if (isMounted) {
          setKpiError(fetchError?.message || "Failed to load KPIs"); // Persist readable error.
        }
      } finally {
        if (isMounted) {
          setKpiLoading(false); // Clear loading state regardless of outcome.
        }
      }
    };

    fetchKpis(); // Trigger initial load on mount.

    return () => {
      isMounted = false; // Prevent updates once unmounted.
    };
  }, []);

  const metricCards = useMemo(() => {
    const descriptors = [
      {
        key: "todaysJobs",
        label: "Today’s Jobs",
        helper: "Jobs created today",
        accent: "var(--warning)",
      },
      {
        key: "openJobs",
        label: "Open Jobs",
        helper: "Active jobs excluding completed statuses",
        accent: "var(--warning)",
      },
      {
        key: "partsPending",
        label: "Parts Pending",
        helper: "Requests awaiting allocation",
        accent: "var(--danger)",
      },
      {
        key: "vhcSentToday",
        label: "VHC Sent Today",
        helper: "Customer VHC reports sent",
        accent: "var(--success)",
      },
    ];

    return descriptors.map((descriptor) => {
      if (kpiLoading) {
        // Render a skeleton block in the value slot so the KPI card shape is
        // preserved exactly — no "Loading…" text replacing the metric.
        return {
          ...descriptor,
          value: <SkeletonBlock width="64px" height="28px" />,
          helper: <SkeletonBlock width="120px" height="10px" />,
        };
      }
      if (kpiError) {
        return { ...descriptor, value: "--", helper: kpiError };
      }
      return {
        ...descriptor,
        value: formatCount(kpis[descriptor.key] ?? 0),
      };
    });
  }, [kpis, kpiLoading, kpiError]);

  const today = dayjs().format("dddd, D MMM"); // Format headline date string.
  const totals = revenueStreams.reduce(
    (acc, stream) => {
      acc.actual += stream.actual;
      acc.target += stream.target;
      return acc;
    },
    { actual: 0, target: 0 }
  );
  const progress = Math.round((totals.actual / totals.target) * 100);

  return (
    <DevLayoutSection sectionKey="dashboard-aftersales-shell" sectionType="page-shell" shell style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <DevLayoutSection
        as="header"
        sectionKey="dashboard-aftersales-header"
        parentKey="dashboard-aftersales-shell"
        sectionType="section-shell"
        shell
        className="app-section-card"
        style={{
          background: "var(--warning-surface)",
          border: "none",
          gap: "6px",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.78rem", color: "var(--warning-dark)" }}>
          After Sales Performance War Room
        </span>
        <h1 style={{ margin: 0, fontSize: "1.9rem", color: "var(--warning-dark)" }}>Revenue & Loyalty Pulse</h1>
        <p style={{ margin: 0, color: "var(--warning)" }}>{today} • {formatCurrency(totals.actual)} / {formatCurrency(totals.target)} • {progress}% to plan</p>
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-aftersales-quick-actions"
        parentKey="dashboard-aftersales-shell"
        sectionType="toolbar"
        className="app-section-card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          padding: "14px 20px",
          border: "none",
        }}
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="app-btn app-btn--control app-btn--pill"
          >
            {action.label}
          </Link>
        ))}
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-aftersales-metrics-grid"
        parentKey="dashboard-aftersales-shell"
        sectionType="grid-card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "18px",
        }}
      >
        {metricCards.map((metric, index) => (
          <div
            key={metric.label}
            className="app-section-card"
            data-dev-section="1"
            data-dev-section-key={`dashboard-aftersales-metric-${index + 1}`}
            data-dev-section-type="stat-card"
            data-dev-section-parent="dashboard-aftersales-metrics-grid"
            style={{
              border: `1px solid ${metric.accent}22`,
              padding: "18px",
              gap: "6px",
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--info)", fontSize: "0.78rem" }}>
              {metric.label}
            </span>
            <strong style={{ fontSize: "1.7rem", color: metric.accent }}>{metric.value}</strong>
            <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>{metric.helper}</span>
          </div>
        ))}
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-aftersales-revenue-row"
        parentKey="dashboard-aftersales-shell"
        sectionType="grid-card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 1fr)",
          gap: "18px",
        }}
      >
        <DevLayoutSection sectionKey="dashboard-aftersales-revenue-streams" parentKey="dashboard-aftersales-revenue-row" sectionType="content-card">
          <SectionCard borderColor="var(--warning)" style={{ gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--warning-dark)", fontSize: "1.2rem" }}>Revenue Streams</h2>
              <p style={{ margin: "4px 0 0", color: "var(--warning)" }}>
                {formatCurrency(totals.actual - totals.target)} vs plan • {progress}% achieved
              </p>
            </div>
            <strong style={{ fontSize: "1.3rem", color: "var(--warning)" }}>{formatCurrency(totals.actual)}</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {revenueStreams.map((stream) => {
              const streamProgress = Math.round((stream.actual / stream.target) * 100);
              return (
                <div key={stream.label} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "var(--warning-dark)" }}>{stream.label}</strong>
                    <span style={{ color: "var(--info-dark)" }}>
                      {formatCurrency(stream.actual)} / {formatCurrency(stream.target)} ({streamProgress}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "12px",
                      borderRadius: "var(--radius-pill)",
                      background: "var(--warning-surface)",
                      border: "none",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(streamProgress, 125)}%`,
                        height: "100%",
                        background: "var(--danger)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          </SectionCard>
        </DevLayoutSection>

        <DevLayoutSection sectionKey="dashboard-aftersales-regional-pulse" parentKey="dashboard-aftersales-revenue-row" sectionType="content-card">
          <SectionCard borderColor="var(--warning)" style={{ gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--warning-dark)", fontSize: "1.2rem" }}>Regional Pulse</h2>
            <p style={{ margin: "4px 0 0", color: "var(--warning)" }}>Sites benchmarked vs strategic KPIs</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {regionalSnapshot.map((site) => (
              <div
                key={site.site}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ color: "var(--warning-dark)" }}>{site.site}</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--warning)", fontSize: "0.85rem" }}>{site.doc}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "1.4rem", color: "var(--warning)" }}>{site.value}</strong>
                  <p style={{ margin: "4px 0 0", color: site.trend.startsWith("+") ? "var(--success)" : "var(--danger)" }}>
                    {site.trend}
                  </p>
                </div>
              </div>
            ))}
          </div>
          </SectionCard>
        </DevLayoutSection>
      </DevLayoutSection>

      <DevLayoutSection
        as="section"
        sectionKey="dashboard-aftersales-risk-loyalty-row"
        parentKey="dashboard-aftersales-shell"
        sectionType="grid-card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 1fr)",
          gap: "18px",
        }}
      >
        <DevLayoutSection sectionKey="dashboard-aftersales-strategic-risks" parentKey="dashboard-aftersales-risk-loyalty-row" sectionType="content-card">
          <SectionCard borderColor="var(--warning)" style={{ gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--warning-dark)", fontSize: "1.2rem" }}>Strategic Risks</h2>
            <p style={{ margin: "4px 0 0", color: "var(--warning)" }}>Escalations that impact daily GP and CSI</p>
          </div>
          {strategicRisks.map((risk) => (
            <div
              key={risk.title}
              style={{
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                background: risk.severity === "high" ? "var(--warning-surface)" : "var(--warning-surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "var(--warning-dark)" }}>{risk.title}</strong>
                <span
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: risk.severity === "high" ? "var(--danger)" : "var(--warning)",
                    fontSize: "0.75rem",
                  }}
                >
                  {risk.severity}
                </span>
              </div>
              <p style={{ margin: "6px 0", color: "var(--info-dark)" }}>{risk.detail}</p>
              <p style={{ margin: "6px 0", color: "var(--warning-dark)", fontSize: "0.9rem" }}>
                Owner: {risk.owner} • Mitigation: {risk.mitigation}
              </p>
            </div>
          ))}
          </SectionCard>
        </DevLayoutSection>

        <DevLayoutSection sectionKey="dashboard-aftersales-loyalty-engine" parentKey="dashboard-aftersales-risk-loyalty-row" sectionType="content-card">
          <SectionCard borderColor="var(--warning)">
          <div>
            <h2 style={{ margin: 0, color: "var(--warning-dark)", fontSize: "1.2rem" }}>Loyalty Engine</h2>
            <p style={{ margin: "4px 0 0", color: "var(--warning)" }}>Subscription and retention guardrails</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loyaltyMetrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px",
                  background: "var(--warning-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ color: "var(--warning)", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {metric.label}
                </span>
                <strong style={{ fontSize: "1.6rem", color: "var(--warning)" }}>{metric.value}</strong>
                <span style={{ color: "var(--info-dark)" }}>{metric.helper}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              padding: "12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--success)",
              color: "var(--success-dark)",
              fontWeight: 600,
            }}
          >
            Action: Launch EV loyalty bundle pilot before 4pm sign-off.
          </div>
          </SectionCard>
        </DevLayoutSection>
      </DevLayoutSection>
    </DevLayoutSection>
  );
}
