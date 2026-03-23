import React from "react";
import BaseWidget from "@/components/profile/personal/widgets/BaseWidget";
import { MetricPill, SectionLabel, formatCurrency, widgetGhostButtonStyle, widgetInputStyle } from "@/components/profile/personal/widgets/shared";

function numberValue(value) {
  return Number(value || 0);
}

export default function SpendingWidget({ widget, onOpenSettings, finance }) {
  const month = finance.model.currentMonth;

  return (
    <BaseWidget
      title={widget.config?.title || "Outgoings Summary"}
      subtitle="Classic outgoings, planned payments, and card impact"
      accent="var(--danger, #c62828)"
      summary={
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <MetricPill label="Fixed outgoings" value={formatCurrency(month.totals.fixedOut)} accent="var(--danger, #c62828)" />
          <MetricPill label="Planned payments" value={formatCurrency(month.totals.plannedOut)} accent="var(--warning, #ef6c00)" />
          <MetricPill label="Card payments" value={formatCurrency(month.totals.creditCardOut)} accent="var(--accent-purple)" />
          <MetricPill label="Total out" value={formatCurrency(month.totals.totalOut)} accent="var(--danger, #c62828)" />
        </div>
      }
      onOpenSettings={onOpenSettings}
    >
      <SectionLabel>Fixed outgoing categories</SectionLabel>
      <div style={{ display: "grid", gap: "8px" }}>
        {month.monthState.fixedOutgoings.map((entry) => (
          <div key={entry.id} style={{ display: "grid", gap: "8px", gridTemplateColumns: "1.6fr 1fr auto" }}>
            <input style={widgetInputStyle} value={entry.name || ""} placeholder="Category" onChange={(event) => finance.updateFixedOutgoing(entry.id, { name: event.target.value })} />
            <input type="number" style={widgetInputStyle} value={entry.amount || 0} placeholder="Amount" onChange={(event) => finance.updateFixedOutgoing(entry.id, { amount: numberValue(event.target.value) })} />
            <button type="button" style={widgetGhostButtonStyle} onClick={() => finance.removeFixedOutgoing(entry.id)}>Remove</button>
          </div>
        ))}
        <button type="button" style={widgetGhostButtonStyle} onClick={finance.addFixedOutgoing}>Add fixed outgoing</button>
      </div>

      <SectionLabel>Outgoing adjustment</SectionLabel>
      <input type="number" style={widgetInputStyle} value={month.monthState.outgoingAdjustments || 0} onChange={(event) => finance.updateMonthField("outgoingAdjustments", numberValue(event.target.value))} />
    </BaseWidget>
  );
}
