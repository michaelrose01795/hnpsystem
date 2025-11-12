// file location: src/components/dashboards/AfterSalesManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { supabase } from "@/lib/supabaseClient";

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

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

const quickActions = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/workshop/check-in" },
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
        accent: "#b45309",
      },
      {
        key: "openJobs",
        label: "Open Jobs",
        helper: "Active jobs excluding completed statuses",
        accent: "#d97706",
      },
      {
        key: "partsPending",
        label: "Parts Pending",
        helper: "Requests awaiting allocation",
        accent: "#dc2626",
      },
      {
        key: "vhcSentToday",
        label: "VHC Sent Today",
        helper: "Customer VHC reports sent",
        accent: "#16a34a",
      },
    ];

    return descriptors.map((descriptor) => {
      if (kpiLoading) {
        return { ...descriptor, value: "Loading…", helper: "Fetching live data" };
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
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <header
        style={{
          padding: "24px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #fff1d6, #ffe8c2)",
          border: "1px solid #ffd7a8",
          boxShadow: "0 24px 50px rgba(191,96,0,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontSize: "0.78rem", color: "#a45200" }}>
          After Sales Performance War Room
        </span>
        <h1 style={{ margin: 0, fontSize: "1.9rem", color: "#7a3e00" }}>Revenue & Loyalty Pulse</h1>
        <p style={{ margin: 0, color: "#8b5a2b" }}>{today} • {formatCurrency(totals.actual)} / {formatCurrency(totals.target)} • {progress}% to plan</p>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          background: "#fff",
          padding: "14px 20px",
          borderRadius: "16px",
          border: "1px solid #ffd7a8",
          boxShadow: "0 18px 40px rgba(191,96,0,0.12)",
        }}
      >
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 20px",
              borderRadius: "999px",
              border: "1px solid #ffddb9",
              backgroundColor: "#fff",
              color: "#a45200",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: "0 12px 28px rgba(191,96,0,0.15)",
            }}
          >
            {action.label}
          </Link>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "18px",
        }}
      >
        {metricCards.map((metric) => (
          <div
            key={metric.label}
            style={{
              background: "#fff",
              borderRadius: "18px",
              border: `1px solid ${metric.accent}22`,
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", fontSize: "0.78rem" }}>
              {metric.label}
            </span>
            <strong style={{ fontSize: "1.7rem", color: metric.accent }}>{metric.value}</strong>
            <span style={{ color: "#4b5563", fontSize: "0.85rem" }}>{metric.helper}</span>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 1fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffe0b5",
            boxShadow: "0 24px 50px rgba(191,96,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <h2 style={{ margin: 0, color: "#7a3e00", fontSize: "1.2rem" }}>Revenue Streams</h2>
              <p style={{ margin: "4px 0 0", color: "#8b5a2b" }}>
                {formatCurrency(totals.actual - totals.target)} vs plan • {progress}% achieved
              </p>
            </div>
            <strong style={{ fontSize: "1.3rem", color: "#b45309" }}>{formatCurrency(totals.actual)}</strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {revenueStreams.map((stream) => {
              const streamProgress = Math.round((stream.actual / stream.target) * 100);
              return (
                <div key={stream.label} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong style={{ color: "#7a3e00" }}>{stream.label}</strong>
                    <span style={{ color: "#4b5563" }}>
                      {formatCurrency(stream.actual)} / {formatCurrency(stream.target)} ({streamProgress}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: "12px",
                      borderRadius: "999px",
                      background: "#fff7ec",
                      border: "1px solid #ffe0b5",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(streamProgress, 125)}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #f97316, #b45309)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffe0b5",
            boxShadow: "0 24px 50px rgba(191,96,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#7a3e00", fontSize: "1.2rem" }}>Regional Pulse</h2>
            <p style={{ margin: "4px 0 0", color: "#8b5a2b" }}>Sites benchmarked vs strategic KPIs</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {regionalSnapshot.map((site) => (
              <div
                key={site.site}
                style={{
                  border: "1px solid #ffe0b5",
                  borderRadius: "14px",
                  padding: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong style={{ color: "#7a3e00" }}>{site.site}</strong>
                  <p style={{ margin: "4px 0 0", color: "#8b5a2b", fontSize: "0.85rem" }}>{site.doc}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "1.4rem", color: "#b45309" }}>{site.value}</strong>
                  <p style={{ margin: "4px 0 0", color: site.trend.startsWith("+") ? "#16a34a" : "#dc2626" }}>
                    {site.trend}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 1fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffe0b5",
            boxShadow: "0 24px 50px rgba(191,96,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#7a3e00", fontSize: "1.2rem" }}>Strategic Risks</h2>
            <p style={{ margin: "4px 0 0", color: "#8b5a2b" }}>Escalations that impact daily GP and CSI</p>
          </div>
          {strategicRisks.map((risk) => (
            <div
              key={risk.title}
              style={{
                border: "1px solid #ffe0b5",
                borderRadius: "16px",
                padding: "16px",
                background: risk.severity === "high" ? "#fff5ec" : "#fffdf8",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong style={{ color: "#7a3e00" }}>{risk.title}</strong>
                <span
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: risk.severity === "high" ? "#dc2626" : "#d97706",
                    fontSize: "0.75rem",
                  }}
                >
                  {risk.severity}
                </span>
              </div>
              <p style={{ margin: "6px 0", color: "#4b5563" }}>{risk.detail}</p>
              <p style={{ margin: "6px 0", color: "#7a3e00", fontSize: "0.9rem" }}>
                Owner: {risk.owner} • Mitigation: {risk.mitigation}
              </p>
            </div>
          ))}
        </article>

        <article
          style={{
            background: "#fff",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid #ffe0b5",
            boxShadow: "0 24px 50px rgba(191,96,0,0.12)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#7a3e00", fontSize: "1.2rem" }}>Loyalty Engine</h2>
            <p style={{ margin: "4px 0 0", color: "#8b5a2b" }}>Subscription and retention guardrails</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {loyaltyMetrics.map((metric) => (
              <div
                key={metric.label}
                style={{
                  border: "1px dashed #ffd7a8",
                  borderRadius: "14px",
                  padding: "14px",
                  background: "#fffaf3",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <span style={{ color: "#8b5a2b", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {metric.label}
                </span>
                <strong style={{ fontSize: "1.6rem", color: "#b45309" }}>{metric.value}</strong>
                <span style={{ color: "#4b5563" }}>{metric.helper}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              padding: "12px",
              borderRadius: "12px",
              background: "#ecfccb",
              color: "#3f6212",
              fontWeight: 600,
            }}
          >
            Action: Launch EV loyalty bundle pilot before 4pm sign-off.
          </div>
        </article>
      </section>
    </div>
  );
}
