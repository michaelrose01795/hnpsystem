// file location: src/components/dashboards/AfterSalesManagerDashboard.js
import React from "react";
import dayjs from "dayjs";

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

export default function AfterSalesManagerDashboard() {
  const today = dayjs().format("dddd, D MMM");
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
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "18px",
        }}
      >
        {[
          { label: "Today’s GP", value: formatCurrency(18400), helper: "+£1,140 vs plan", accent: "#b45309" },
          { label: "MTD Gross", value: formatCurrency(286400), helper: "62% of month elapsed", accent: "#d97706" },
          { label: "CSI", value: "89", helper: "Top 5% in region", accent: "#16a34a" },
          { label: "Warranty Claims", value: "12", helper: "£3.8k exposure", accent: "#dc2626" },
        ].map((metric) => (
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
