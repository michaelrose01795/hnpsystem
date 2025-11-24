// Shared layout shell for the parts dashboards
import React from "react";

const containerStyle = {
  padding: "24px",
  maxWidth: "1400px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
};

const summaryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const summaryCardStyle = {
  borderRadius: "16px",
  padding: "18px",
  background: "#fff",
  border: "1px solid #ffe0e0",
  boxShadow: "0 12px 30px rgba(209,0,0,0.08)",
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

const splitGridStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)",
  gap: "20px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
};

export default function PartsDashboardGrid({
  title,
  subtitle,
  summaryCards = [],
  workload = [],
  focusItems = [],
  inventoryAlerts = [],
  deliveries = [],
  teamAvailability = [],
}) {
  return (
    <div style={containerStyle}>
      <header>
        <p
          style={{
            marginBottom: "4px",
            color: "#a00000",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 700,
            fontSize: "0.85rem",
          }}
        >
          Parts Department
        </p>
        <h1 style={{ margin: 0, color: "#d10000", fontSize: "2rem" }}>{title}</h1>
        {subtitle ? (
          <p style={{ marginTop: "6px", color: "#555", maxWidth: "760px" }}>{subtitle}</p>
        ) : null}
      </header>

      <div style={summaryGridStyle}>
        {summaryCards.map((card) => (
          <div key={card.label} style={summaryCardStyle}>
            <div style={{ fontSize: "0.85rem", color: "#a00000", fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: "1.9rem", fontWeight: 700, color: "#d10000", margin: "8px 0" }}>
              {card.value}
            </div>
            {card.helper ? <div style={{ color: "#666" }}>{card.helper}</div> : null}
          </div>
        ))}
      </div>

      <div style={splitGridStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Active Job Queue</div>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", fontSize: "0.85rem" }}>
                  <th style={{ paddingBottom: "8px" }}>Job</th>
                  <th style={{ paddingBottom: "8px" }}>Advisor</th>
                  <th style={{ paddingBottom: "8px" }}>Needed</th>
                  <th style={{ paddingBottom: "8px" }}>Status</th>
                  <th style={{ paddingBottom: "8px", textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((job) => (
                  <tr key={job.jobNumber} style={{ background: "#fff8f8" }}>
                    <td style={{ padding: "12px", borderRadius: "10px 0 0 10px" }}>
                      <div style={{ fontWeight: 600 }}>{job.jobNumber}</div>
                      <div style={{ color: "#777", fontSize: "0.85rem" }}>{job.reg}</div>
                    </td>
                    <td style={{ padding: "12px" }}>{job.advisor}</td>
                    <td style={{ padding: "12px" }}>{job.neededBy}</td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          background: job.statusColor || "rgba(209,0,0,0.08)",
                          color: job.statusTextColor || "#a00000",
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "right", borderRadius: "0 10px 10px 0" }}>
                      {job.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Inventory Alerts</div>
              {inventoryAlerts.map((alert) => {
                const statusLabel =
                  alert.status === "low_stock"
                    ? "Low stock"
                    : alert.status === "back_order"
                    ? "On back-order"
                    : alert.status === "inactive"
                    ? "Inactive"
                    : "In stock";
                return (
                  <div
                    key={alert.id || alert.partNumber || alert.part}
                    style={{
                      padding: "12px 14px",
                      marginBottom: "12px",
                      borderRadius: "10px",
                      border: "1px dashed rgba(209,0,0,0.3)",
                      background: "rgba(209,0,0,0.03)",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#b30000" }}>
                      {alert.partNumber ? `${alert.partNumber} · ${alert.name || ""}` : alert.part || "Part"}
                    </div>
                    <div style={{ color: "#666", fontSize: "0.85rem" }}>
                      Supplier: {alert.supplier || "—"} · Location: {alert.location || "Not set"}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#a00000" }}>
                      {statusLabel} · Stock {alert.inStock ?? 0} / Reorder {alert.reorderLevel ?? 0} · On order {alert.qtyOnOrder ?? 0}
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "0.8rem", color: "#555" }}>
                      Cost £{Number(alert.unitCost || 0).toFixed(2)} · Sell £{Number(alert.unitPrice || 0).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={sectionCardStyle}>
              <div style={sectionTitleStyle}>Team Focus</div>
              {focusItems.map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div style={{ color: "#666", fontSize: "0.85rem" }}>{item.detail}</div>
                  <div style={{ fontSize: "0.8rem", color: "#a00000", marginTop: "4px" }}>{item.owner}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Team Availability</div>
            {teamAvailability.map((entry) => (
              <div
                key={entry.name}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid rgba(160,0,0,0.1)",
                  marginBottom: "12px",
                  background: "rgba(209,0,0,0.02)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{entry.name}</div>
                <div style={{ color: "#666", fontSize: "0.85rem" }}>{entry.role}</div>
                <div style={{ fontSize: "0.8rem", color: "#a00000", marginTop: "6px" }}>
                  {entry.status} • {entry.window}
                </div>
              </div>
            ))}
          </div>
          <div style={sectionCardStyle}>
            <div style={sectionTitleStyle}>Inbound Deliveries</div>
            {deliveries.map((delivery) => (
              <div
                key={delivery.reference}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{delivery.supplier}</div>
                <div style={{ color: "#666", fontSize: "0.85rem" }}>
                  ETA {delivery.eta} • {delivery.items} lines
                </div>
                <div style={{ fontSize: "0.8rem", color: "#a00000", marginTop: "4px" }}>
                  {delivery.reference}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
