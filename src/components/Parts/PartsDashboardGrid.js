// Shared, staffglobal.css-driven layout shell for the parts dashboards.
import React from "react";
import LayerSurface from "@/components/ui/LayerSurface";
import LayerTheme from "@/components/ui/LayerTheme";
import StaffCard from "@/components/ui/StaffCard";
import StaffCardGrid from "@/components/ui/StaffCardGrid";
import StaffPageHeader from "@/components/ui/StaffPageHeader";

const sectionCardStyle = { height: "100%", minWidth: 0 };

const splitGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: "var(--page-stack-gap)",
};

const columnStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--page-stack-gap)",
  minWidth: 0,
};

const twoCardGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
  gap: "var(--page-stack-gap)",
};

const listRowStyle = {
  padding: "var(--space-3) 0",
  borderBottom: "var(--separating-line)",
};

const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return "£0.00";
  return `£${numeric.toFixed(2)}`;
};

const formatMargin = (cost, price) => {
  const costValue = Number(cost || 0);
  const priceValue = Number(price || 0);
  const diff = priceValue - costValue;
  const percent = priceValue !== 0 ? (diff / priceValue) * 100 : 0;
  return `${formatCurrency(diff)} (${percent.toFixed(0)}%)`;
};

const statusBadgeClass = (status = "") => {
  const normalized = status.toLowerCase();
  if (/stock|fitted|complete|picked/.test(normalized)) return "app-badge--success";
  if (/wait|order|pending/.test(normalized)) return "app-badge--warning";
  if (/urgent|overdue|failed/.test(normalized)) return "app-badge--danger";
  return "app-badge--neutral";
};

function StaffTable({ children, label }) {
  return (
    <div className="app-table-shell-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="app-data-table app-data-table--rounded app-table-shell app-table-shell--with-headings">
        {children}
      </table>
    </div>
  );
}

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
    <div className="app-page-stack">
      <StaffPageHeader title={title} subtitle={subtitle} />

      <StaffCardGrid minColumnWidth="220px">
        {summaryCards.map((card, index) => (
          <StaffCard
            as="article"
            key={card.label}
            variant="theme"
            title={card.label}
            sectionKey={`parts-ops-summary-${index + 1}`}
            sectionType="stat-card"
            data-dev-text-preview={`Summary card: ${card.label}`}
          >
            <div className="app-staff-card__title" style={{ fontSize: "var(--text-h2)" }}>
              {card.value}
            </div>
            {card.helper ? <div className="app-staff-card__subtitle">{card.helper}</div> : null}
          </StaffCard>
        ))}
      </StaffCardGrid>

      <div style={splitGridStyle}>
        <div style={columnStyle}>
          <LayerTheme
            as="section"
            sectionKey="parts-ops-active-job-queue"
            sectionType="data-table"
            data-dev-text-preview="Active Job Queue"
            style={sectionCardStyle}
          >
            <h2 className="app-staff-card__title">Active Job Queue</h2>
            <StaffTable label="Active Job Queue">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Advisor</th>
                  <th>Needed</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((job) => (
                  <tr key={`${job.jobNumber}-${job.jobId || "line"}`}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{job.jobNumber}</div>
                      <div className="app-staff-card__subtitle">{job.reg}</div>
                    </td>
                    <td>{job.advisor}</td>
                    <td>{job.neededBy}</td>
                    <td>
                      <span className={`app-badge ${statusBadgeClass(job.status)}`}>{job.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>{job.value}</td>
                  </tr>
                ))}
              </tbody>
            </StaffTable>
          </LayerTheme>

          <div style={twoCardGridStyle}>
            <LayerTheme
              as="section"
              sectionKey="parts-ops-inventory-alerts"
              sectionType="content-card"
              data-dev-text-preview="Inventory Alerts"
              style={sectionCardStyle}
            >
              <h2 className="app-staff-card__title">Inventory Alerts</h2>
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
                  <LayerSurface
                    key={alert.id || alert.partNumber || alert.part}
                    radius="var(--radius-sm)"
                    padding="var(--space-3) var(--space-md)"
                    gap="var(--space-xs)"
                  >
                    <div style={{ fontWeight: 600, color: "var(--accentText)" }}>
                      {alert.partNumber ? `${alert.partNumber} · ${alert.name || ""}` : alert.part || "Part"}
                    </div>
                    <div className="app-staff-card__subtitle">
                      Supplier: {alert.supplier || "—"} · Location: {alert.location || "Not set"}
                    </div>
                    <span className={`app-badge ${statusBadgeClass(statusLabel)}`} style={{ alignSelf: "flex-start" }}>
                      {statusLabel} · Stock {alert.inStock ?? 0} / Min {alert.reorderLevel ?? 0}
                    </span>
                    <div className="app-staff-card__subtitle">
                      On order {alert.qtyOnOrder ?? 0} · Cost {formatCurrency(alert.unitCost)} · Sell {formatCurrency(alert.unitPrice)}
                    </div>
                    <div className="app-staff-card__subtitle">
                      Margin {formatMargin(alert.unitCost, alert.unitPrice)} · Linked jobs: {alert.openJobCount ?? 0}
                    </div>
                  </LayerSurface>
                );
              })}
            </LayerTheme>

            <LayerTheme
              as="section"
              sectionKey="parts-ops-team-focus"
              sectionType="content-card"
              data-dev-text-preview="Team Focus"
              style={sectionCardStyle}
            >
              <h2 className="app-staff-card__title">Team Focus</h2>
              {focusItems.map((item) => (
                <div key={item.title} style={listRowStyle}>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div className="app-staff-card__subtitle">{item.detail}</div>
                  <div style={{ color: "var(--accentText)", marginTop: "var(--space-xs)" }}>{item.owner}</div>
                </div>
              ))}
            </LayerTheme>
          </div>
        </div>

        <div style={columnStyle}>
          <LayerTheme
            as="section"
            sectionKey="parts-ops-team-availability"
            sectionType="content-card"
            data-dev-text-preview="Team Availability"
            style={sectionCardStyle}
          >
            <h2 className="app-staff-card__title">Team Availability</h2>
            {teamAvailability.map((entry) => (
              <LayerSurface
                key={entry.name}
                radius="var(--radius-sm)"
                padding="var(--space-3)"
                gap="var(--space-xs)"
              >
                <div style={{ fontWeight: 600 }}>{entry.name}</div>
                <div className="app-staff-card__subtitle">{entry.role}</div>
                <span className="app-badge app-badge--accent-soft" style={{ alignSelf: "flex-start" }}>
                  {entry.status} · {entry.window}
                </span>
              </LayerSurface>
            ))}
          </LayerTheme>

          <LayerTheme
            as="section"
            sectionKey="parts-ops-inbound-deliveries"
            sectionType="content-card"
            data-dev-text-preview="Inbound Deliveries"
            style={sectionCardStyle}
          >
            <h2 className="app-staff-card__title">Inbound Deliveries</h2>
            {deliveries.map((delivery) => (
              <div key={delivery.reference} style={listRowStyle}>
                <div style={{ fontWeight: 600 }}>{delivery.supplier}</div>
                <div className="app-staff-card__subtitle">
                  ETA {delivery.eta} · {delivery.items} lines
                </div>
                <div style={{ color: "var(--accentText)", marginTop: "var(--space-xs)" }}>{delivery.reference}</div>
              </div>
            ))}
          </LayerTheme>
        </div>
      </div>
    </div>
  );
}
