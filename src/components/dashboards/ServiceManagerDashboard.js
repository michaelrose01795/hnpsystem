// file location: src/components/dashboards/ServiceManagerDashboard.js
import React, { useMemo } from "react";
import Link from "next/link";
import dayjs from "dayjs";

const advisorPipelines = [
  {
    advisor: "Nicola",
    opens: 14,
    authorisations: 9,
    awaitingCallBack: 3,
    escalations: 1,
    nps: 76,
  },
  {
    advisor: "Sharna",
    opens: 12,
    authorisations: 10,
    awaitingCallBack: 1,
    escalations: 0,
    nps: 69,
  },
  {
    advisor: "Josh",
    opens: 9,
    authorisations: 7,
    awaitingCallBack: 2,
    escalations: 0,
    nps: 73,
  },
];

const waitingCustomers = [
  { jobNumber: "JC1440", customer: "Mr. Lawson", promised: "12:30", status: "Awaiting QA", owner: "Nicola" },
  { jobNumber: "JC1442", customer: "Ms. Patel", promised: "14:00", status: "Road Test", owner: "Sharna" },
  { jobNumber: "JC1445", customer: "Fleet Drop", promised: "15:15", status: "Paperwork", owner: "Josh" },
];

const courtesyFleet = [
  { vehicle: "22 HPX", type: "EV Hatch", status: "Due back 13:45", customer: "JC1438" },
  { vehicle: "71 HPN", type: "SUV", status: "With valet", customer: "JC1427" },
  { vehicle: "20 HPA", type: "Hybrid", status: "Available", customer: "-" },
  { vehicle: "19 HPR", type: "City", status: "In use (staff)", customer: "-" },
];

const afternoonPlan = [
  { slot: "13:00", action: "Confirm three while-you-wait collections", owner: "Reception" },
  { slot: "14:30", action: "Service clinic call backs (VIP list)", owner: "Nicola" },
  { slot: "15:15", action: "Courtesy car swap for JC1427", owner: "Sharna" },
  { slot: "16:00", action: "Prep tomorrow's first-wave appointments", owner: "Josh" },
];

const quickActions = [
  { label: "Create Job Card", href: "/job-cards/create" },
  { label: "Appointments", href: "/job-cards/appointments" },
  { label: "Check In", href: "/appointments" },
];

