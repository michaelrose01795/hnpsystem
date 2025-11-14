// Mock data added for the parts manager dashboard until live metrics are wired up.
import React from "react";
import Layout from "@/components/Layout";
import { useUser } from "@/context/UserContext";
import PartsOpsDashboard from "@/components/dashboards/PartsOpsDashboard";

const TEAM_PERFORMANCE = [
  { name: "Liam Patel", role: "Senior Advisor", fillRate: "97%", accuracy: "99%", picksPerHour: "14/hr", valuePerDay: "£6.2k" },
  { name: "Charlie Moss", role: "Counter Lead", fillRate: "94%", accuracy: "98%", picksPerHour: "11/hr", valuePerDay: "£5.1k" },
  { name: "Ella Wright", role: "Apprentice", fillRate: "88%", accuracy: "95%", picksPerHour: "8/hr", valuePerDay: "£2.4k" },
  { name: "George Finn", role: "Logistics", fillRate: "90%", accuracy: "97%", picksPerHour: "Delivery", valuePerDay: "£1.1k" },
];

const SALES_OVERVIEW = [
  { label: "Today’s Sales", value: "£24,500", helper: "Target £26k" },
  { label: "Month-to-date", value: "£182,000", helper: "91% of goal" },
  { label: "Cost of Sales", value: "£112,400", helper: "62% of revenue" },
  { label: "Gross Margin", value: "38%", helper: "+2pt vs LY" },
];

const COST_BREAKDOWN = [
  { label: "OEM Purchases", value: "£32,400", helper: "+4% vs last week" },
  { label: "Aftermarket", value: "£18,900", helper: "-2% vs plan" },
  { label: "Warranty Recoverable", value: "£6,750", helper: "93% claim success" },
  { label: "Consumables", value: "£3,200", helper: "Track usage in workshop" },
];

const RATE_HIGHLIGHTS = [
  { label: "Average Pick Time", value: "13m", helper: "Goal 15m" },
  { label: "Workshop SLA", value: "87%", helper: "Jobs supplied in < 1 hr" },
  { label: "VHC Conversion", value: "61%", helper: "+6 approvals today" },
];

const extraContainerStyle = {
  padding: "0 24px 48px",
  maxWidth: "1400px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const sectionCardStyle = {
  borderRadius: "16px",
  background: "#fff",
  border: "1px solid #ffe0e0",
  padding: "20px",
  boxShadow: "0 18px 36px rgba(0,0,0,0.06)",
  height: "100%",
};

const sectionTitleStyle = {
  fontSize: "0.95rem",
  fontWeight: 700,
  letterSpacing: "0.05em",
  color: "#a00000",
  marginBottom: "14px",
  textTransform: "uppercase",
};

const performanceTableStyle = {
  width: "100%",
  borderCollapse: "collapse",
};

export default function PartsManagerDashboard() {
  const { user } = useUser();
  const userRoles = (user?.roles || []).map((role) => role.toLowerCase());
  const isManager = userRoles.includes("parts manager");

  return (
    <Layout>
      {isManager ? (
        <>
          <PartsOpsDashboard
            title="Parts Manager Dashboard"
            subtitle="Everything the counter team sees plus sales velocity, team rates, and financial guardrails so you can steer the day."
          />

          <div style={extraContainerStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "20px" }}>
              <div style={sectionCardStyle}>
                <div style={sectionTitleStyle}>Team Performance & Rates</div>
                <table style={performanceTableStyle}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "#777", fontSize: "0.85rem" }}>
                      <th style={{ paddingBottom: "10px" }}>Advisor</th>
                      <th style={{ paddingBottom: "10px" }}>Fill Rate</th>
                      <th style={{ paddingBottom: "10px" }}>Pick Accuracy</th>
                      <th style={{ paddingBottom: "10px" }}>Speed</th>
                      <th style={{ paddingBottom: "10px", textAlign: "right" }}>Value / Day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEAM_PERFORMANCE.map((member) => (
                      <tr key={member.name} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                        <td style={{ padding: "12px 0" }}>
                          <div style={{ fontWeight: 600 }}>{member.name}</div>
                          <div style={{ fontSize: "0.85rem", color: "#666" }}>{member.role}</div>
                        </td>
                        <td style={{ padding: "12px 0" }}>{member.fillRate}</td>
                        <td style={{ padding: "12px 0" }}>{member.accuracy}</td>
                        <td style={{ padding: "12px 0" }}>{member.picksPerHour}</td>
                        <td style={{ padding: "12px 0", textAlign: "right", fontWeight: 600 }}>{member.valuePerDay}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Sales & Cost Overview</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "12px" }}>
                    {SALES_OVERVIEW.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          border: "1px solid rgba(209,0,0,0.16)",
                          borderRadius: "12px",
                          padding: "12px",
                        }}
                      >
                        <div style={{ fontSize: "0.8rem", color: "#a00000", fontWeight: 600 }}>{item.label}</div>
                        <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#d10000" }}>{item.value}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>{item.helper}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={sectionCardStyle}>
                  <div style={sectionTitleStyle}>Operational Highlights</div>
                  {RATE_HIGHLIGHTS.map((metric) => (
                    <div key={metric.label} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                      <div style={{ fontWeight: 600 }}>{metric.label}</div>
                      <div style={{ fontSize: "1.4rem", color: "#d10000", fontWeight: 700 }}>{metric.value}</div>
                      <div style={{ fontSize: "0.85rem", color: "#666" }}>{metric.helper}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Cost Breakdown</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "16px" }}>
                {COST_BREAKDOWN.map((cost) => (
                  <div
                    key={cost.label}
                    style={{
                      border: "1px dashed rgba(209,0,0,0.3)",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "rgba(209,0,0,0.02)",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", color: "#a00000", fontWeight: 600 }}>{cost.label}</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#d10000" }}>{cost.value}</div>
                    <div style={{ fontSize: "0.8rem", color: "#666" }}>{cost.helper}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: "48px", textAlign: "center", color: "#a00000" }}>
          Only the parts manager can view this dashboard.
        </div>
      )}
    </Layout>
  );
}
