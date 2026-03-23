import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency, widgetGhostButtonStyle, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function BillsWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;

  return (
    <BaseWidget
      title={widget.config?.title || "Payments Breakdown"}
      subtitle="Planned monthly allocations from Payments workbook flow"
      accent="var(--warning, #ef6c00)"
      summary={<MetricPill label="Planned monthly payments" value={formatCurrency(month.totals.plannedOut)} accent="var(--warning, #ef6c00)" />}
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Planned payment buckets</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.plannedPayments.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.6fr 1fr auto" }}>
            <input style={widgetInputStyle} value={entry.name || ""} placeholder="Bucket" onChange={(event) => finance.updatePlannedPayment(entry.id, { name: event.target.value })} />
            <input type="number" style={widgetInputStyle} value={entry.amount || 0} placeholder="Amount" onChange={(event) => finance.updatePlannedPayment(entry.id, { amount: numberValue(event.target.value) })} />
            <button type="button" style={widgetGhostButtonStyle} onClick={() => finance.removePlannedPayment(entry.id)}>Remove</button>
          </div>
        ))}
      </div>
      <button type="button" style={widgetGhostButtonStyle} onClick={finance.addPlannedPayment}>Add payment bucket</button>
    </BaseWidget>
  );
}