export default function ServiceManagerDashboard() {
  const todayLabel = dayjs().format("dddd, D MMM");
  const advisorTotals = useMemo(() => {
    const totals = advisorPipelines.reduce(
      (acc, advisor) => {
        acc.opens += advisor.opens;
        acc.authorisations += advisor.authorisations;
        acc.awaitingCallBack += advisor.awaitingCallBack;
        acc.escalations += advisor.escalations;
        return acc;
      },
      { opens: 0, authorisations: 0, awaitingCallBack: 0, escalations: 0 }
    );
    return totals;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
      <header
        style={{
          background: "var(--info-surface)",
          borderRadius: "18px",
          padding: "24px",
          border: "1px solid var(--info-surface)",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <span style={{ textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--info-dark)", fontSize: "0.78rem" }}>
          Service Manager Command Centre
        </span>
        <h1 style={{ margin: 0, color: "var(--info-dark)", fontSize: "1.9rem" }}>Customer Flow Control</h1>
        <p style={{ margin: 0, color: "var(--info-dark)" }}>{todayLabel} • 32 appointments • 6 waiters in lounge</p>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--surface)",
          padding: "14px 20px",
          borderRadius: "16px",
          border: "1px solid var(--info-surface)",
          boxShadow: "0 18px 40px rgba(var(--info-rgb), 0.08)",
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
              border: "1px solid var(--info)",
              backgroundColor: "var(--surface)",
              color: "var(--info-dark)",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
              boxShadow: "0 12px 26px rgba(var(--info-rgb), 0.12)",
            }}
          >
            {action.label}
          </Link>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        {[
          { label: "Calls Answered", value: "148", helper: "+18 vs target", accent: "var(--info)" },
          { label: "Check-ins Completed", value: "22", helper: "7 remaining today", accent: "var(--info)" },
          { label: "Advisor CSAT", value: "4.7★", helper: "Live from feedback iPads", accent: "var(--info-dark)" },
          { label: "Upsell Authorised", value: "£4,280", helper: "55% hit-rate", accent: "var(--danger)" },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              borderRadius: "18px",
              padding: "18px",
              background: "var(--surface)",
              border: `1px solid ${metric.accent}22`,
              boxShadow: "0 18px 35px rgba(var(--info-rgb), 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "0.8rem", color: "var(--info)" }}>
              {metric.label}
            </span>
            <strong style={{ fontSize: "1.8rem", color: metric.accent }}>{metric.value}</strong>
            <span style={{ color: "var(--info-dark)", fontSize: "0.85rem" }}>{metric.helper}</span>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(320px, 2fr) minmax(280px, 1.2fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid var(--info-surface)",
            boxShadow: "0 20px 45px rgba(var(--info-rgb), 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "var(--info-dark)", fontSize: "1.2rem" }}>Advisor Pipelines</h2>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>
              {advisorTotals.opens} live jobs • {advisorTotals.awaitingCallBack} awaiting updates •{" "}
              {advisorTotals.escalations} escalations
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {advisorPipelines.map((advisor) => (
              <div
                key={advisor.advisor}
                style={{
                  border: "1px solid var(--info-surface)",
                  borderRadius: "14px",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "1.2fr repeat(4, 1fr)",
                  gap: "12px",
                  alignItems: "center",
                  background: "var(--info-surface)",
                }}
              >
                <strong style={{ fontSize: "1rem", color: "var(--info-dark)" }}>{advisor.advisor}</strong>
                <div>
                  <small style={{ color: "var(--info)" }}>Opens</small>
                  <div style={{ fontWeight: 600 }}>{advisor.opens}</div>
                </div>
                <div>
                  <small style={{ color: "var(--info)" }}>Authorised</small>
                  <div style={{ fontWeight: 600, color: "var(--success)" }}>{advisor.authorisations}</div>
                </div>
                <div>
                  <small style={{ color: "var(--info)" }}>Awaiting CB</small>
                  <div style={{ fontWeight: 600, color: "var(--danger)" }}>{advisor.awaitingCallBack}</div>
                </div>
                <div>
                  <small style={{ color: "var(--info)" }}>NPS</small>
                  <div style={{ fontWeight: 600, color: advisor.nps >= 70 ? "var(--success)" : "var(--danger)" }}>
                    {advisor.nps}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid var(--info-surface)",
            boxShadow: "0 20px 45px rgba(var(--info-rgb), 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "var(--info-dark)", fontSize: "1.2rem" }}>Courtesy Fleet</h2>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>11 of 14 vehicles in use • 2 due back today</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {courtesyFleet.map((car) => (
              <div
                key={car.vehicle}
                style={{
                  borderRadius: "14px",
                  padding: "14px",
                  border: "1px solid var(--info-surface)",
                  background: "var(--info-surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--info-dark)" }}>
                  <strong>{car.vehicle}</strong>
                  <span>{car.type}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", color: "var(--info-dark)" }}>
                  <small>{car.status}</small>
                  <small>{car.customer}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 1fr) minmax(320px, 1fr)",
          gap: "18px",
        }}
      >
        <article
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid var(--info-surface)",
            boxShadow: "0 20px 45px rgba(var(--info-rgb), 0.08)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <h2 style={{ margin: 0, color: "var(--info-dark)", fontSize: "1.2rem" }}>Waiters & Lounge</h2>
              <p style={{ margin: "4px 0 0", color: "var(--info)" }}>Live ETA and owner accountability</p>
            </div>
            <span style={{ color: "var(--info)", fontWeight: 600 }}>{waitingCustomers.length} active</span>
          </div>
          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {waitingCustomers.map((customer) => (
              <div
                key={customer.jobNumber}
                style={{
                  border: "1px solid var(--info-surface)",
                  borderRadius: "14px",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "1.4fr 1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <strong style={{ display: "block", color: "var(--info-dark)" }}>{customer.customer}</strong>
                  <small style={{ color: "var(--info)" }}>{customer.jobNumber}</small>
                </div>
                <div>
                  <small style={{ color: "var(--info)" }}>Promised</small>
                  <div style={{ fontWeight: 600 }}>{customer.promised}</div>
                </div>
                <div>
                  <small style={{ color: "var(--info)" }}>Owner</small>
                  <div style={{ fontWeight: 600 }}>{customer.owner}</div>
                </div>
                <div style={{ gridColumn: "1 / -1", color: "var(--info-dark)" }}>
                  <small>{customer.status}</small>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article
          style={{
            background: "var(--surface)",
            borderRadius: "18px",
            padding: "20px",
            border: "1px solid var(--info-surface)",
            boxShadow: "0 20px 45px rgba(var(--info-rgb), 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "var(--info-dark)", fontSize: "1.2rem" }}>Afternoon Plan</h2>
            <p style={{ margin: "4px 0 0", color: "var(--info)" }}>Key guardrails for the PM session</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {afternoonPlan.map((item) => (
              <div
                key={`${item.slot}-${item.owner}`}
                style={{
                  border: "1px dashed var(--info)",
                  borderRadius: "14px",
                  padding: "14px",
                  background: "var(--info-surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--info-dark)" }}>
                  <strong>{item.slot}</strong>
                  <span>{item.owner}</span>
                </div>
                <p style={{ margin: "6px 0 0", color: "var(--info-dark)" }}>{item.action}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: "8px",
              padding: "12px 14px",
              borderRadius: "12px",
              background: "var(--success-surface)",
              color: "var(--info-dark)",
              fontWeight: 600,
            }}
          >
            Target: Zero waiters after 17:00 • Courtesy fleet utilisation &gt; 85%
          </div>
        </article>
      </section>
    </div>
  );
}
